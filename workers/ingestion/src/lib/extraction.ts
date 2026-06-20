import { CanonicalEventCandidate, SourceRawRecord } from "@eventscout/shared";

interface ExtractionResult {
  candidate: CanonicalEventCandidate | null;
  model: string;
  confidence: number;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return raw.slice(start, end + 1);
}

function toIso(value: string): string | null {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function parseLocalLlmCandidate(raw: string): Partial<CanonicalEventCandidate> | null {
  const jsonSlice = firstJsonObject(raw);
  if (!jsonSlice) {
    return null;
  }
  try {
    return JSON.parse(jsonSlice) as Partial<CanonicalEventCandidate>;
  } catch {
    return null;
  }
}

function extractSourceText(raw: SourceRawRecord): string {
  if (typeof raw.payload === "string") {
    return raw.payload;
  }
  if (raw.payload && typeof raw.payload === "object") {
    const payload = raw.payload as Record<string, unknown>;
    const fields = [
      safeString(payload.title),
      safeString(payload.name),
      safeString(payload.description),
      safeString(payload.body),
      safeString(payload.text),
      safeString(payload.html),
      safeString(payload.snippet)
    ].filter(Boolean);
    return fields.join("\n");
  }
  return "";
}

function fallbackExtract(
  raw: SourceRawRecord,
  defaults: {
    source: string;
    source_family: CanonicalEventCandidate["source_family"];
    city: string;
    region: string;
  }
): ExtractionResult {
  const content = extractSourceText(raw);
  const datetimeMatch =
    content.match(/\b20\d{2}-\d{2}-\d{2}[T\s]\d{1,2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?\b/) ??
    content.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+20\d{2}\b/i);
  const addressMatch = content.match(
    /\b\d{1,6}\s+[A-Za-z0-9.\-'\s]+,\s*[A-Za-z.\-'\s]+,\s*[A-Z]{2}\b/
  );
  const title =
    safeString((raw.payload as { title?: unknown })?.title) ||
    safeString((raw.payload as { name?: unknown })?.name) ||
    safeString((raw.payload as { label?: unknown })?.label) ||
    safeString((raw.payload as { url?: unknown })?.url) ||
    "Untitled event";

  const start_time = datetimeMatch ? toIso(datetimeMatch[0]) : null;
  if (!start_time || !addressMatch) {
    return { candidate: null, model: "deterministic", confidence: 0 };
  }

  const candidate: CanonicalEventCandidate = {
    title,
    description: content.slice(0, 3000),
    start_time,
    end_time: null,
    timezone: "America/New_York",
    venue_name: null,
    address: addressMatch[0],
    lat: null,
    lng: null,
    city: defaults.city,
    region: defaults.region,
    categories: [],
    price_type: "unknown",
    source: defaults.source,
    source_family: defaults.source_family,
    source_url: raw.source_url,
    source_event_id: raw.source_event_id,
    organizer_name: null,
    engagement_signals: {},
    raw_payload: raw.payload
  };

  return { candidate, model: "deterministic", confidence: 0.55 };
}

export async function extractCandidateWithLocalLlm(
  raw: SourceRawRecord,
  defaults: {
    source: string;
    source_family: CanonicalEventCandidate["source_family"];
    city: string;
    region: string;
  }
): Promise<ExtractionResult> {
  const endpoint = process.env.LOCAL_LLM_ENDPOINT ?? "http://127.0.0.1:11434/api/generate";
  const model = process.env.LOCAL_LLM_MODEL ?? "llama3.2:3b";
  const promptText = extractSourceText(raw).slice(0, 7000);

  if (!promptText) {
    return { candidate: null, model: "deterministic", confidence: 0 };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: [
          "Extract one event from this public web content.",
          "Return strict JSON with keys:",
          "title, description, start_time, end_time, timezone, venue_name, address, city, region, categories, price_type, organizer_name.",
          "If unknown use empty string for strings and [] for categories.",
          `Content:\n${promptText}`
        ].join("\n")
      })
    });

    if (!response.ok) {
      return fallbackExtract(raw, defaults);
    }
    const payload = (await response.json()) as { response?: string };
    const parsed = parseLocalLlmCandidate(payload.response ?? "");
    if (!parsed) {
      return fallbackExtract(raw, defaults);
    }

    const startTime = safeString(parsed.start_time);
    const normalizedStart = startTime ? toIso(startTime) : null;
    const address = safeString(parsed.address);
    const title = safeString(parsed.title);
    if (!normalizedStart || !address || !title) {
      return fallbackExtract(raw, defaults);
    }

    const candidate: CanonicalEventCandidate = {
      title,
      description: safeString(parsed.description),
      start_time: normalizedStart,
      end_time: parsed.end_time ? toIso(safeString(parsed.end_time)) : null,
      timezone: safeString(parsed.timezone) || "America/New_York",
      venue_name: safeString(parsed.venue_name) || null,
      address,
      lat: null,
      lng: null,
      city: safeString(parsed.city) || defaults.city,
      region: safeString(parsed.region) || defaults.region,
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((item): item is string => typeof item === "string")
        : [],
      price_type: safeString(parsed.price_type) || "unknown",
      source: defaults.source,
      source_family: defaults.source_family,
      source_url: raw.source_url,
      source_event_id: raw.source_event_id,
      organizer_name: safeString(parsed.organizer_name) || null,
      engagement_signals: {},
      raw_payload: raw.payload
    };
    return { candidate, model: `local-llm:${model}`, confidence: 0.8 };
  } catch {
    return fallbackExtract(raw, defaults);
  }
}

import { env } from "@/lib/config/env";
import type { RawEvent } from "@/lib/events/types";
import type { EventSourceProvider, FetchEventsInput } from "./provider";

export type MeetupDiagnostic = {
  level: "warning" | "error";
  message: string;
};

type MeetupGraphqlResponse = {
  data?: unknown;
  errors?: Array<{ message?: unknown }> | null;
};

type MeetupGraphqlNode = Record<string, unknown>;

type MeetupRawEvent = {
  id?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  description?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timezone?: string | null;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageUrl?: string | null;
  categories?: string[];
  interests?: string[];
  confidence?: number;
  groupName?: string | null;
  groupUrl?: string | null;
  groupTopics?: string[];
  tags?: string[];
  isRecurring?: boolean;
};

const DEFAULT_MEETUP_GRAPHQL_ENDPOINT = "https://api.meetup.com/gql";
const diagnostics: MeetupDiagnostic[] = [];

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanTextList(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => cleanText(value))
    .filter((value): value is string => Boolean(value));
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function firstTextFromValue(value: unknown) {
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return firstText(
    record.name,
    record.label,
    record.value,
    record.code,
    record.id,
    record.countryCode,
    record.stateCode,
    record.region
  );
}

function extractAddressText(value: unknown) {
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return firstText(
    record.line1,
    record.line2,
    record.street,
    record.street1,
    record.address1,
    record.address2,
    record.formattedAddress,
    record.localized_address_display,
    record.name
  );
}

function extractImageUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      const cleaned = cleanText(value);
      if (cleaned) {
        return cleaned;
      }
    }

    if (!value || typeof value !== "object") {
      continue;
    }

    const record = value as Record<string, unknown>;
    const candidate = firstText(
      record.url,
      record.imageUrl,
      record.photoUrl,
      record.highresLink,
      record.baseUrl
    );
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readLocationRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function recordDiagnostic(level: MeetupDiagnostic["level"], message: string) {
  diagnostics.push({ level, message });
}

function snapshotDiagnostics() {
  return [...diagnostics];
}

export function snapshotMeetupProviderDiagnostics() {
  return snapshotDiagnostics();
}

export function consumeMeetupProviderDiagnostics() {
  const current = snapshotDiagnostics();
  diagnostics.length = 0;
  return current;
}

function normalizeCountry(value: unknown) {
  const country = firstText(value) ?? "";
  if (!country) {
    return null;
  }

  const normalized = country.toUpperCase();
  if (
    normalized === "US" ||
    normalized === "USA" ||
    normalized === "UNITED STATES" ||
    normalized === "UNITED STATES OF AMERICA"
  ) {
    return "USA";
  }

  return country;
}

function resolveDateTime(...values: unknown[]) {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) {
      continue;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return `${cleaned}T12:00:00.000Z`;
    }

    return cleaned;
  }

  return null;
}

function collectTopicNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return cleanText(entry);
      }

      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      return firstText(record.name, record.label, record.topic, record.title);
    })
    .filter((entry): entry is string => Boolean(entry));
}

function collectNodesFromContainer(value: unknown): unknown[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (entry && typeof entry === "object" && "node" in entry) {
        return collectNodesFromContainer((entry as Record<string, unknown>).node);
      }

      return [entry];
    });
  }

  const record = value as Record<string, unknown>;
  const nodes: unknown[] = [];

  for (const key of ["nodes", "events", "items", "results"] as const) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      nodes.push(...candidate);
    }
  }

  if (Array.isArray(record.edges)) {
    for (const edge of record.edges) {
      if (!edge || typeof edge !== "object") {
        nodes.push(edge);
        continue;
      }

      const edgeRecord = edge as Record<string, unknown>;
      if ("node" in edgeRecord) {
        nodes.push(edgeRecord.node);
      } else {
        nodes.push(edge);
      }
    }
  }

  for (const key of ["eventSearch", "upcomingEvents", "search"] as const) {
    const candidate = record[key];
    if (candidate && typeof candidate === "object") {
      nodes.push(...collectNodesFromContainer(candidate));
    }
  }

  const group = record.group;
  if (group && typeof group === "object") {
    const groupRecord = group as Record<string, unknown>;
    for (const key of ["upcomingEvents", "events"] as const) {
      const candidate = groupRecord[key];
      if (candidate && typeof candidate === "object") {
        nodes.push(...collectNodesFromContainer(candidate));
      }
    }
  }

  return nodes;
}

export function buildMeetupEventsQuery(input: FetchEventsInput) {
  return {
    query: `
      query MeetupEvents($input: MeetupEventsInput!) {
        eventSearch(input: $input) {
          edges {
            node {
              id
              title
              name
              description
              url
              eventUrl
              link
              startDateTime
              startsAt
              dateTime
              endDateTime
              endsAt
              timezone
              imageUrl
              photoUrl
              featuredPhoto {
                url
              }
              venue {
                name
                address
                city
                region
                country
                latitude
                longitude
              }
              group {
                id
                name
                url
                topics {
                  name
                }
              }
              topics {
                name
              }
              tags {
                name
              }
              categories
            }
          }
        }
      }
    `,
    variables: {
      input: {
        city: cleanText(input.city),
        latitude: toNumber(input.latitude),
        longitude: toNumber(input.longitude),
        radiusMiles: toNumber(input.radiusMiles),
        startDate: cleanText(input.startDate),
        endDate: cleanText(input.endDate),
        keyword: cleanText(input.keyword),
        interests: cleanTextList(input.interests),
        limit: 50
      }
    }
  };
}

export function buildMeetupGraphqlRequest(input: FetchEventsInput) {
  const { query, variables } = buildMeetupEventsQuery(input);

  return {
    endpoint: cleanText(env.meetupGraphqlEndpoint) ?? DEFAULT_MEETUP_GRAPHQL_ENDPOINT,
    init: {
      method: "POST" as const,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.meetupAccessToken}`
      },
      body: JSON.stringify({
        operationName: "MeetupEvents",
        query,
        variables
      })
    }
  };
}

export function parseMeetupGraphqlResponse(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      nodes: [] as unknown[],
      graphqlErrors: ["Meetup response payload is malformed."]
    };
  }

  const record = payload as MeetupGraphqlResponse & Record<string, unknown>;
  const graphqlErrors =
    Array.isArray(record.errors) && record.errors.length > 0
      ? record.errors
          .map((error) => firstText(error?.message) ?? "Meetup GraphQL error.")
          .filter((message): message is string => Boolean(message))
      : [];

  const data = "data" in record ? record.data : record;
  const nodes = collectNodesFromContainer(data);

  return {
    nodes,
    graphqlErrors
  };
}

function mapMeetupNode(node: unknown, input: FetchEventsInput): MeetupRawEvent | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const record = node as MeetupGraphqlNode;
  const venue = readLocationRecord(record.venue ?? record.location ?? record.place);
  const group = readLocationRecord(record.group);
  const topics = collectTopicNames(record.topics);
  const categoryNames = [
    ...topics,
    ...collectTopicNames(record.tags),
    ...collectTopicNames(record.categories),
    ...collectTopicNames(group?.topics)
  ];
  const normalizedCategories = [...new Set(categoryNames.map((value) => value.toLowerCase()))];
  const sourceUrl = firstText(
    record.url,
    record.eventUrl,
    record.link,
    record.eventPageUrl,
    record.permalink
  );
  const title = firstText(record.title, record.name, record.eventName);
  const id = firstText(record.id, record.eventId);
  const startDateTime = resolveDateTime(
    record.startDateTime,
    record.startsAt,
    record.dateTime,
    record.startTime,
    record.start
  );
  const venueName = firstText(
    record.venueName,
    venue?.name,
    record.locationName,
    record.placeName
  );
  const address = firstText(
    record.address,
    extractAddressText(venue?.address),
    extractAddressText(record.addressDetails),
    extractAddressText(venue?.localized_address_display),
    extractAddressText(venue?.formattedAddress)
  );
  const city =
    firstText(
      record.city,
      firstTextFromValue(venue?.city),
      input.city
    ) ?? "Unknown";
  const region = firstText(
    record.region,
    firstTextFromValue(venue?.state),
    firstTextFromValue(venue?.stateCode)
  );
  const country = normalizeCountry(
    firstText(
      record.country,
      firstTextFromValue(venue?.country),
      firstTextFromValue(venue?.countryCode)
    )
  );
  const latitude = toNumber(record.latitude ?? venue?.latitude ?? venue?.lat);
  const longitude = toNumber(record.longitude ?? venue?.longitude ?? venue?.lng);
  const imageUrl = firstText(
    record.imageUrl,
    record.photoUrl,
    extractImageUrl(record.featuredPhoto),
    extractImageUrl(record.photo),
    extractImageUrl(group?.photo)
  );
  const description = firstText(record.description, record.summary, record.details);
  const endDateTime = resolveDateTime(record.endDateTime, record.endsAt, record.endTime);
  const groupName = firstText(record.groupName, group?.name);
  const groupUrl = firstText(record.groupUrl, group?.url);
  const groupTopics = [...new Set([...collectTopicNames(group?.topics), ...topics])];

  if (!id || !title || !sourceUrl || !startDateTime) {
    return null;
  }

  return {
    id,
    sourceUrl,
    title,
    description,
    startDateTime,
    endDateTime,
    timezone: firstText(record.timezone, venue?.timezone),
    venueName,
    address,
    city,
    region,
    country,
    latitude,
    longitude,
    imageUrl,
    categories: normalizedCategories,
    interests: normalizedCategories,
    confidence:
      toNumber(record.confidence) ??
      (venueName || address ? 0.92 : 0.88),
    groupName,
    groupUrl,
    groupTopics,
    tags: [...new Set([...collectTopicNames(record.tags), ...collectTopicNames(record.categories)])],
    isRecurring:
      typeof record.isRecurring === "boolean"
        ? record.isRecurring
        : typeof record.recurring === "boolean"
          ? record.recurring
          : false
  };
}

async function fetchMeetupEvents(input: FetchEventsInput): Promise<RawEvent[]> {
  if (!env.enableMeetupProvider) {
    return [];
  }

  if (!env.meetupAccessToken) {
    recordDiagnostic(
      "warning",
      "Meetup provider is enabled but MEETUP_ACCESS_TOKEN is missing."
    );
    return [];
  }

  const { endpoint, init } = buildMeetupGraphqlRequest(input);

  try {
    const response = await fetch(endpoint, init);

    if (!response.ok) {
      recordDiagnostic("error", `Meetup request failed with HTTP ${response.status}.`);
      return [];
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      recordDiagnostic("error", "Meetup response could not be parsed as JSON.");
      return [];
    }

    const parsed = parseMeetupGraphqlResponse(payload);
    for (const error of parsed.graphqlErrors) {
      recordDiagnostic("error", error);
    }

    const fetchedAt = new Date().toISOString();
    const rawEvents: RawEvent[] = [];
    let skipped = 0;

    for (const candidate of parsed.nodes) {
      const mapped = mapMeetupNode(candidate, input);
      if (!mapped) {
        skipped += 1;
        continue;
      }

      rawEvents.push({
      sourceId: "meetup",
      sourceName: "Meetup",
      sourceType: "api",
      sourceEventId: mapped.id ?? null,
      sourceUrl: mapped.sourceUrl ?? "",
      fetchedAt,
      raw: mapped
      });
    }

    if (skipped > 0) {
      recordDiagnostic(
        "warning",
        `Meetup returned ${skipped} malformed event record${skipped === 1 ? "" : "s"} that were skipped.`
      );
    }

    return rawEvents;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    recordDiagnostic("error", `Meetup request failed: ${reason}`);
    return [];
  }
}

export const meetupProvider: EventSourceProvider = {
  sourceId: "meetup",
  sourceName: "Meetup",
  sourceType: "api",
  enabled: env.enableMeetupProvider && Boolean(env.meetupAccessToken),
  fetchEvents: fetchMeetupEvents
};

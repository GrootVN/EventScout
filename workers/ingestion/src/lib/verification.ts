import { EventRecord, TrustedSource } from "@eventscout/shared";

function domainFromUrl(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isTrustedByAllowlist(event: EventRecord, trustedSources: TrustedSource[]): boolean {
  const eventDomain = domainFromUrl(event.source_url);
  const sourceKey = normalize(event.source);
  const sourceUrlKey = normalize(event.source_url);

  return trustedSources.some((entry) => {
    if (!entry.active) {
      return false;
    }
    const sourceValue = normalize(entry.source_value);
    if (entry.source_type === "domain") {
      return Boolean(eventDomain && (eventDomain === sourceValue || eventDomain.endsWith(`.${sourceValue}`)));
    }
    if (entry.source_type === "account") {
      return sourceKey.includes(sourceValue);
    }
    return sourceUrlKey.includes(sourceValue);
  });
}

function buildIndependenceKey(event: Pick<EventRecord, "source_url" | "source_family">): string {
  const domain = domainFromUrl(event.source_url) || "unknown-domain";
  return `${event.source_family}:${domain}`;
}

export function evaluateVerificationGate(input: {
  event: EventRecord;
  duplicateEvents: EventRecord[];
  trustedSources: TrustedSource[];
  extractionConfidence: number;
}): Pick<
  EventRecord,
  "publish_state" | "verification_count" | "verified_by_trusted_source" | "verification_reasons"
> {
  const allSignals = [input.event, ...input.duplicateEvents];
  const independentKeys = new Set(allSignals.map((entry) => buildIndependenceKey(entry)));
  const verificationCount = independentKeys.size;
  const trusted = isTrustedByAllowlist(input.event, input.trustedSources);
  const reasons: string[] = [];

  if (trusted && input.extractionConfidence >= 0.7) {
    reasons.push("trusted source allowlist match");
  }
  if (verificationCount >= 2) {
    reasons.push("cross-confirmed by independent sources");
  }
  if (input.extractionConfidence < 0.45) {
    reasons.push("low extraction confidence");
  }

  if ((verificationCount >= 2 || trusted) && input.extractionConfidence >= 0.45) {
    return {
      publish_state: "published",
      verification_count: verificationCount,
      verified_by_trusted_source: trusted,
      verification_reasons: reasons
    };
  }

  return {
    publish_state: "pending",
    verification_count: verificationCount,
    verified_by_trusted_source: trusted,
    verification_reasons: reasons.length ? reasons : ["awaiting corroboration"]
  };
}

import { TrustedSource } from "@eventscout/shared";
import { slugify } from "@/lib/utils/slug";

type TrustedSourceInput = {
  source_type: TrustedSource["source_type"];
  source_value: string;
  source_family: TrustedSource["source_family"];
  notes?: string;
  active?: boolean;
};

const nowIso = "2026-06-19T12:00:00.000Z";

const initialTrustedSources: TrustedSource[] = [
  {
    id: "trusted-domain-city-of-cincinnati-calendar",
    source_type: "domain",
    source_value: "www.cincinnati-oh.gov",
    source_family: "calendar",
    active: true,
    notes: "Official city calendar and civic event listings.",
    created_at: nowIso,
    updated_at: nowIso
  },
  {
    id: "trusted-domain-cincinnati-library-calendar",
    source_type: "domain",
    source_value: "www.cincinnatilibrary.org",
    source_family: "calendar",
    active: true,
    notes: "Library programs and newcomer-friendly community events.",
    created_at: nowIso,
    updated_at: nowIso
  },
  {
    id: "trusted-profile-meetup-cincinnati-tech-meetup",
    source_type: "profile_url",
    source_value: "https://www.meetup.com/cincinnati-tech-meetup/",
    source_family: "community",
    active: true,
    notes: "Curated Meetup group focused on newcomers and builders.",
    created_at: nowIso,
    updated_at: nowIso
  },
  {
    id: "trusted-domain-rhinegeist-brewery",
    source_type: "domain",
    source_value: "www.rhinegeist.com",
    source_family: "venue",
    active: true,
    notes: "Venue announcements and recurring event calendars.",
    created_at: nowIso,
    updated_at: nowIso
  },
  {
    id: "trusted-account-newcomers-cincy",
    source_type: "account",
    source_value: "@newcomerscincy",
    source_family: "social",
    active: false,
    notes: "Placeholder social lead account to review before ingestion.",
    created_at: nowIso,
    updated_at: nowIso
  }
];

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function makeTrustedSourceId(input: TrustedSourceInput) {
  return [
    "trusted",
    input.source_type,
    slugify(input.source_value),
    input.source_family
  ]
    .filter(Boolean)
    .join("-");
}

function clone(source: TrustedSource): TrustedSource {
  return { ...source };
}

const trustedSources: TrustedSource[] = [...initialTrustedSources];

function findSourceIndex(id: string) {
  return trustedSources.findIndex((source) => source.id === id);
}

export function listTrustedSources() {
  return trustedSources
    .slice()
    .sort((left, right) => {
      if (left.active !== right.active) {
        return Number(right.active) - Number(left.active);
      }

      return left.source_family.localeCompare(right.source_family) || left.source_value.localeCompare(right.source_value);
    })
    .map(clone);
}

export function upsertTrustedSource(input: TrustedSourceInput) {
  const id = makeTrustedSourceId(input);
  const now = new Date().toISOString();
  const existingIndex = findSourceIndex(id);
  const source: TrustedSource = {
    id,
    source_type: input.source_type,
    source_value: clean(input.source_value),
    source_family: input.source_family,
    active: input.active ?? true,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    created_at: existingIndex >= 0 ? trustedSources[existingIndex]!.created_at : now,
    updated_at: now
  };

  if (existingIndex >= 0) {
    trustedSources.splice(existingIndex, 1, source);
  } else {
    trustedSources.push(source);
  }

  return clone(source);
}

export function deactivateTrustedSource(id: string) {
  const existingIndex = findSourceIndex(id);
  if (existingIndex < 0) {
    return;
  }

  const existing = trustedSources[existingIndex]!;
  trustedSources.splice(existingIndex, 1, {
    ...existing,
    active: false,
    updated_at: new Date().toISOString()
  });
}

export function resetTrustedSourcesForTests() {
  trustedSources.splice(0, trustedSources.length, ...initialTrustedSources.map(clone));
}

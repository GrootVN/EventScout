import { afterEach, describe, expect, it } from "vitest";
import {
  deactivateTrustedSource,
  listTrustedSources,
  resetTrustedSourcesForTests,
  upsertTrustedSource
} from "../../apps/web/lib/trustedSourcesStore";

afterEach(() => {
  resetTrustedSourcesForTests();
});

describe("trusted sources store", () => {
  it("keeps active sources ahead of inactive ones", async () => {
    const sources = await listTrustedSources();

    expect(sources[0]?.active).toBe(true);
    expect(sources.at(-1)?.active).toBe(false);
  });

  it("preserves created_at when updating an existing source", async () => {
    const created = await upsertTrustedSource({
      source_type: "domain",
      source_value: "www.example.com",
      source_family: "calendar",
      notes: "Initial note"
    });

    const updated = await upsertTrustedSource({
      source_type: "domain",
      source_value: "www.example.com",
      source_family: "calendar",
      notes: "Updated note",
      active: false
    });

    expect(updated.created_at).toBe(created.created_at);
    expect(updated.notes).toBe("Updated note");
    expect(updated.active).toBe(false);
  });

  it("can deactivate a source by id", async () => {
    const created = await upsertTrustedSource({
      source_type: "profile_url",
      source_value: "https://www.meetup.com/example/",
      source_family: "community"
    });

    deactivateTrustedSource(created.id);

    const sources = await listTrustedSources();
    const match = sources.find((source) => source.id === created.id);

    expect(match?.active).toBe(false);
  });
});

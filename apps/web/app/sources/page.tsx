import Link from "next/link";
import { getActiveCityPreset, getActiveCityPresetSummary } from "@/lib/sources/localPresetProvider";
import { listSourceSummaries } from "@/lib/events/service";

export default async function SourcesPage() {
  const sources = await listSourceSummaries();
  const cityPreset = getActiveCityPreset();
  const cityPresetSummary = getActiveCityPresetSummary();
  const presetSources = cityPreset
    ? [
        ...cityPreset.sources.ics.map((source) => ({ ...source, sourceTypeLabel: "ICS" })),
        ...cityPreset.sources.rss.map((source) => ({ ...source, sourceTypeLabel: "RSS" }))
      ]
    : [];

  return (
    <main className="page-shell">
      <section className="saved-card">
        <p className="eyebrow">Source transparency</p>
        <h1>Where Event Scout gets its leads</h1>
        <p>
          The app is built around adapters, so sources can be added one by one without changing the browsing UI. Every
          event keeps its original source link.
        </p>
        <p>
          Need a readiness snapshot instead of the inventory view? Open the{" "}
          <Link href="/health" className="text-link">
            source health dashboard
          </Link>
          .
        </p>
      </section>
      <section className="saved-card">
        <p className="eyebrow">City preset</p>
        <h2>{cityPresetSummary ? cityPresetSummary.cityName : "No preset active"}</h2>
        <p>
          {cityPresetSummary
            ? `${cityPresetSummary.icsSourceCount} ICS sources and ${cityPresetSummary.rssSourceCount} RSS sources are currently enabled from the active preset.`
            : "Enable city presets to load a launch-city source bundle."}
        </p>
      </section>
      {cityPreset ? (
        <section className="saved-card">
          <p className="eyebrow">Preset sources</p>
          <h2>{cityPreset.cityName} bundle</h2>
          <p>Disabled examples stay visible here so you can see what the preset is intended to cover.</p>
          <div className="sources-grid">
            {presetSources.map((source) => (
              <article key={source.sourceId} className="source-card saved-card">
                <div className="event-topline">
                  <strong>{source.sourceName}</strong>
                  <span className="score-chip">{source.enabled === false ? "Planned" : "Enabled"}</span>
                </div>
                <p className="eyebrow">Type: {source.sourceTypeLabel}</p>
                <p>{source.url}</p>
              </article>
            ))}
          </div>
          {cityPreset.sources.ticketmaster ? (
            <p>
              Ticketmaster preset is {cityPreset.sources.ticketmaster.enabled ? "enabled" : "planned"}
              {cityPreset.sources.ticketmaster.defaultKeyword
                ? ` for "${cityPreset.sources.ticketmaster.defaultKeyword}".`
                : "."}
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="sources-grid">
        {sources.map((source) => (
          <article key={source.sourceId} className="source-card saved-card">
            <div className="event-topline">
              <strong>{source.sourceName}</strong>
              <span className="score-chip">{source.enabled ? "Enabled" : "Planned"}</span>
            </div>
            <p className="eyebrow">Type: {source.sourceType}</p>
            <p>{source.enabled ? "Currently active in the scout pipeline." : "Stubbed and ready for a future adapter."}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

import { listSourceSummaries } from "@/lib/events/service";

export default async function SourcesPage() {
  const sources = await listSourceSummaries();

  return (
    <main className="page-shell">
      <section className="saved-card">
        <p className="eyebrow">Source transparency</p>
        <h1>Where Event Scout gets its leads</h1>
        <p>
          The app is built around adapters, so sources can be added one by one without changing the browsing UI. Every
          event keeps its original source link.
        </p>
      </section>
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

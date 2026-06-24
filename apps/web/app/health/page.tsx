import Link from "next/link";
import { canViewDetailedHealth, getPublicHealthSummary, getSourceHealthReport } from "@/lib/sources/health";
import { listSourceRuns } from "@/lib/sources/runHistoryStore";
import { SourceRunHistory } from "@/components/source-run-history";
import { getCurrentSourceAlerts } from "@/lib/sources/sourceAlerts";
import type { SourceAlert } from "@/lib/sources/sourceAlertTypes";

function renderList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <li>{emptyLabel}</li>;
  }

  return items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>);
}

function renderCount(value: number | undefined) {
  return typeof value === "number" ? value : 0;
}

function renderEvidence(alert: SourceAlert) {
  if (!alert.evidence || Object.keys(alert.evidence).length === 0) {
    return null;
  }

  return <pre>{JSON.stringify(alert.evidence, null, 2)}</pre>;
}

type HealthPageProps = {
  searchParams: Promise<{
    key?: string;
  }>;
};

export default async function HealthPage({ searchParams }: HealthPageProps) {
  const { key } = await searchParams;
  const detailed = canViewDetailedHealth(key);
  const summary = getPublicHealthSummary();
  const report = detailed ? getSourceHealthReport() : null;
  const runs = listSourceRuns(10);
  const alertResult = getCurrentSourceAlerts();

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Source health</p>
        <h1>Source readiness dashboard</h1>
        <p>
          Public health summary for the running app. The same summary is exposed through{" "}
          <Link className="text-link" href="/api/health">
            /api/health
          </Link>
          .
        </p>
        <div className="pill-row">
          <span className="pill">{summary.totals.enabledProviderCount} enabled</span>
          <span className="pill">{summary.totals.readyProviderCount} ready</span>
          <span className="pill">{summary.totals.warningProviderCount} warning</span>
          <span className="pill">{summary.totals.errorProviderCount} error</span>
          <span className="pill">{summary.totals.needsConfigProviderCount} needs config</span>
          <span className="pill">{summary.totals.disabledProviderCount} disabled</span>
        </div>
        <p className="eyebrow">{summary.status} - version {summary.appVersion} - generated {summary.generatedAt}</p>
      </section>

      <section className="saved-card">
        <p className="eyebrow">Overview</p>
        <h2>What is safe to show publicly</h2>
        <p>
          Detailed provider diagnostics stay hidden unless detailed health is available in this environment or you
          open this page with admin authorization in production.
        </p>
        <dl className="meta-grid">
          <div>
            <dt>Provider count</dt>
            <dd>{summary.totals.providerCount}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{summary.warningCount}</dd>
          </div>
          <div>
            <dt>Errors</dt>
            <dd>{summary.errorCount}</dd>
          </div>
        </dl>
      </section>

      <SourceRunHistory summary={summary} runs={runs} detailed={detailed} />

      <section className="saved-card">
        <p className="eyebrow">Source alerts</p>
        <h2>Active alert summary</h2>
        <p>
          Alerts turn source health and recent run history into deterministic checks. Public mode shows counts only;
          detailed mode shows the actionable alert list.
        </p>
        <dl className="meta-grid">
          <div>
            <dt>Total active</dt>
            <dd>{alertResult.summary.total}</dd>
          </div>
          <div>
            <dt>Critical</dt>
            <dd>{alertResult.summary.critical}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{alertResult.summary.warning}</dd>
          </div>
          <div>
            <dt>Info</dt>
            <dd>{alertResult.summary.info}</dd>
          </div>
        </dl>
        {alertResult.summary.hasCritical ? (
          <p>Critical source alerts are active. Open detailed health with admin authorization to review actions.</p>
        ) : null}
        {alertResult.summary.total === 0 ? <p>No active source alerts.</p> : null}
      </section>

      {report ? (
        <>
          <section className="saved-card">
            <p className="eyebrow">Alert details</p>
            <h2>Current source alerts</h2>
            {alertResult.alerts.length === 0 ? (
              <p>No active source alerts.</p>
            ) : (
              <div className="sources-grid">
                {alertResult.alerts.map((alert) => (
                  <article key={alert.id} className="source-card saved-card">
                    <div className="event-topline">
                      <strong>{alert.title}</strong>
                      <span className="score-chip">{alert.severity}</span>
                    </div>
                    <p className="eyebrow">
                      {alert.category}
                      {alert.providerId ? ` - ${alert.providerId}` : ""}
                    </p>
                    <p>{alert.message}</p>
                    <p>
                      <strong>Recommended action:</strong> {alert.recommendedAction}
                    </p>
                    {renderEvidence(alert)}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="saved-card">
            <p className="eyebrow">Configuration</p>
            <h2>Environment and source flags</h2>
            <dl className="meta-grid">
              <div>
                <dt>Admin token configured</dt>
                <dd>{report.config.adminTokenConfigured ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Mock provider</dt>
                <dd>{report.config.mockProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Community mock provider</dt>
                <dd>{report.config.communityMockProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Curated provider</dt>
                <dd>{report.config.curatedProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Community submissions provider</dt>
                <dd>{report.config.communitySubmissionsProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Ticketmaster provider</dt>
                <dd>{report.config.ticketmasterProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Meetup provider</dt>
                <dd>{report.config.meetupProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>ICS provider</dt>
                <dd>
                  {report.config.icsProviderEnabled ? "Enabled" : "Disabled"} ({report.config.icsSourceCount} source
                  {report.config.icsSourceCount === 1 ? "" : "s"})
                </dd>
              </div>
              <div>
                <dt>RSS provider</dt>
                <dd>
                  {report.config.rssProviderEnabled ? "Enabled" : "Disabled"} ({report.config.rssSourceCount} source
                  {report.config.rssSourceCount === 1 ? "" : "s"})
                </dd>
              </div>
              <div>
                <dt>Website provider</dt>
                <dd>{report.config.websiteProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Social leads provider</dt>
                <dd>{report.config.socialLeadProviderEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
            </dl>
          </section>

          <section className="saved-card">
            <p className="eyebrow">Providers</p>
            <h2>Live source snapshot</h2>
            <div className="sources-grid">
              {report.providers.map((provider) => (
                <article key={provider.sourceId} className="source-card saved-card">
                  <div className="event-topline">
                    <strong>{provider.sourceName}</strong>
                    <span className="score-chip">{provider.status}</span>
                  </div>
                  <p className="eyebrow">
                    {provider.sourceType} - {provider.enabled ? "Enabled" : "Disabled"}
                  </p>
                  <p>{provider.summary}</p>
                  {provider.configNotes.length > 0 ? (
                    <>
                      <p className="eyebrow">Configuration</p>
                      <ul>{renderList(provider.configNotes, "No configuration notes.")}</ul>
                    </>
                  ) : null}
                  <dl className="meta-grid">
                    <div>
                      <dt>Warnings</dt>
                      <dd>{provider.warningCount}</dd>
                    </div>
                    <div>
                      <dt>Errors</dt>
                      <dd>{provider.errorCount}</dd>
                    </div>
                    {"rawLoadedCount" in provider.counters ? (
                      <div>
                        <dt>Raw loaded</dt>
                        <dd>{renderCount(provider.counters.rawLoadedCount)}</dd>
                      </div>
                    ) : null}
                    {"totalSubmissions" in provider.counters ? (
                      <div>
                        <dt>Total submissions</dt>
                        <dd>{renderCount(provider.counters.totalSubmissions)}</dd>
                      </div>
                    ) : null}
                    {"approvedCount" in provider.counters ? (
                      <div>
                        <dt>Approved</dt>
                        <dd>{renderCount(provider.counters.approvedCount)}</dd>
                      </div>
                    ) : null}
                    {"pendingCount" in provider.counters ? (
                      <div>
                        <dt>Pending</dt>
                        <dd>{renderCount(provider.counters.pendingCount)}</dd>
                      </div>
                    ) : null}
                    {"rejectedCount" in provider.counters ? (
                      <div>
                        <dt>Rejected</dt>
                        <dd>{renderCount(provider.counters.rejectedCount)}</dd>
                      </div>
                    ) : null}
                    {"suppressedCount" in provider.counters ? (
                      <div>
                        <dt>Suppressed</dt>
                        <dd>{renderCount(provider.counters.suppressedCount)}</dd>
                      </div>
                    ) : null}
                    {"emittedRawEventCount" in provider.counters ? (
                      <div>
                        <dt>Emitted raw</dt>
                        <dd>{renderCount(provider.counters.emittedRawEventCount)}</dd>
                      </div>
                    ) : null}
                    {"invalidConversionCount" in provider.counters ? (
                      <div>
                        <dt>Invalid conversions</dt>
                        <dd>{renderCount(provider.counters.invalidConversionCount)}</dd>
                      </div>
                    ) : null}
                    {"invalidCount" in provider.counters ? (
                      <div>
                        <dt>Invalid</dt>
                        <dd>{renderCount(provider.counters.invalidCount)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {provider.warnings.length > 0 ? (
                    <>
                      <p className="eyebrow">Warnings</p>
                      <ul>{renderList(provider.warnings, "No warnings.")}</ul>
                    </>
                  ) : null}
                  {provider.errors.length > 0 ? (
                    <>
                      <p className="eyebrow">Errors</p>
                      <ul>{renderList(provider.errors, "No errors.")}</ul>
                    </>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="saved-card">
            <p className="eyebrow">Warnings</p>
            <h2>Combined source warnings</h2>
            <ul>{renderList(report.warnings, "No warnings.")}</ul>
          </section>

          <section className="saved-card">
            <p className="eyebrow">Errors</p>
            <h2>Combined source errors</h2>
            <ul>{renderList(report.errors, "No errors.")}</ul>
          </section>
        </>
      ) : null}
    </main>
  );
}

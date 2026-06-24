import type { PublicHealthSummary } from "@/lib/sources/health";
import { detectStaleProviders, getProviderTrend, summarizeRunHistory } from "@/lib/sources/runHistoryStats";
import type { SourceRunRecord } from "@/lib/sources/runHistoryTypes";

type SourceRunHistoryProps = {
  summary: PublicHealthSummary;
  runs: SourceRunRecord[];
  detailed: boolean;
};

function renderCount(value: number | null | undefined) {
  return typeof value === "number" ? value : 0;
}

function renderLabel(value: string | null | undefined, fallback = "Unknown") {
  return value?.trim() || fallback;
}

function renderRows(runs: SourceRunRecord[]) {
  if (runs.length === 0) {
    return (
      <tr>
        <td colSpan={8}>No recorded runs yet.</td>
      </tr>
    );
  }

  return runs.map((run) => (
    <tr key={run.id}>
      <td>{run.runType}</td>
      <td>{run.overallStatus}</td>
      <td>{run.finishedAt}</td>
      <td>{run.rawCount}</td>
      <td>{run.validCount}</td>
      <td>{run.droppedCount}</td>
      <td>{run.finalCount}</td>
      <td>{run.warningCount + run.errorCount}</td>
    </tr>
  ));
}

function renderProviderTrends(runs: SourceRunRecord[]) {
  const providerIds = Array.from(new Set(runs.flatMap((run) => run.providers.map((provider) => provider.providerId))));
  const trends = providerIds
    .map((providerId) => getProviderTrend(providerId, runs))
    .sort((left, right) => left.providerName?.localeCompare(right.providerName ?? "") ?? 0);

  if (trends.length === 0) {
    return <p>No provider history available yet.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Latest Status</th>
          <th>Raw Delta</th>
          <th>Valid Delta</th>
          <th>Dropped Delta</th>
          <th>Warning Streak</th>
          <th>Error Streak</th>
          <th>Last Seen</th>
        </tr>
      </thead>
      <tbody>
        {trends.map((trend) => (
          <tr key={trend.providerId}>
            <td>{renderLabel(trend.providerName, trend.providerId)}</td>
            <td>{trend.latest?.status ?? "unknown"}</td>
            <td>{trend.rawDelta}</td>
            <td>{trend.validDelta}</td>
            <td>{trend.droppedDelta}</td>
            <td>{trend.warningStreak}</td>
            <td>{trend.errorStreak}</td>
            <td>{trend.lastSeenAt ?? "Never"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SourceRunHistory({ summary, runs, detailed }: SourceRunHistoryProps) {
  const history = summarizeRunHistory(runs);
  const staleProviders = detailed ? detectStaleProviders(runs, 24 * 3) : [];

  return (
    <section className="saved-card">
      <p className="eyebrow">Run history</p>
      <h2>Source run trend summary</h2>
      <p>
        {summary.runHistoryEnabled
          ? "Source-run history is enabled and captures summary records over time."
          : "Source-run history is disabled in this environment."}
      </p>
      <dl className="meta-grid">
        <div>
          <dt>Latest run</dt>
          <dd>{summary.latestRunAt ?? "No runs recorded"}</dd>
        </div>
        <div>
          <dt>Latest status</dt>
          <dd>{summary.latestRunStatus ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Latest raw</dt>
          <dd>{renderCount(history.latestRun?.rawCount)}</dd>
        </div>
        <div>
          <dt>Latest valid</dt>
          <dd>{renderCount(history.latestRun?.validCount)}</dd>
        </div>
        <div>
          <dt>Latest dropped</dt>
          <dd>{renderCount(history.latestRun?.droppedCount)}</dd>
        </div>
        <div>
          <dt>Latest final</dt>
          <dd>{renderCount(history.latestRun?.finalCount)}</dd>
        </div>
        <div>
          <dt>Warning streak</dt>
          <dd>{history.warningStreak}</dd>
        </div>
        <div>
          <dt>Error streak</dt>
          <dd>{history.errorStreak}</dd>
        </div>
      </dl>

      <h3>Recent runs</h3>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Status</th>
            <th>Finished</th>
            <th>Raw</th>
            <th>Valid</th>
            <th>Dropped</th>
            <th>Final</th>
            <th>Warnings + Errors</th>
          </tr>
        </thead>
        <tbody>{renderRows(runs.slice(0, 5))}</tbody>
      </table>

      {detailed ? (
        <>
          <h3>Provider trends</h3>
          {renderProviderTrends(runs)}

          <h3>Stale providers</h3>
          {staleProviders.length === 0 ? (
            <p>No stale providers detected at the current threshold.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Last seen</th>
                  <th>Age hours</th>
                </tr>
              </thead>
              <tbody>
                {staleProviders.map((provider) => (
                  <tr key={provider.providerId}>
                    <td>{renderLabel(provider.providerName, provider.providerId)}</td>
                    <td>{provider.lastSeenAt ?? "Never"}</td>
                    <td>{provider.ageHours !== null ? provider.ageHours.toFixed(1) : "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}

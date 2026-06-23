import { isAdminPageAuthorized } from "@/lib/admin-auth";
import { getFlaggedEvents, listTrustedSources } from "@/lib/event-service";
import { listSubmissions } from "@/lib/submissions/submissionStore";
import { ModerationList } from "@/components/moderation-list";
import { CommunitySubmissionsManager } from "@/components/community-submissions-manager";
import { TrustedSourcesManager } from "@/components/trusted-sources-manager";

type AdminPageProps = {
  searchParams: Promise<{
    key?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { key } = await searchParams;

  if (!isAdminPageAuthorized(key)) {
    return (
      <main className="page-shell">
        <section className="saved-card">
          <p className="eyebrow">Admin access</p>
          <h1>Authorization required</h1>
          <p>Set `ADMIN_TOKEN` in the environment and open this page with `?key=` matching that token.</p>
        </section>
      </main>
    );
  }

  const [trustedSources, flaggedEvents, pendingSubmissions] = await Promise.all([
    listTrustedSources(),
    getFlaggedEvents(),
    listSubmissions("pending")
  ]);

  return (
    <main className="page-shell">
      <section className="saved-card">
        <p className="eyebrow">Admin console</p>
        <h1>Curated source controls</h1>
        <p>
          Use this page to manage trusted source inventory and review events that should not reach the main discovery
          experience yet.
        </p>
        <p>
          Curated admin events are file-backed for now and flow through the same ingestion pipeline when
          `ENABLE_CURATED_PROVIDER` is enabled.
        </p>
        <p>
          Community submissions are always held in a pending queue first. They do not appear in public discovery until
          they are approved.
        </p>
      </section>
      <div className="admin-grid">
        <ModerationList initialEvents={flaggedEvents} adminToken={key} />
        <TrustedSourcesManager initialSources={trustedSources} adminToken={key} />
        <CommunitySubmissionsManager initialSubmissions={pendingSubmissions} adminToken={key} />
      </div>
    </main>
  );
}

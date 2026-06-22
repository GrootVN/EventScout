import { EmptyState } from "@/components/events/EmptyState";
import { EventFilters } from "@/components/events/EventFilters";
import { EventGrid } from "@/components/events/EventGrid";
import { NewcomerPrompt } from "@/components/onboarding/NewcomerPrompt";
import { parseSearchState } from "@/lib/events/query";
import { scoutEvents } from "@/lib/events/service";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const state = parseSearchState(await searchParams);
  const events = await scoutEvents(state, state);

  return (
    <main className="page-shell">
      <NewcomerPrompt />
      <section className="discover-layout">
        <EventFilters state={state} />
        <div className="results-stack">
          <div className="results-header">
            <div>
              <p className="eyebrow">Recommended events</p>
              <h2>{events.length} strong picks for this window</h2>
            </div>
            <p className="eyebrow">
              Nearby events, free events, solo-friendly events, and hidden gems all keep their original source visible.
            </p>
          </div>
          {events.length > 0 ? <EventGrid events={events} /> : <EmptyState />}
        </div>
      </section>
    </main>
  );
}

import { formatInterestLabel } from "@/data/interests";
import { formatEventDate } from "@/lib/utils/dates";
import type { ScoredEvent } from "@/lib/events/types";
import { EventSourceBadge } from "./EventSourceBadge";
import { SaveEventButton } from "./SaveEventButton";

type EventDetailProps = {
  event: ScoredEvent;
};

export function EventDetail({ event }: EventDetailProps) {
  return (
    <article className="detail-card">
      <div className="event-topline">
        <EventSourceBadge sourceName={event.sourceName} />
        <SaveEventButton eventId={event.id} />
      </div>
      <h1>{event.title}</h1>
      <p className="detail-copy">{event.description ?? "No description provided yet."}</p>
      <dl className="detail-grid">
        <div>
          <dt>Date</dt>
          <dd>{formatEventDate(event.startDateTime)}</dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>{event.venueName ?? "Venue pending"}</dd>
        </div>
        <div>
          <dt>Neighborhood</dt>
          <dd>{event.neighborhood ?? event.city}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{event.priceType === "free" ? "Free" : event.minPrice ? `$${event.minPrice}` : "Check source"}</dd>
        </div>
      </dl>
      <div className="pill-row">
        {event.interests.map((interest) => (
          <span key={interest} className="pill">
            {formatInterestLabel(interest)}
          </span>
        ))}
      </div>
      <section className="sources-panel">
        <h2>Original sources</h2>
        <ul>
          {event.originalSources.map((source) => (
            <li key={`${source.sourceId}-${source.sourceUrl}`}>
              <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="text-link">
                {source.sourceName}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

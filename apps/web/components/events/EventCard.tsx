import Link from "next/link";
import { formatInterestLabel } from "@/data/interests";
import { formatEventDate } from "@/lib/utils/dates";
import type { ScoredEvent } from "@/lib/events/types";
import { EventSourceBadge } from "./EventSourceBadge";
import { SaveEventButton } from "./SaveEventButton";

type EventCardProps = {
  event: ScoredEvent;
};

export function EventCard({ event }: EventCardProps) {
  return (
    <article className="event-card">
      <div className="event-topline">
        <EventSourceBadge sourceName={event.sourceName} />
        <SaveEventButton eventId={event.id} />
      </div>
      <div className="event-copy">
        <Link href={`/events/${event.id}`} className="event-link">
          <h3>{event.title}</h3>
        </Link>
        <p>{event.description ?? "No description provided yet."}</p>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>When</dt>
          <dd>{formatEventDate(event.startDateTime)}</dd>
        </div>
        <div>
          <dt>Where</dt>
          <dd>{event.venueName ?? event.neighborhood ?? event.city}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{event.priceType === "free" ? "Free" : event.minPrice ? `$${event.minPrice}` : "Check source"}</dd>
        </div>
        <div>
          <dt>Trust</dt>
          <dd>{Math.round(event.confidence * 100)}% verified from source</dd>
        </div>
      </dl>
      <div className="pill-row">
        {event.interests.slice(0, 5).map((interest) => (
          <span key={interest} className="pill">
            {formatInterestLabel(interest)}
          </span>
        ))}
      </div>
      <div className="event-actions">
        <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-link">
          Open original source
        </a>
        <span className="score-chip">Match {Math.round(event.score * 100)}</span>
      </div>
    </article>
  );
}

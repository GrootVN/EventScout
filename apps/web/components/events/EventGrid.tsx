import type { ScoredEvent } from "@/lib/events/types";
import { EventCard } from "./EventCard";

type EventGridProps = {
  events: ScoredEvent[];
};

export function EventGrid({ events }: EventGridProps) {
  return (
    <div className="event-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

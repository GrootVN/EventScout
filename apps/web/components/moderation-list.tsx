"use client";

import type { EventRecord } from "@eventscout/shared";
import { type FormEvent, useState } from "react";

interface ModerationListProps {
  initialEvents: EventRecord[];
  adminToken?: string;
}

export function ModerationList({ initialEvents, adminToken }: ModerationListProps) {
  const [events, setEvents] = useState(initialEvents);
  const [note, setNote] = useState("Reviewed by admin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function authHeaders() {
    return {
      "content-type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {})
    };
  }

  async function suppress(eventId: string) {
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/admin/flagged", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ event_id: eventId, note })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to suppress event");
        return;
      }

      setEvents((current) => current.filter((event) => event.id !== eventId));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to suppress event";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  function updateNote(event: FormEvent<HTMLInputElement>) {
    setNote(event.currentTarget.value);
  }

  return (
    <section className="saved-card">
      <div className="filters-header">
        <div>
          <p className="eyebrow">Moderation queue</p>
          <h2>Flagged events</h2>
        </div>
        <span className="score-chip">{events.length} items</span>
      </div>
      <p className="eyebrow">
        Review low-confidence, community-sourced, or otherwise suspicious records before they reach discovery.
      </p>
      <label className="field">
        Default note
        <input className="input" value={note} onChange={updateNote} />
      </label>
      {error ? <p className="admin-message">{error}</p> : null}
      <div className="saved-grid">
        {events.length === 0 ? <p>No records need moderation right now.</p> : null}
        {events.map((event) => (
          <article key={event.id} className="event-card">
            <div className="event-topline">
              <strong>{event.title}</strong>
              <span className="score-chip">{event.publish_state}</span>
            </div>
            <p className="eyebrow">
              {event.source} - {event.source_family} - confidence {event.confidence_score.toFixed(2)}
            </p>
            <p>{event.description}</p>
            <dl className="detail-grid">
              <div>
                <dt>Source URL</dt>
                <dd>
                  <a className="text-link" href={event.source_url} target="_blank" rel="noreferrer">
                    Open source
                  </a>
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {event.city}, {event.region}
                </dd>
              </div>
            </dl>
            <button className="danger-button" type="button" onClick={() => suppress(event.id)} disabled={pending}>
              {pending ? "Suppressing..." : "Suppress from discovery"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

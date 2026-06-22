"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "event-scout-saved-events";

export default function SavedPage() {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    function loadSaved() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        setSavedIds(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        setSavedIds([]);
      }
    }

    loadSaved();
    window.addEventListener("event-scout-saved-updated", loadSaved as EventListener);
    return () => window.removeEventListener("event-scout-saved-updated", loadSaved as EventListener);
  }, []);

  return (
    <main className="page-shell">
      <section className="saved-card">
        <p className="eyebrow">Saved events</p>
        <h1>Your shortlist</h1>
        <p>Saved events persist in this browser so you can come back to them later.</p>
      </section>

      {savedIds.length === 0 ? (
        <section className="empty-state">
          <h2>No saved events yet.</h2>
          <p>Save anything interesting from the discovery feed and it will show up here.</p>
        </section>
      ) : (
        <section className="saved-card">
          <ul className="saved-grid">
            {savedIds.map((id) => (
              <li key={id}>
                <Link href={`/events/${id}`} className="text-link">
                  Open saved event {id}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

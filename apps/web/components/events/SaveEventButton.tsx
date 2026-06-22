"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "event-scout-saved-events";

function readSavedIds() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function writeSavedIds(ids: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent("event-scout-saved-updated"));
}

type SaveEventButtonProps = {
  eventId: string;
};

export function SaveEventButton({ eventId }: SaveEventButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSavedIds().has(eventId));
  }, [eventId]);

  function toggleSaved() {
    const next = readSavedIds();
    if (next.has(eventId)) {
      next.delete(eventId);
      setSaved(false);
    } else {
      next.add(eventId);
      setSaved(true);
    }
    writeSavedIds(next);
  }

  return (
    <button className={`save-button ${saved ? "saved" : ""}`} type="button" onClick={toggleSaved}>
      {saved ? "Saved" : "Save"}
    </button>
  );
}

"use client";

import type { TrustedSource } from "@eventscout/shared";
import { type FormEvent, useState } from "react";

interface TrustedSourcesManagerProps {
  initialSources: TrustedSource[];
  adminToken?: string;
}

const SOURCE_TYPES: Array<TrustedSource["source_type"]> = ["domain", "account", "profile_url"];
const SOURCE_FAMILIES = [
  "listing_api",
  "forum",
  "community",
  "ticketing",
  "venue",
  "calendar",
  "social",
  "news",
  "other"
] as const;

function emptyForm() {
  return {
    source_type: "domain" as TrustedSource["source_type"],
    source_value: "",
    source_family: "calendar" as TrustedSource["source_family"],
    notes: "",
    active: true
  };
}

export function TrustedSourcesManager({ initialSources, adminToken }: TrustedSourcesManagerProps) {
  const [sources, setSources] = useState(initialSources);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function authHeaders() {
    return {
      "content-type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {})
    };
  }

  async function refreshSources() {
    const response = await fetch("/api/admin/trusted-sources", {
      headers: adminToken ? { "x-admin-token": adminToken } : undefined
    });
    const payload = (await response.json()) as { data?: TrustedSource[]; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load trusted sources");
    }

    setSources(payload.data ?? []);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/admin/trusted-sources", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { data?: TrustedSource; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to save trusted source");
        return;
      }

      setForm(emptyForm());
      await refreshSources();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to save trusted source";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function deactivate(id: string) {
    setError(null);
    const response = await fetch(`/api/admin/trusted-sources?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: adminToken ? { "x-admin-token": adminToken } : undefined
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Unable to deactivate trusted source");
      return;
    }

    try {
      await refreshSources();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load trusted sources";
      setError(message);
    }
  }

  return (
    <section className="saved-card">
      <div className="filters-header">
        <div>
          <p className="eyebrow">Trusted sources</p>
          <h2>Curated source allowlist</h2>
        </div>
        <span className="score-chip">{sources.length} sources</span>
      </div>
      <p className="eyebrow">
        Use this list to keep venue, calendar, and community sources explicit before they are promoted into ingestion.
      </p>
      {error ? <p className="admin-message">{error}</p> : null}
      <form className="admin-form" onSubmit={submitForm}>
        <div className="admin-form-grid">
          <label className="field">
            Type
            <select
              className="input"
              value={form.source_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, source_type: event.target.value as TrustedSource["source_type"] }))
              }
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Family
            <select
              className="input"
              value={form.source_family}
              onChange={(event) =>
                setForm((current) => ({ ...current, source_family: event.target.value as TrustedSource["source_family"] }))
              }
            >
              {SOURCE_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Source value
          <input
            className="input"
            value={form.source_value}
            onChange={(event) => setForm((current) => ({ ...current, source_value: event.target.value }))}
            placeholder="www.example.com or https://www.meetup.com/example/"
          />
        </label>
        <label className="field">
          Notes
          <textarea
            className="input"
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Why this source is trusted"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
          />
          Active
        </label>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save trusted source"}
        </button>
      </form>
      <div className="sources-grid">
        {sources.map((source) => (
          <article key={source.id} className="source-card saved-card">
            <div className="event-topline">
              <strong>{source.source_value}</strong>
              <span className="score-chip">{source.active ? "Active" : "Inactive"}</span>
            </div>
            <p className="eyebrow">
              {source.source_type} - {source.source_family}
            </p>
            <p>{source.notes ?? "No notes provided."}</p>
            <button
              className="danger-button"
              type="button"
              onClick={() => deactivate(source.id)}
              disabled={!source.active}
            >
              {source.active ? "Deactivate" : "Already inactive"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

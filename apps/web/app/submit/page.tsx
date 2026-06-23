"use client";

import { type FormEvent, useState } from "react";

type SubmissionFormState = {
  title: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  timezone: string;
  venueName: string;
  address: string;
  city: string;
  region: string;
  country: string;
  priceType: "free" | "paid" | "unknown";
  minPrice: string;
  maxPrice: string;
  currency: string;
  sourceUrl: string;
  categories: string;
  interests: string;
  submitterName: string;
  submitterEmail: string;
  submitterNote: string;
};

const initialState: SubmissionFormState = {
  title: "",
  description: "",
  startDateTime: "",
  endDateTime: "",
  timezone: "",
  venueName: "",
  address: "",
  city: "",
  region: "",
  country: "",
  priceType: "unknown",
  minPrice: "",
  maxPrice: "",
  currency: "",
  sourceUrl: "",
  categories: "",
  interests: "",
  submitterName: "",
  submitterEmail: "",
  submitterNote: ""
};

function toIso(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function listToArray(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export default function SubmitPage() {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([]);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function updateField<K extends keyof SubmissionFormState>(key: K, value: SubmissionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIssues([]);
    setSuccessMessage(null);
    setPending(true);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          startDateTime: toIso(form.startDateTime),
          endDateTime: form.endDateTime ? toIso(form.endDateTime) : null,
          timezone: form.timezone || null,
          venueName: form.venueName || null,
          address: form.address || null,
          city: form.city,
          region: form.region || null,
          country: form.country || null,
          priceType: form.priceType,
          minPrice: form.minPrice ? Number(form.minPrice) : null,
          maxPrice: form.maxPrice ? Number(form.maxPrice) : null,
          currency: form.currency || null,
          sourceUrl: form.sourceUrl,
          categories: listToArray(form.categories),
          interests: listToArray(form.interests),
          submitterName: form.submitterName || null,
          submitterEmail: form.submitterEmail || null,
          submitterNote: form.submitterNote || null
        })
      });

      const payload = (await response.json()) as
        | { ok: true; submission: { id: string; status: string; title: string } }
        | { ok: false; error: string; issues?: Array<{ path: string; message: string }> };

      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "Submission failed" : payload.error);
        setIssues(!payload.ok && payload.issues ? payload.issues : []);
        return;
      }

      setForm(initialState);
      setSuccessMessage(
        `Submission ${payload.submission.id} is pending review. It will not appear publicly until approved.`
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to submit event");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="saved-card">
        <p className="eyebrow">Community submissions</p>
        <h1>Submit a local event</h1>
        <p className="detail-copy">
          Public submissions create a pending review record first. Nothing appears in discovery until an admin
          approves it.
        </p>
        {successMessage ? <p className="admin-message">{successMessage}</p> : null}
        {error ? <p className="admin-message">{error}</p> : null}
        {issues.length > 0 ? (
          <ul className="eyebrow">
            {issues.map((issue) => (
              <li key={`${issue.path}-${issue.message}`}>
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="saved-card">
        <form className="admin-form" onSubmit={onSubmit}>
          <div className="admin-form-grid">
            <label className="field">
              Title
              <input className="input" value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
            </label>
            <label className="field">
              Start date/time
              <input
                className="input"
                type="datetime-local"
                value={form.startDateTime}
                onChange={(event) => updateField("startDateTime", event.target.value)}
                required
              />
            </label>
          </div>
          <label className="field">
            Description
            <textarea
              className="input"
              rows={4}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </label>
          <div className="admin-form-grid">
            <label className="field">
              End date/time
              <input
                className="input"
                type="datetime-local"
                value={form.endDateTime}
                onChange={(event) => updateField("endDateTime", event.target.value)}
              />
            </label>
            <label className="field">
              Timezone
              <input className="input" value={form.timezone} onChange={(event) => updateField("timezone", event.target.value)} />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              Venue name
              <input className="input" value={form.venueName} onChange={(event) => updateField("venueName", event.target.value)} />
            </label>
            <label className="field">
              Address
              <input className="input" value={form.address} onChange={(event) => updateField("address", event.target.value)} />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              City
              <input className="input" value={form.city} onChange={(event) => updateField("city", event.target.value)} required />
            </label>
            <label className="field">
              Region
              <input className="input" value={form.region} onChange={(event) => updateField("region", event.target.value)} />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              Country
              <input className="input" value={form.country} onChange={(event) => updateField("country", event.target.value)} />
            </label>
            <label className="field">
              Source URL
              <input
                className="input"
                value={form.sourceUrl}
                onChange={(event) => updateField("sourceUrl", event.target.value)}
                required
              />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              Price type
              <select
                className="input"
                value={form.priceType}
                onChange={(event) => updateField("priceType", event.target.value as SubmissionFormState["priceType"])}
              >
                <option value="unknown">unknown</option>
                <option value="free">free</option>
                <option value="paid">paid</option>
              </select>
            </label>
            <label className="field">
              Currency
              <input className="input" value={form.currency} onChange={(event) => updateField("currency", event.target.value)} />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              Minimum price
              <input className="input" value={form.minPrice} onChange={(event) => updateField("minPrice", event.target.value)} />
            </label>
            <label className="field">
              Maximum price
              <input className="input" value={form.maxPrice} onChange={(event) => updateField("maxPrice", event.target.value)} />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              Categories
              <input className="input" value={form.categories} onChange={(event) => updateField("categories", event.target.value)} placeholder="music, community, tech" />
            </label>
            <label className="field">
              Interests
              <input className="input" value={form.interests} onChange={(event) => updateField("interests", event.target.value)} placeholder="newcomer-friendly, solo-friendly" />
            </label>
          </div>
          <div className="admin-form-grid">
            <label className="field">
              Your name
              <input className="input" value={form.submitterName} onChange={(event) => updateField("submitterName", event.target.value)} />
            </label>
            <label className="field">
              Your email
              <input className="input" type="email" value={form.submitterEmail} onChange={(event) => updateField("submitterEmail", event.target.value)} />
            </label>
          </div>
          <label className="field">
            Note for moderators
            <textarea className="input" rows={3} value={form.submitterNote} onChange={(event) => updateField("submitterNote", event.target.value)} />
          </label>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Submitting..." : "Submit event"}
          </button>
        </form>
      </section>
    </main>
  );
}

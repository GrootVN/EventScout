"use client";

import type { CommunitySubmission } from "@/lib/submissions/types";
import { type FormEvent, useState } from "react";

interface CommunitySubmissionsManagerProps {
  initialSubmissions: CommunitySubmission[];
  adminToken?: string;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleString();
}

export function CommunitySubmissionsManager({ initialSubmissions, adminToken }: CommunitySubmissionsManagerProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [note, setNote] = useState("Reviewed by admin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function authHeaders() {
    return {
      "content-type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {})
    };
  }

  async function refreshSubmissions() {
    const response = await fetch("/api/admin/submissions?status=pending", {
      headers: adminToken ? { "x-admin-token": adminToken } : undefined
    });
    const payload = (await response.json()) as { data?: CommunitySubmission[]; error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load community submissions");
    }

    setSubmissions(payload.data ?? []);
  }

  async function moderate(submissionId: string, action: "approve" | "reject" | "suppress") {
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/admin/submissions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          submissionId,
          action,
          moderationNote: note,
          reviewedBy: "admin"
        })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to update submission");
        return;
      }

      await refreshSubmissions();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to update submission";
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
          <p className="eyebrow">Community submissions</p>
          <h2>Pending event review</h2>
        </div>
        <span className="score-chip">{submissions.length} items</span>
      </div>
      <p className="eyebrow">
        Submitted events stay hidden from public discovery until an admin approves them.
      </p>
      <label className="field">
        Default moderation note
        <input className="input" value={note} onChange={updateNote} />
      </label>
      {error ? <p className="admin-message">{error}</p> : null}
      <div className="saved-grid">
        {submissions.length === 0 ? <p>No pending community submissions right now.</p> : null}
        {submissions.map((submission) => (
          <article key={submission.id} className="event-card">
            <div className="event-topline">
              <strong>{submission.title}</strong>
              <span className="score-chip">{submission.status}</span>
            </div>
            <p className="eyebrow">
              {formatShortDate(submission.startDateTime)}
              {submission.venueName ? ` - ${submission.venueName}` : ""}
            </p>
            <p>{submission.description ?? "No description provided."}</p>
            <dl className="detail-grid">
              <div>
                <dt>Source URL</dt>
                <dd>
                  <a className="text-link" href={submission.sourceUrl} target="_blank" rel="noreferrer">
                    Open submission source
                  </a>
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {submission.city}
                  {submission.region ? `, ${submission.region}` : ""}
                </dd>
              </div>
            </dl>
            {submission.submitterNote ? (
              <p className="eyebrow">Submitter note: {submission.submitterNote}</p>
            ) : null}
            <div className="pill-row">
              {submission.categories.map((category) => (
                <span key={category} className="pill">
                  {category}
                </span>
              ))}
              {submission.interests.map((interest) => (
                <span key={interest} className="pill">
                  {interest}
                </span>
              ))}
            </div>
            <div className="event-actions">
              <button className="primary-button" type="button" onClick={() => moderate(submission.id, "approve")} disabled={pending}>
                {pending ? "Updating..." : "Approve"}
              </button>
              <button className="danger-button" type="button" onClick={() => moderate(submission.id, "reject")} disabled={pending}>
                Reject
              </button>
              <button className="danger-button" type="button" onClick={() => moderate(submission.id, "suppress")} disabled={pending}>
                Suppress
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}


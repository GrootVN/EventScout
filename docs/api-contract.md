# EventScout API Contract (MVP)

## `GET /api/events`

Returns ranked event results.

### Query params

- `bbox=minLng,minLat,maxLng,maxLat`
- `lat`, `lng`, `radiusKm`
- `time_range=today|this_weekend|custom`
- `start_time`, `end_time` (ISO for custom)
- `categories=music,tech,...`
- `price_type=free|paid|unknown`
- `confidence_min=0..1`
- `sort=relevance|distance|start_time`
- `interests=music,tech,...`

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Riverside Night Market",
      "ranking": {
        "finalScore": 0.84
      },
      "confidence_label": "high"
    }
  ],
  "meta": {
    "count": 1,
    "generated_at": "2026-05-29T23:00:00.000Z"
  }
}
```

## `GET /api/events/:id`

Returns a single event detail with ranking breakdown and provenance fields.

## `GET /api/facets`

Returns category and price counts for current query context.

## `POST /api/feedback`

Records user trust/relevance feedback.

```json
{
  "event_id": "uuid",
  "type": "not_relevant",
  "note": "optional"
}
```

## `POST /api/submissions`

Creates a pending community submission record.

```json
{
  "title": "Neighborhood Welcome Coffee",
  "description": "optional",
  "startDateTime": "2026-06-24T22:30:00.000Z",
  "endDateTime": "optional",
  "timezone": "optional",
  "venueName": "optional",
  "address": "optional",
  "city": "Cincinnati",
  "region": "OH",
  "country": "USA",
  "priceType": "free",
  "minPrice": null,
  "maxPrice": null,
  "currency": "USD",
  "sourceUrl": "https://example.com/events/coffee",
  "categories": ["community"],
  "interests": ["newcomer-friendly"],
  "submitterName": "optional",
  "submitterEmail": "optional",
  "submitterNote": "optional"
}
```

Response:

```json
{
  "ok": true,
  "submission": {
    "id": "submission-1",
    "status": "pending",
    "title": "Neighborhood Welcome Coffee"
  }
}
```

## `GET /api/admin/submissions`

Returns community submissions for moderation. Supports an optional `status` query parameter.

## `POST /api/admin/submissions`

Updates a submission status.

```json
{
  "submissionId": "submission-1",
  "action": "approve",
  "moderationNote": "Looks good",
  "reviewedBy": "admin"
}
```

## `GET /api/admin/flagged`

Returns low-confidence or frequently-reported records for moderation.

## `POST /api/admin/flagged`

Suppresses an event from discovery results.

```json
{
  "event_id": "uuid",
  "note": "optional"
}
```

## `GET /api/admin/trusted-sources`

Returns the curated source allowlist.

## `POST /api/admin/trusted-sources`

Adds or updates a trusted source entry.

```json
{
  "source_type": "domain",
  "source_value": "www.example.com",
  "source_family": "calendar",
  "notes": "optional",
  "active": true
}
```

## `DELETE /api/admin/trusted-sources`

Deactivates a trusted source entry by id.

```json
{
  "id": "trusted-domain-example-calendar"
}
```

or `DELETE /api/admin/trusted-sources?id=trusted-domain-example-calendar`.

## `GET /api/health`

Basic service/config health snapshot for uptime checks.

Returns a `sourceHealth` snapshot with provider readiness, configuration notes, warnings/errors, and per-source counters for curated and community submissions when available.

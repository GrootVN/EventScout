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

## `GET /api/health`

Basic service/config health snapshot for uptime checks.

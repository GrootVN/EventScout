# Operations and Observability (MVP)

## Core metrics

- Ingestion success rate per source
- Ingestion processing duration (p50/p95)
- Geocoding failure rate
- Duplicate merge rate
- API p95 latency (`GET /api/events`)
- Queue depth / oldest job age

## Alert rules

- Source ingestion failures > 3 consecutive runs
- Queue backlog older than 30 minutes
- Event freshness lag > 60 minutes
- API error rate > 5% over 5 minutes
- API p95 > 500ms sustained for 15 minutes

## Runbooks

1. Source outage:
   - Verify source health check logs.
   - Pause failing source queue jobs.
   - Keep other sources running and notify status.
2. Geocode degradation:
   - Check geocoding API quota and error responses.
   - Temporarily increase unresolved quarantine threshold review.
3. Relevance dip:
   - Inspect feedback spikes and top suppressed events.
   - Tune ranking weights and confidence thresholds.


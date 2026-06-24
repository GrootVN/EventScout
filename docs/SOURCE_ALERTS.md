# Source Alerts

M19 adds deterministic source health alerts on top of existing source health snapshots and source-run history.

Source alerts are visible inside Event Scout through the health dashboard, the admin API, and aggregator QA reports. They do not send email, Slack, SMS, webhooks, or push notifications.

## What Alerts Do

Alerts evaluate existing source reliability signals:

- Provider configuration state from source health.
- Provider errors and warnings from health snapshots and source-run history.
- Source-run freshness.
- Provider contribution, drop-rate, and streak trends.
- Production safety checks such as missing `ADMIN_TOKEN` or unsafe sample-data flags.

Alert IDs are deterministic. The same input produces the same alert IDs and ordering.

## Severity Levels

- `critical`: source reliability or production safety issue that needs prompt review.
- `warning`: degraded source quality, stale history, repeated warnings, or meaningful contribution drops.
- `info`: low-risk operational note. The current implementation keeps this quiet by default.

## Categories

- `configuration`: enabled source lacks required config.
- `runtime`: provider warning/error streaks or contribution failures.
- `freshness`: source-run history is missing or stale.
- `production-safety`: production environment safety checks.
- `data-quality`: high drop rates or invalid source data patterns.

## Default Thresholds

| Threshold | Default |
| --- | ---: |
| Warning streak | 3 runs |
| Error streak | 2 runs |
| Drop-rate warning | 30% |
| Stale run | 24 hours |
| No-contribution streak | 3 runs |
| Sharp contribution drop | 70% |

## Public And Admin Visibility

The `/health` page shows a public alert summary:

- total active alerts
- severity counts
- generic critical-alert messaging

Detailed alert messages, provider IDs, recommended actions, and safe evidence are shown only when detailed health is available or admin authorization is provided in production.

## Admin API

Admin source alerts are available at:

```text
GET /api/admin/source-alerts
```

The route uses the same admin token behavior as other admin APIs. Pass the token with `x-admin-token` or the `key` query parameter.

The response includes:

- `generatedAt`
- `thresholds`
- `summary`
- `alerts`

The route does not mutate source-run history and does not perform live network calls.

## Aggregator QA

`npm run qa:aggregator` includes an alert summary in both JSON and HTML output:

- total active alerts
- critical count
- warning count
- info count

QA does not fail on alerts by default. Generated QA artifacts remain ignored by Git.

## Known Limitations

- Alerts are evaluated at request/report time; there is no background scheduler.
- Alert acknowledgement is not implemented.
- Alert history is not persisted separately from source-run history.
- Source-run freshness depends on source-run history being enabled and populated.
- Provider-specific remediation automation is not implemented.

## Future Work

- Email, Slack, webhook, or other delivery channels.
- Persistent alert acknowledgement and suppression.
- Database-backed alert history.
- Provider-specific remediation workflows.
- Stricter CI or deployment gates for critical alerts, if the project later chooses that policy.

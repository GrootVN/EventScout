# City Presets

Event Scout can load a local city preset to bundle together a launch-city set of source configs.

## Current preset

`cincinnati` is the active preset in this repo.

It currently includes:

- 6 placeholder source entries
- 1 disabled Ticketmaster preset stub

The current URLs are intentionally placeholder URLs. They are present so the team can validate the preset shape and report on what still needs real-world verification.

The active preset is used by:

- `apps/web/config/ics-sources.ts`
- `apps/web/config/rss-sources.ts`
- `apps/web/lib/events/aggregatorQa.ts`
- `apps/web/app/sources/page.tsx`
- `apps/web/lib/events/cityPresetQa.ts`

## Enable it

```bash
ENABLE_CITY_PRESETS=true
DEFAULT_CITY_PRESET="cincinnati"
npm run qa:aggregator
```

## How it works

- Preset source configs are merged with any `ICS_SOURCE_URLS` or `RSS_SOURCE_URLS` entries.
- Disabled example sources stay in the preset definition for documentation, but they do not enter the active provider list.
- Every active source keeps its original source URL and source name.

## Validation statuses

The city preset QA report uses these labels:

- `verified`
- `placeholder`
- `disabled`
- `needs_review`

The report helps decide whether a source should be kept, replaced, disabled, or promoted to verified status.

By default, the report does not fetch remote URLs. Enable live validation only when you want to test non-placeholder entries:

```bash
CITY_PRESET_QA_LIVE_FETCH=true
npm run qa:city-preset
```

## Source transparency

The source page shows:

- Whether a city preset is active
- How many ICS and RSS sources are active in the preset
- Each preset source entry, including planned/disabled examples
- The source QA report can be generated separately with `npm run qa:city-preset`

## Known limitations

- Source URLs in the preset are documented placeholders until verified against real public feeds.
- The preset does not add new providers by itself; it only supplies config to the existing ICS and RSS adapters.
- Ticketmaster remains off unless explicitly enabled.

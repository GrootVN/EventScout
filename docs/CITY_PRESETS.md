# City Presets

Event Scout can load a local city preset to bundle together a launch-city set of source configs.

## Current preset

`cincinnati` is the active preset in this repo.

It currently includes:

- 2 enabled ICS sources
- 2 enabled RSS sources
- 1 disabled ICS example
- 1 disabled RSS example
- A disabled Ticketmaster preset stub

The active preset is used by:

- `apps/web/config/ics-sources.ts`
- `apps/web/config/rss-sources.ts`
- `apps/web/lib/events/aggregatorQa.ts`
- `apps/web/app/sources/page.tsx`

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

## Source transparency

The source page shows:

- Whether a city preset is active
- How many ICS and RSS sources are active in the preset
- Each preset source entry, including planned/disabled examples

## Known limitations

- Source URLs in the preset are documented placeholders until verified against real public feeds.
- The preset does not add new providers by itself; it only supplies config to the existing ICS and RSS adapters.
- Ticketmaster remains off unless explicitly enabled.

# Deduplication

## Problem

The same event may appear on multiple sources:

- Ticketmaster
- Venue website
- Instagram post
- City calendar
- Meetup repost

The app should avoid showing duplicate cards while preserving every source link.

## Matching signals

- Similar title
- Same date
- Same start time
- Same venue
- Same address
- Same source URL

## MVP dedupe rule

Events are duplicates if:

- normalized titles are highly similar
- start date is the same
- venue or address is the same

## Output

Merged event should contain:

- canonical event fields
- all source URLs
- all source names
- confidence score

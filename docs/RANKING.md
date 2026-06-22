# Ranking

## Goal

Rank events for a user who is new to town.

## Inputs

- User city
- User interests
- Date range
- Distance preference
- Price preference
- Vibe preference
- Event source trust
- Event freshness

## MVP ranking formula

```ts
score =
  interestMatch * 0.35 +
  dateSoonness * 0.20 +
  distanceScore * 0.15 +
  sourceTrust * 0.15 +
  affordability * 0.10 +
  newcomerBoost * 0.05;
```

## Newcomer-friendly boost

Boost events that are:

- beginner-friendly
- social
- free or cheap
- recurring
- hosted by community groups
- good for solo attendance

## Ranking rules

- Never hide events only because score is low.
- Always allow chronological sorting.
- Always allow distance sorting.
- Ranking must be deterministic and tested.

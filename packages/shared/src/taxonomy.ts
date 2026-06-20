import { EventCategory } from "./types";

const categoryMap: Record<string, EventCategory> = {
  concert: "music",
  dj: "music",
  band: "music",
  restaurant: "food",
  dinner: "food",
  brunch: "food",
  basketball: "sports",
  soccer: "sports",
  run: "sports",
  hackathon: "tech",
  startup: "tech",
  programming: "tech",
  gallery: "arts",
  theater: "arts",
  comedy: "arts",
  meetup: "networking",
  conference: "networking",
  volunteer: "community",
  neighborhood: "community"
};

export function mapCategories(raw: string[]): EventCategory[] {
  const normalized = raw
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => categoryMap[entry] ?? "other");
  return Array.from(new Set(normalized));
}

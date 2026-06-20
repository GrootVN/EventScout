const KEYWORD_TAGS: Array<{ terms: string[]; tags: string[] }> = [
  { terms: ["coffee", "cowork", "startup", "product", "developer"], tags: ["tech", "networking", "professional"] },
  { terms: ["salsa", "dance", "dj", "party"], tags: ["nightlife", "social", "music", "beginner-friendly"] },
  { terms: ["run", "hike", "yoga", "fitness"], tags: ["fitness", "outdoors", "wellness"] },
  { terms: ["market", "vendor", "popup"], tags: ["markets", "culture", "casual"] },
  { terms: ["book", "storytime", "reading"], tags: ["books", "quiet"] },
  { terms: ["family", "kids"], tags: ["family", "family-friendly"] },
  { terms: ["free"], tags: ["free", "cheap"] },
  { terms: ["beginner", "intro"], tags: ["beginner-friendly", "newcomer-friendly", "solo-friendly"] },
  { terms: ["picnic", "meetup", "social"], tags: ["social", "solo-friendly", "newcomer-friendly"] }
];

export function classifyInterests(input: {
  title: string;
  description: string | null;
  categories: string[];
  priceType: "free" | "paid" | "unknown";
}): string[] {
  const tags = new Set<string>(input.categories);
  const text = `${input.title} ${input.description ?? ""}`.toLowerCase();

  for (const rule of KEYWORD_TAGS) {
    if (rule.terms.some((term) => text.includes(term))) {
      for (const tag of rule.tags) {
        tags.add(tag);
      }
    }
  }

  if (input.priceType === "free") {
    tags.add("free");
    tags.add("cheap");
  }

  if (tags.has("networking") || tags.has("social") || tags.has("beginner-friendly")) {
    tags.add("newcomer-friendly");
    tags.add("solo-friendly");
  }

  return [...tags];
}

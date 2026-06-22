import { extractDeterministicDate } from "@/lib/events/extractDate";

type ParsedRssItem = {
  id: string | null;
  title: string | null;
  link: string | null;
  description: string | null;
  content: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  eventDate: string | null;
  endDateTime: string | null;
  timezone: string | null;
  venueName: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  categories: string[];
  rawProperties: Record<string, string[]>;
};

export type ParsedRssFeed = {
  format: "rss" | "atom" | null;
  feedTitle: string | null;
  feedDescription: string | null;
  items: ParsedRssItem[];
  warnings: string[];
};

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeText(value: string | null | undefined) {
  const cleaned = clean(value);
  if (!cleaned) {
    return null;
  }

  return clean(stripTags(decodeXmlEntities(cleaned)));
}

function extractTagValues(block: string, tagName: string) {
  const values: string[] = [];
  const escaped = escapeRegex(tagName);
  const regex = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "gi");
  for (const match of block.matchAll(regex)) {
    const value = normalizeText(match[1]);
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function extractSelfClosingAttributeValues(block: string, tagName: string, attributeName: string) {
  const values: string[] = [];
  const escapedTag = escapeRegex(tagName);
  const escapedAttribute = escapeRegex(attributeName);
  const regex = new RegExp(`<${escapedTag}\\b([^>]*)>`, "gi");
  for (const match of block.matchAll(regex)) {
    const attributes = match[1] ?? "";
    const attrMatch = attributes.match(
      new RegExp(`${escapedAttribute}\\s*=\\s*["']([^"']+)["']`, "i")
    );
    if (!attrMatch) {
      continue;
    }

    const value = normalizeText(attrMatch[1]);
    if (value) {
      values.push(value);
    }
  }
  return values;
}

function extractFirstTagValue(block: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const values = extractTagValues(block, tagName);
    if (values.length > 0) {
      return values[0] ?? null;
    }
  }

  return null;
}

function extractCategories(block: string) {
  const categories = new Set<string>();

  for (const value of extractTagValues(block, "category")) {
    categories.add(value.toLowerCase());
  }

  for (const value of extractSelfClosingAttributeValues(block, "category", "term")) {
    categories.add(value.toLowerCase());
  }

  return [...categories];
}

function extractLink(block: string) {
  const linkRegex = /<link\b([^>]*)>([\s\S]*?)<\/link>|<link\b([^>]*)\/>/gi;
  let fallbackText: string | null = null;

  for (const match of block.matchAll(linkRegex)) {
    const attributes = match[1] ?? match[3] ?? "";
    const attrMatch = attributes.match(/href\s*=\s*["']([^"']+)["']/i);
    if (attrMatch) {
      return normalizeText(attrMatch[1]);
    }

    const relMatch = attributes.match(/rel\s*=\s*["']([^"']+)["']/i);
    const text = normalizeText(match[2]);
    if (relMatch && relMatch[1]?.toLowerCase() === "alternate" && text) {
      return text;
    }
    if (!fallbackText && text) {
      fallbackText = text;
    }
  }

  return fallbackText;
}

function extractFeedBlock(xml: string) {
  const rssMatch = xml.match(/<rss\b[\s\S]*?<channel\b[^>]*>([\s\S]*?)<\/channel>[\s\S]*?<\/rss>/i);
  if (rssMatch) {
    return {
      format: "rss" as const,
      block: rssMatch[1] ?? "",
      feedText: rssMatch[0]
    };
  }

  const atomMatch = xml.match(/<feed\b[^>]*>([\s\S]*?)<\/feed>/i);
  if (atomMatch) {
    return {
      format: "atom" as const,
      block: atomMatch[1] ?? "",
      feedText: atomMatch[0]
    };
  }

  return {
    format: null,
    block: xml,
    feedText: xml
  };
}

function extractItemBlocks(block: string, format: "rss" | "atom" | null) {
  const tagName = format === "atom" ? "entry" : "item";
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\/${tagName}>`, "gi");
  return [...block.matchAll(regex)].map((match) => match[1] ?? "");
}

function parseItem(block: string) {
  const title = extractFirstTagValue(block, ["title"]);
  const description = extractFirstTagValue(block, ["description", "summary", "content:encoded", "content"]);
  const content = extractFirstTagValue(block, ["content:encoded", "content"]);
  const link = extractLink(block);
  const id = extractFirstTagValue(block, ["guid", "id"]);
  const publishedAt = extractDeterministicDate([
    extractFirstTagValue(block, ["pubDate", "published", "dc:date"])
  ]);
  const updatedAt = extractDeterministicDate([extractFirstTagValue(block, ["updated", "modified"])]);
  const eventDate = extractDeterministicDate([
    extractFirstTagValue(block, [
      "event:startDate",
      "event:start",
      "event:date",
      "startDateTime",
      "startDate",
      "start",
      "date",
      "dtstart"
    ]),
    description,
    content
  ]);
  const endDateTime = extractDeterministicDate([
    extractFirstTagValue(block, ["event:endDate", "event:end", "endDateTime", "endDate", "dtend"])
  ]);
  const timezone = extractFirstTagValue(block, ["timezone", "timeZone", "tzid"]);
  const venueName = extractFirstTagValue(block, ["venueName", "venue", "location"]);
  const address = extractFirstTagValue(block, ["address"]);
  const city = extractFirstTagValue(block, ["city"]);
  const region = extractFirstTagValue(block, ["region", "state"]);
  const country = extractFirstTagValue(block, ["country"]);
  const categories = extractCategories(block);

  return {
    id,
    title,
    link,
    description,
    content,
    publishedAt,
    updatedAt,
    eventDate,
    endDateTime,
    timezone,
    venueName,
    address,
    city,
    region,
    country,
    categories,
    rawProperties: {
      id: extractTagValues(block, "guid").concat(extractTagValues(block, "id")),
      title: extractTagValues(block, "title"),
      link: extractTagValues(block, "link"),
      description: extractTagValues(block, "description"),
      summary: extractTagValues(block, "summary"),
      content: extractTagValues(block, "content"),
      categories: extractTagValues(block, "category"),
      pubDate: extractTagValues(block, "pubDate"),
      published: extractTagValues(block, "published"),
      updated: extractTagValues(block, "updated"),
      eventStartDate: [
        ...extractTagValues(block, "event:startDate"),
        ...extractTagValues(block, "event:start"),
        ...extractTagValues(block, "event:date"),
        ...extractTagValues(block, "startDateTime"),
        ...extractTagValues(block, "startDate"),
        ...extractTagValues(block, "start"),
        ...extractTagValues(block, "date"),
        ...extractTagValues(block, "dtstart")
      ]
    }
  };
}

export function parseRssFeed(xml: string): ParsedRssFeed {
  const warnings: string[] = [];
  const cleanedXml = clean(xml);

  if (!cleanedXml) {
    return {
      format: null,
      feedTitle: null,
      feedDescription: null,
      items: [],
      warnings: ["RSS feed was empty."]
    };
  }

  const feedBlock = extractFeedBlock(cleanedXml);
  const feedTitle = extractFirstTagValue(feedBlock.block, ["title"]);
  const feedDescription = extractFirstTagValue(feedBlock.block, ["description", "subtitle"]);
  const itemBlocks = extractItemBlocks(feedBlock.block, feedBlock.format);

  if (itemBlocks.length === 0) {
    warnings.push("RSS feed did not contain any item or entry records.");
  }

  const items = itemBlocks.map((itemBlock) => parseItem(itemBlock));

  return {
    format: feedBlock.format,
    feedTitle,
    feedDescription,
    items,
    warnings
  };
}

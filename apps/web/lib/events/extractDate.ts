const ISO_DATE_TIME_PATTERN =
  /\b(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?\b/;
const SLASH_DATE_PATTERN = /\b(\d{4})\/(\d{2})\/(\d{2})\b/;
const US_DATE_PATTERN = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const MONTH_NAMES =
  "january february march april may june july august september october november december".split(" ");

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function monthIndex(name: string) {
  return MONTH_NAMES.indexOf(name.toLowerCase()) + 1;
}

function parseOffsetMinutes(value: string) {
  if (value === "Z" || value === "UTC") {
    return 0;
  }

  const match = value.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return sign * (hours * 60 + minutes);
}

function toIsoFromLocalDate(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
  offsetMinutes: number | null = null
) {
  if (offsetMinutes === null) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000).toISOString();
}

function parseMonthNameDate(value: string) {
  const match = value.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})(?:\s+(?:at\s+)?)?(?:(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM))?(?:\s*(Z|UTC|[+-]\d{2}:?\d{2}))?\b/i
  );
  if (!match) {
    return null;
  }

  const [, monthName, day, year, hour, minute, second, meridiem, offsetValue] = match;
  const month = monthIndex(monthName);
  if (month < 1) {
    return null;
  }

  let resolvedHour = hour ? Number(hour) : 12;
  const resolvedMinute = minute ? Number(minute) : 0;
  const resolvedSecond = second ? Number(second) : 0;
  const offsetMinutes = offsetValue ? parseOffsetMinutes(offsetValue.toUpperCase()) : null;

  if (meridiem) {
    const isPm = meridiem.toUpperCase() === "PM";
    if (resolvedHour === 12) {
      resolvedHour = isPm ? 12 : 0;
    } else if (isPm) {
      resolvedHour += 12;
    }
  }

  return toIsoFromLocalDate(
    Number(year),
    month,
    Number(day),
    resolvedHour,
    resolvedMinute,
    resolvedSecond,
    offsetMinutes
  );
}

function parseDirectDateToken(value: string) {
  const cleaned = clean(value);
  if (!cleaned) {
    return null;
  }

  const isoLike = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/
  );
  if (isoLike) {
    const [, year, month, day, hour, minute, second, offsetValue] = isoLike;
    if (!hour) {
      return toIsoFromLocalDate(Number(year), Number(month), Number(day));
    }

    const offsetMinutes = offsetValue ? parseOffsetMinutes(offsetValue.toUpperCase()) : null;
    return toIsoFromLocalDate(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "00"),
      offsetMinutes
    );
  }

  const slashDate = cleaned.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (slashDate) {
    return toIsoFromLocalDate(Number(slashDate[1]), Number(slashDate[2]), Number(slashDate[3]));
  }

  const usDate = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDate) {
    return toIsoFromLocalDate(Number(usDate[3]), Number(usDate[1]), Number(usDate[2]));
  }

  const monthNameDate = parseMonthNameDate(cleaned);
  if (monthNameDate) {
    return monthNameDate;
  }

  return null;
}

function extractEmbeddedDateToken(value: string) {
  const cleaned = clean(value);
  if (!cleaned) {
    return null;
  }

  const patterns = [ISO_DATE_TIME_PATTERN, SLASH_DATE_PATTERN, US_DATE_PATTERN];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match) {
      continue;
    }

    const candidate = match[0];
    const parsed = parseDirectDateToken(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return parseMonthNameDate(cleaned);
}

export function parseDeterministicDate(value: string) {
  return parseDirectDateToken(value) ?? extractEmbeddedDateToken(value);
}

export function extractDeterministicDate(values: Array<string | null | undefined>) {
  for (const value of values) {
    const parsed = value ? parseDeterministicDate(value) : null;
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

type IcsProperty = {
  name: string;
  value: string;
  params: Record<string, string[]>;
};

type IcsEventRecord = {
  values: Record<string, string[]>;
  params: Record<string, Record<string, string[]>>;
};

export type ParsedIcsEvent = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  timezone: string | null;
  location: string | null;
  venueName: string | null;
  address: string | null;
  url: string | null;
  categories: string[];
  recurrenceRule: string | null;
  isRecurring: boolean;
  rawProperties: Record<string, string[]>;
};

export type ParsedIcsCalendar = {
  events: ParsedIcsEvent[];
  warnings: string[];
};

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function unfoldIcsText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").reduce<string[]>((lines, line) => {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] = `${lines[lines.length - 1]}${line.slice(1)}`;
      return lines;
    }

    lines.push(line);
    return lines;
  }, []);
}

function unescapeIcsText(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parsePropertyParams(rawParams: string) {
  if (!rawParams) {
    return {};
  }

  return rawParams.split(";").reduce<Record<string, string[]>>((params, segment) => {
    const separatorIndex = segment.indexOf("=");
    if (separatorIndex < 0) {
      return params;
    }

    const key = segment.slice(0, separatorIndex).trim().toUpperCase();
    const value = segment.slice(separatorIndex + 1);
    if (!key) {
      return params;
    }

    params[key] = value
      .split(",")
      .map((entry) => unescapeIcsText(entry))
      .filter((entry) => entry.length > 0);
    return params;
  }, {});
}

function parseProperty(line: string): IcsProperty | null {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  const rawName = line.slice(0, separatorIndex);
  const value = unescapeIcsText(line.slice(separatorIndex + 1));
  const paramSeparatorIndex = rawName.indexOf(";");
  const name = (paramSeparatorIndex >= 0 ? rawName.slice(0, paramSeparatorIndex) : rawName).trim().toUpperCase();
  const rawParams = paramSeparatorIndex >= 0 ? rawName.slice(paramSeparatorIndex + 1) : "";

  if (!name) {
    return null;
  }

  return {
    name,
    value,
    params: parsePropertyParams(rawParams)
  };
}

function parseDateParts(value: string) {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})?(\d{2})?(?:\.\d{1,3})?(Z)?)?$/
  );
  if (!match) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00", zulu = ""] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    zulu: zulu === "Z"
  };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const zonedDate = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second)
  );

  return zonedDate - date.getTime();
}

function toIsoDateTime(value: string, timezone: string | null) {
  const parts = parseDateParts(value);
  if (!parts) {
    return null;
  }

  if (!value.includes("T")) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toISOString();
  }

  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  if (parts.zulu || !timezone) {
    return new Date(utcGuess).toISOString();
  }

  try {
    const firstOffset = getTimeZoneOffset(new Date(utcGuess), timezone);
    const firstPass = utcGuess - firstOffset;
    const secondOffset = getTimeZoneOffset(new Date(firstPass), timezone);
    const finalTime = firstOffset === secondOffset ? firstPass : utcGuess - secondOffset;
    return new Date(finalTime).toISOString();
  } catch {
    return new Date(utcGuess).toISOString();
  }
}

function splitLocation(value: string) {
  const separators = ["\n", " | ", " - ", " @ "];
  for (const separator of separators) {
    if (value.includes(separator)) {
      const [venueName, ...rest] = value.split(separator);
      const address = rest.join(separator).trim();
      return {
        venueName: clean(venueName) || null,
        address: clean(address) || null
      };
    }
  }

  return {
    venueName: clean(value) || null,
    address: null
  };
}

function normalizeCategories(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))];
}

function getValues(record: IcsEventRecord, name: string) {
  return record.values[name] ?? [];
}

function getValue(record: IcsEventRecord, name: string) {
  return clean(getValues(record, name)[0]);
}

function getParams(record: IcsEventRecord, name: string) {
  return record.params[name] ?? {};
}

function addProperty(record: IcsEventRecord, property: IcsProperty) {
  record.values[property.name] = [...(record.values[property.name] ?? []), property.value];
  record.params[property.name] = property.params;
}

function createRecord(): IcsEventRecord {
  return {
    values: {},
    params: {}
  };
}

function buildEvent(record: IcsEventRecord): ParsedIcsEvent {
  const uid = getValue(record, "UID");
  const summary = getValue(record, "SUMMARY");
  const description = getValue(record, "DESCRIPTION");
  const location = getValue(record, "LOCATION");
  const url = getValue(record, "URL");
  const recurrenceRule = getValue(record, "RRULE");
  const startRaw = getValue(record, "DTSTART");
  const endRaw = getValue(record, "DTEND");
  const startParams = getParams(record, "DTSTART");
  const endParams = getParams(record, "DTEND");
  const timezone =
    clean(startParams.TZID?.[0]) ||
    clean(endParams.TZID?.[0]) ||
    getValue(record, "X-WR-TIMEZONE") ||
    null;
  const startDateTime = startRaw ? toIsoDateTime(startRaw, timezone) : null;
  const endDateTime = endRaw ? toIsoDateTime(endRaw, timezone) : null;
  const locationParts = location ? splitLocation(location) : { venueName: null, address: null };
  const categories = normalizeCategories(
    getValues(record, "CATEGORIES")
      .flatMap((value) => value.split(","))
      .map((value) => clean(value))
  );
  const isRecurring = Boolean(
    recurrenceRule ||
      getValues(record, "RDATE").length > 0 ||
      getValues(record, "EXDATE").length > 0 ||
      getValues(record, "RECURRENCE-ID").length > 0
  );

  return {
    uid: uid || null,
    summary: summary || null,
    description: description || null,
    startDateTime,
    endDateTime,
    timezone,
    location: location || null,
    venueName: locationParts.venueName,
    address: locationParts.address,
    url: url || null,
    categories,
    recurrenceRule: recurrenceRule || null,
    isRecurring,
    rawProperties: record.values
  };
}

export function parseIcsCalendar(text: string): ParsedIcsCalendar {
  const warnings: string[] = [];
  const lines = unfoldIcsText(text);
  const events: ParsedIcsEvent[] = [];
  let currentRecord: IcsEventRecord | null = null;
  let sawEventBoundary = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.toUpperCase() === "BEGIN:VEVENT") {
      currentRecord = createRecord();
      sawEventBoundary = true;
      continue;
    }

    if (line.toUpperCase() === "END:VEVENT") {
      if (currentRecord) {
        events.push(buildEvent(currentRecord));
      }
      currentRecord = null;
      continue;
    }

    if (!currentRecord) {
      continue;
    }

    const property = parseProperty(line);
    if (!property) {
      warnings.push(`Skipped malformed ICS line: ${line}`);
      continue;
    }

    addProperty(currentRecord, property);
  }

  if (sawEventBoundary && events.length === 0) {
    warnings.push("ICS calendar did not yield any usable VEVENT records.");
  }

  return {
    events,
    warnings
  };
}

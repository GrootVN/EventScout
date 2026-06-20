export type DatePreset = "tonight" | "tomorrow" | "this-weekend" | "this-month" | "custom";

export function getDateRangeFromPreset(
  preset: DatePreset,
  now = new Date("2026-06-19T12:00:00.000Z")
) {
  const start = new Date(now);
  const end = new Date(now);

  if (preset === "tonight") {
    start.setUTCHours(17, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(4, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (preset === "tomorrow") {
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() + 2);
    end.setUTCHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (preset === "this-weekend") {
    const day = start.getUTCDay();
    const untilFriday = (5 - day + 7) % 7;
    start.setUTCDate(start.getUTCDate() + untilFriday);
    start.setUTCHours(17, 0, 0, 0);
    end.setUTCDate(start.getUTCDate() + 3);
    end.setUTCHours(6, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (preset === "this-month") {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCMonth(end.getUTCMonth() + 1, 1);
    end.setUTCHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  return { start: undefined, end: undefined };
}

export function formatEventDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateString));
}

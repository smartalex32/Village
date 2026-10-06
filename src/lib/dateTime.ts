export function householdDateKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatHouseholdDate(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(undefined, { timeZone, ...options }).format(
    new Date(value),
  );
}

export type HouseholdDateTime = {
  date: string;
  time: string;
  occurrence?: string;
};

export function householdDateTime(
  value: string | Date,
  timeZone: string,
): HouseholdDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export type HouseholdDateTimeResult = {
  iso?: string;
  error?: string;
  ambiguous?: boolean;
  occurrences?: string[];
};

export function resolveHouseholdDateTime(
  value: HouseholdDateTime,
  timeZone: string,
  preferredInstant?: string,
): HouseholdDateTimeResult {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(value.time.trim());
  if (!dateMatch) return { error: "Enter a date as YYYY-MM-DD." };
  const [, yearText, monthText, dayText] = dateMatch;
  const [year, month, day] = [
    Number(yearText),
    Number(monthText),
    Number(dayText),
  ];
  const local = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day
  )
    return { error: "Enter a valid calendar date." };
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59)
    return { error: "Enter a time as HH:MM using the 24-hour clock." };
  const date = value.date.trim();
  const time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
  const wallClock = Date.UTC(
    year,
    month - 1,
    day,
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  try {
    const offsets = new Set<number>();
    for (let hours = -36; hours <= 36; hours += 6) {
      const instant = wallClock + hours * 3600000;
      const nearby = householdDateTime(new Date(instant), timeZone);
      offsets.add(Date.parse(`${nearby.date}T${nearby.time}:00Z`) - instant);
    }
    const candidates = [...offsets]
      .map((offset) => wallClock - offset)
      .filter((instant) => {
        const rendered = householdDateTime(new Date(instant), timeZone);
        return rendered.date === date && rendered.time === time;
      })
      .sort((a, b) => a - b);
    if (!candidates.length)
      return {
        error:
          "This time does not exist because the clocks move forward. Choose another time.",
      };
    const preference = value.occurrence ?? preferredInstant;
    const preferred = preference
      ? householdDateTime(preference, timeZone)
      : undefined;
    const iso =
      preferred?.date === date && preferred.time === time
        ? preference
        : new Date(candidates[0]).toISOString();
    return {
      iso,
      ambiguous: candidates.length > 1,
      occurrences: candidates.map((instant) => new Date(instant).toISOString()),
    };
  } catch {
    return { error: "The household timezone is invalid." };
  }
}

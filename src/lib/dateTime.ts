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

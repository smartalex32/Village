import { householdDateKey } from "./dateTime";

describe("household timezone rendering", () => {
  test("uses the household date rather than the device or UTC date", () => {
    expect(householdDateKey("2026-09-06T04:30:00Z", "America/Chicago")).toBe(
      "2026-09-05",
    );
    expect(householdDateKey("2026-09-06T04:30:00Z", "Asia/Tokyo")).toBe(
      "2026-09-06",
    );
  });

  test("keeps both sides of the daylight-saving jump on the same local day", () => {
    expect(householdDateKey("2026-03-08T07:30:00Z", "America/Chicago")).toBe(
      "2026-03-08",
    );
    expect(householdDateKey("2026-03-08T08:30:00Z", "America/Chicago")).toBe(
      "2026-03-08",
    );
  });
});

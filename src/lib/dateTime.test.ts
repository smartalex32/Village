import {
  householdDateKey,
  householdDateTime,
  resolveHouseholdDateTime,
} from "./dateTime";

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

describe("household scheduling", () => {
  test("renders household wall clock fields and resolves fractional UTC offsets", () => {
    expect(
      householdDateTime("2026-09-06T04:30:00Z", "America/Chicago"),
    ).toEqual({ date: "2026-09-05", time: "23:30" });
    const value = { date: "2026-09-06", time: "15:15" };
    expect(resolveHouseholdDateTime(value, "America/Chicago").iso).toBe(
      "2026-09-06T20:15:00.000Z",
    );
    expect(resolveHouseholdDateTime(value, "Asia/Kathmandu").iso).toBe(
      "2026-09-06T09:30:00.000Z",
    );
  });
  test.each([
    { date: "2026-02-30", time: "12:00" },
    { date: "2026-13-01", time: "12:00" },
    { date: "2026-02-01", time: "24:00" },
    { date: "2026-02-01", time: "12:60" },
    { date: "", time: "12:00" },
    { date: "2026-02-01", time: "" },
  ])("rejects invalid calendar dates and times: %j", (value) => {
    expect(
      resolveHouseholdDateTime(value, "America/Chicago").error,
    ).toBeTruthy();
    expect(
      resolveHouseholdDateTime(value, "America/Chicago").iso,
    ).toBeUndefined();
  });
  test("rejects spring clock gaps including half-hour transitions", () => {
    expect(
      resolveHouseholdDateTime(
        { date: "2026-03-08", time: "02:30" },
        "America/Chicago",
      ).error,
    ).toMatch(/does not exist/);
    expect(
      resolveHouseholdDateTime(
        { date: "2026-10-04", time: "02:15" },
        "Australia/Lord_Howe",
      ).iso,
    ).toBeUndefined();
    expect(
      resolveHouseholdDateTime(
        { date: "2026-10-04", time: "02:45" },
        "Australia/Lord_Howe",
      ).iso,
    ).toBe("2026-10-03T15:45:00.000Z");
  });
  test("preserves an existing fall clock occurrence and allows choosing the later one", () => {
    const value = { date: "2026-11-01", time: "01:30" };
    const result = resolveHouseholdDateTime(value, "America/Chicago");
    expect(result).toMatchObject({
      iso: "2026-11-01T06:30:00.000Z",
      ambiguous: true,
    });
    expect(result.occurrences).toEqual([
      "2026-11-01T06:30:00.000Z",
      "2026-11-01T07:30:00.000Z",
    ]);
    expect(
      resolveHouseholdDateTime(value, "America/Chicago", "2026-11-01T07:30:25Z")
        .iso,
    ).toBe("2026-11-01T07:30:25Z");
    expect(
      resolveHouseholdDateTime(
        { ...value, occurrence: result.occurrences![1] },
        "America/Chicago",
      ).iso,
    ).toBe(result.occurrences![1]);
  });
});

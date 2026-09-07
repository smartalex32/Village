import { formatDateInput, isValidDateInput } from "./dateInput";

describe("calendar date input", () => {
  test("adds ISO separators to an eight-digit date", () => {
    expect(formatDateInput("20180412")).toBe("2018-04-12");
  });

  test("keeps a formatted ISO date unchanged", () => {
    expect(formatDateInput("2018-04-12")).toBe("2018-04-12");
  });

  test("rejects impossible or incomplete dates", () => {
    expect(isValidDateInput("2018-02-29")).toBe(false);
    expect(isValidDateInput("2018-04")).toBe(false);
    expect(isValidDateInput("2018-04-12")).toBe(true);
    expect(isValidDateInput("")).toBe(true);
  });
});

import { todaySummaryLimits } from "./todayLayout";

describe("Today responsive summary limits", () => {
  test("always keeps one schedule and attention item on a small phone", () => {
    expect(todaySummaryLimits(667, 2)).toEqual({ schedule: 1, attention: 1 });
  });

  test("reveals more summary items as vertical room increases", () => {
    expect(todaySummaryLimits(844, 2)).toEqual({ schedule: 2, attention: 1 });
    expect(todaySummaryLimits(932, 2)).toEqual({ schedule: 3, attention: 2 });
  });

  test("reserves room for additional child cards", () => {
    expect(todaySummaryLimits(932, 4)).toEqual({ schedule: 1, attention: 1 });
  });
});

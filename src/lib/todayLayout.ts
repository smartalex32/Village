export function todaySummaryLimits(viewportHeight: number, childCount: number) {
  const availableHeight = viewportHeight - Math.max(0, childCount - 2) * 90;

  return {
    schedule: availableHeight >= 900 ? 3 : availableHeight >= 780 ? 2 : 1,
    attention: availableHeight >= 900 ? 2 : 1,
  };
}

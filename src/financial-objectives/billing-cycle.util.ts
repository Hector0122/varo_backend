// A billing cycle runs from `statementDay` of one month to `statementDay` of the next.
// statementDay=1 reproduces a plain calendar month, so debts without a configured
// cutoff date keep behaving exactly as before.
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDayOfMonth));
}

export function getBillingCycleStart(date: Date, statementDay: number): Date {
  const month =
    date.getDate() >= statementDay ? date.getMonth() : date.getMonth() - 1;
  return clampToMonth(date.getFullYear(), month, statementDay);
}

export function addCycles(
  cycleStart: Date,
  cycles: number,
  statementDay: number,
): Date {
  return clampToMonth(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + cycles,
    statementDay,
  );
}

export function getCurrentBillingPeriod(
  statementDay: number,
  now: Date = new Date(),
) {
  const periodStart = getBillingCycleStart(now, statementDay);
  const periodEnd = addCycles(periodStart, 1, statementDay);
  return { periodStart, periodEnd };
}

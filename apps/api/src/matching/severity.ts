import type { Severity } from '@alerts/shared';

// Each threshold the value reaches adds one level, starting from 1.
function severityFrom(value: number, thresholds: readonly number[]): Severity {
  return 1 + thresholds.filter((threshold) => value >= threshold).length;
}

export function marketSeverity(changePct: number): Severity {
  return severityFrom(Math.abs(changePct), [2, 5, 10, 20]);
}

export function earthquakeSeverity(magnitude: number): Severity {
  return severityFrom(magnitude, [5, 6, 7, 8]);
}

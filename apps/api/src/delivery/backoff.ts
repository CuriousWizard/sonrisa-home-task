// Wait after failed attempt n: baseMs * 2^(n-1), plus up to 10% jitter.
export function computeBackoff(
  attempt: number,
  baseMs: number,
  random: () => number,
): number {
  const delayMs = baseMs * 2 ** (attempt - 1);
  return delayMs + (random() * delayMs) / 10;
}

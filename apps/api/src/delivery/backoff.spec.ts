import { computeBackoff } from './backoff';

describe('computeBackoff', () => {
  const base = 1000;

  it('doubles the wait for each attempt when random is 0', () => {
    expect([1, 2, 3, 4].map((n) => computeBackoff(n, base, () => 0))).toEqual([
      1000, 2000, 4000, 8000,
    ]);
  });

  it('adds 10% when random is 1', () => {
    expect([1, 2, 3, 4].map((n) => computeBackoff(n, base, () => 1))).toEqual([
      1100, 2200, 4400, 8800,
    ]);
  });
});

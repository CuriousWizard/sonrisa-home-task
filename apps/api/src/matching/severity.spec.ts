import { earthquakeSeverity, marketSeverity } from './severity';

describe('marketSeverity', () => {
  it.each([
    [0, 1],
    [1.99, 1],
    [2, 2],
    [4.99, 2],
    [5, 3],
    [9.99, 3],
    [10, 4],
    [19.99, 4],
    [20, 5],
    [-1.99, 1],
    [-2, 2],
    [-20, 5],
  ])('changePct %s gives %s', (changePct, expected) => {
    expect(marketSeverity(changePct)).toBe(expected);
  });
});

describe('earthquakeSeverity', () => {
  it.each([
    [4.99, 1],
    [5, 2],
    [5.99, 2],
    [6, 3],
    [6.99, 3],
    [7, 4],
    [7.99, 4],
    [8, 5],
    [9.5, 5],
  ])('magnitude %s gives %s', (magnitude, expected) => {
    expect(earthquakeSeverity(magnitude)).toBe(expected);
  });
});

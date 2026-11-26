import { Severity } from './enums';

describe('Severity', () => {
  it.each([1, 5])('accepts %s', (value) => {
    expect(Severity.safeParse(value).success).toBe(true);
  });

  it.each([0, 6, 2.5])('rejects %s', (value) => {
    expect(Severity.safeParse(value).success).toBe(false);
  });
});

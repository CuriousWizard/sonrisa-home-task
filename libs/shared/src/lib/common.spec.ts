import { ListQuery } from './common';

describe('ListQuery', () => {
  it('defaults a missing limit to 50', () => {
    expect(ListQuery.parse({}).limit).toBe(50);
  });

  it('coerces a limit from a query string', () => {
    expect(ListQuery.parse({ limit: '20' }).limit).toBe(20);
  });

  it('rejects a limit of 500', () => {
    expect(ListQuery.safeParse({ limit: '500' }).success).toBe(false);
  });
});

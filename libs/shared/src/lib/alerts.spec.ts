import { AlertInput } from './alerts';

const base = {
  name: 'My alert',
  minSeverity: 3,
  targetIds: ['3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a3b'],
  enabled: true,
};
const marketFilters = { symbols: ['AAPL'], direction: 'up', minChangePct: 2 };

describe('AlertInput', () => {
  it.each([
    { category: 'news', filters: { keywords: ['earnings'] } },
    { category: 'market', filters: marketFilters },
    {
      category: 'disaster',
      filters: { types: ['earthquake'], regions: ['asia'], minMagnitude: 6 },
    },
  ])('accepts a valid $category alert', (branch) => {
    const result = AlertInput.safeParse({ ...base, ...branch });
    expect(result.success).toBe(true);
  });

  it('rejects market filters under category news', () => {
    const result = AlertInput.safeParse({
      ...base,
      category: 'news',
      filters: marketFilters,
    });
    expect(result.success).toBe(false);
  });

  it('rejects news filters that contain a nested category key', () => {
    const result = AlertInput.safeParse({
      ...base,
      category: 'news',
      filters: { keywords: ['earnings'], category: 'market' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an alert without enabled', () => {
    const { enabled: _enabled, ...withoutEnabled } = base;
    const result = AlertInput.safeParse({
      ...withoutEnabled,
      category: 'news',
      filters: { keywords: ['earnings'] },
    });
    expect(result.success).toBe(false);
  });
});

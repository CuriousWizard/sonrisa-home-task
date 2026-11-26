import { EventInput } from './events';

const disasterData = { type: 'flood', region: 'europe' };
const base = { title: 'River floods town', severity: 3 };

describe('EventInput', () => {
  it('accepts disaster data under category disaster', () => {
    const result = EventInput.safeParse({
      ...base,
      category: 'disaster',
      data: disasterData,
    });
    expect(result.success).toBe(true);
  });

  it('rejects disaster data under category market', () => {
    const result = EventInput.safeParse({
      ...base,
      category: 'market',
      data: disasterData,
    });
    expect(result.success).toBe(false);
  });

  it('rejects market data under category news', () => {
    const result = EventInput.safeParse({
      ...base,
      category: 'news',
      data: { symbol: 'X', price: 1, changePct: 1 },
    });
    expect(result.success).toBe(false);
  });
});

import { AlertInput, type AlertDto } from '@alerts/shared';
import {
  alertErrors,
  emptyAlertForm,
  fromAlertDto,
  toAlertInput,
  type AlertFormValue,
} from './alert-form';

const targetA = '00000000-0000-4000-8000-00000000000a';
const targetB = '00000000-0000-4000-8000-00000000000b';

function form(changes: Partial<AlertFormValue>): AlertFormValue {
  return {
    ...emptyAlertForm(),
    name: 'Watch',
    minSeverity: 3,
    targets: { [targetA]: true, [targetB]: false },
    ...changes,
  };
}

function dto(input: AlertInput): AlertDto {
  return {
    ...input,
    id: '00000000-0000-4000-8000-000000000001',
    createdAt: '2026-11-27T10:00:00.000Z',
    updatedAt: '2026-11-27T10:00:00.000Z',
  };
}

describe('toAlertInput', () => {
  it('builds news filters from one keyword per line, dropping blank lines', () => {
    const input = toAlertInput(
      form({
        category: 'news',
        news: { keywords: ' quake \n\nTokyo\r\n \n C++, Rust ' },
      }),
    );

    expect(input).toEqual({
      name: 'Watch',
      category: 'news',
      filters: { keywords: ['quake', 'Tokyo', 'C++, Rust'] },
      minSeverity: 3,
      targetIds: [targetA],
      enabled: true,
    });
    expect(AlertInput.safeParse(input).success).toBe(true);
  });

  it('sends an empty keyword list for blank text', () => {
    const input = toAlertInput(
      form({ category: 'news', news: { keywords: ' \n ' } }),
    );

    expect(input.filters).toEqual({ keywords: [] });
  });

  it('builds market filters and treats an empty minimum change as 0', () => {
    const input = toAlertInput(
      form({
        category: 'market',
        market: {
          symbols: 'AAPL, ,tsla ,',
          direction: 'down',
          minChangePct: null,
        },
      }),
    );

    expect(input).toMatchObject({
      category: 'market',
      filters: {
        symbols: ['AAPL', 'tsla'],
        direction: 'down',
        minChangePct: 0,
      },
    });
    expect(AlertInput.safeParse(input).success).toBe(true);
  });

  it('builds disaster filters from the checked flags and drops an empty magnitude', () => {
    const value = form({ category: 'disaster' });
    value.disaster.types.storm = true;
    value.disaster.types.earthquake = true;
    value.disaster.regions['north-america'] = true;

    const input = toAlertInput(value);

    expect(input).toMatchObject({
      category: 'disaster',
      filters: { types: ['earthquake', 'storm'], regions: ['north-america'] },
    });
    expect('minMagnitude' in input.filters).toBe(false);
    expect(AlertInput.safeParse(input).success).toBe(true);
  });

  it('keeps a disaster minimum magnitude when it is set', () => {
    const value = form({ category: 'disaster' });
    value.disaster.minMagnitude = 6.5;

    expect(toAlertInput(value).filters).toEqual({
      types: [],
      regions: [],
      minMagnitude: 6.5,
    });
  });

  it('fails validation without a checked target', () => {
    const input = toAlertInput(form({ targets: { [targetA]: false } }));
    const result = AlertInput.safeParse(input);

    expect(result.success).toBe(false);
    expect(alertErrors(result.error?.issues ?? [])).toEqual({
      targetIds: 'Choose from 1 to 20 targets.',
    });
  });

  it('keys filter issues by the filter field', () => {
    const input = toAlertInput(
      form({
        category: 'market',
        market: { symbols: '', direction: 'up', minChangePct: -1 },
      }),
    );
    const result = AlertInput.safeParse(input);

    expect(alertErrors(result.error?.issues ?? [])).toEqual({
      minChangePct: 'Enter a change of 0 or more.',
    });
  });
});

describe('fromAlertDto', () => {
  const inputs: AlertInput[] = [
    {
      name: 'Tech news',
      category: 'news',
      filters: { keywords: ['AI', 'chips'] },
      minSeverity: 2,
      targetIds: [targetA, targetB],
      enabled: true,
    },
    {
      name: 'Capital news',
      category: 'news',
      filters: { keywords: ['Washington, DC', 'Senate'] },
      minSeverity: 1,
      targetIds: [targetA],
      enabled: true,
    },
    {
      name: 'Big drops',
      category: 'market',
      filters: {
        symbols: ['AAPL', 'MSFT'],
        direction: 'down',
        minChangePct: 5,
      },
      minSeverity: 4,
      targetIds: [targetB],
      enabled: false,
    },
    {
      name: 'Quakes',
      category: 'disaster',
      filters: {
        types: ['earthquake', 'flood'],
        regions: ['asia', 'oceania'],
        minMagnitude: 6,
      },
      minSeverity: 1,
      targetIds: [targetA],
      enabled: true,
    },
    {
      name: 'Any disaster',
      category: 'disaster',
      filters: { types: [], regions: [] },
      minSeverity: 5,
      targetIds: [targetA],
      enabled: true,
    },
  ];

  it.each(inputs)('round trips the $category alert "$name"', (input) => {
    expect(toAlertInput(fromAlertDto(dto(input)))).toEqual(input);
  });

  it('writes keywords one per line and symbols as comma-separated text', () => {
    expect(fromAlertDto(dto(inputs[1])).news).toEqual({
      keywords: 'Washington, DC\nSenate',
    });

    const value = fromAlertDto(dto(inputs[2]));

    expect(value.market).toEqual({
      symbols: 'AAPL, MSFT',
      direction: 'down',
      minChangePct: 5,
    });
    expect(value.targets).toEqual({ [targetB]: true });
  });
});

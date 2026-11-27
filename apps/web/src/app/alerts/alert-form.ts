import {
  DisasterType,
  LIMITS,
  Region,
  type AlertDto,
  type AlertInput,
  type Category,
  type MarketDirection,
} from '@alerts/shared';
import { fieldErrors } from '../core/errors';

export const categoryLabels: Record<Category, string> = {
  news: 'News',
  market: 'Market',
  disaster: 'Disaster',
};

export const directionLabels: Record<MarketDirection, string> = {
  any: 'Any',
  up: 'Up',
  down: 'Down',
};

export const disasterTypeLabels: Record<DisasterType, string> = {
  earthquake: 'Earthquake',
  flood: 'Flood',
  storm: 'Storm',
  wildfire: 'Wildfire',
};

export const regionLabels: Record<Region, string> = {
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  'north-america': 'North America',
  'south-america': 'South America',
  oceania: 'Oceania',
};

// The raw value of the alert form. Lists are comma-separated text or one flag per option.
export interface AlertFormValue {
  name: string;
  category: Category;
  news: { keywords: string };
  market: {
    symbols: string;
    direction: MarketDirection;
    minChangePct: number | null;
  };
  disaster: {
    types: Record<DisasterType, boolean>;
    regions: Record<Region, boolean>;
    minMagnitude: number | null;
  };
  minSeverity: number;
  targets: Record<string, boolean>;
  enabled: boolean;
}

function flags<K extends string>(
  options: readonly K[],
  selected: readonly K[],
): Record<K, boolean> {
  return Object.fromEntries(
    options.map((option) => [option, selected.includes(option)]),
  ) as Record<K, boolean>;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function emptyAlertForm(): AlertFormValue {
  return {
    name: '',
    category: 'news',
    news: { keywords: '' },
    market: { symbols: '', direction: 'any', minChangePct: 0 },
    disaster: {
      types: flags(DisasterType.options, []),
      regions: flags(Region.options, []),
      minMagnitude: null,
    },
    minSeverity: 1,
    targets: {},
    enabled: true,
  };
}

// The result still needs AlertInput.safeParse, which reports the fields the user has to fix.
export function toAlertInput(value: AlertFormValue): AlertInput {
  const base = {
    name: value.name,
    minSeverity: value.minSeverity,
    targetIds: Object.keys(value.targets).filter((id) => value.targets[id]),
    enabled: value.enabled,
  };
  switch (value.category) {
    case 'news':
      return {
        ...base,
        category: 'news',
        filters: { keywords: splitList(value.news.keywords) },
      };
    case 'market':
      return {
        ...base,
        category: 'market',
        filters: {
          symbols: splitList(value.market.symbols),
          direction: value.market.direction,
          minChangePct: value.market.minChangePct ?? 0,
        },
      };
    case 'disaster': {
      const { types, regions, minMagnitude } = value.disaster;
      return {
        ...base,
        category: 'disaster',
        filters: {
          types: DisasterType.options.filter((type) => types[type]),
          regions: Region.options.filter((region) => regions[region]),
          ...(minMagnitude === null ? {} : { minMagnitude }),
        },
      };
    }
  }
}

export function fromAlertDto(alert: AlertDto): AlertFormValue {
  const value: AlertFormValue = {
    ...emptyAlertForm(),
    name: alert.name,
    category: alert.category,
    minSeverity: alert.minSeverity,
    targets: Object.fromEntries(alert.targetIds.map((id) => [id, true])),
    enabled: alert.enabled,
  };
  switch (alert.category) {
    case 'news':
      value.news = { keywords: alert.filters.keywords.join(', ') };
      break;
    case 'market':
      value.market = {
        symbols: alert.filters.symbols.join(', '),
        direction: alert.filters.direction,
        minChangePct: alert.filters.minChangePct,
      };
      break;
    case 'disaster':
      value.disaster = {
        types: flags(DisasterType.options, alert.filters.types),
        regions: flags(Region.options, alert.filters.regions),
        minMagnitude: alert.filters.minMagnitude ?? null,
      };
      break;
  }
  return value;
}

const errorMessages = {
  name: `Enter a name of up to ${LIMITS.name} characters.`,
  keywords: `Enter up to ${LIMITS.keywords} keywords of at most ${LIMITS.keyword} characters each.`,
  symbols: `Enter up to ${LIMITS.symbols} symbols of at most ${LIMITS.symbol} characters each.`,
  direction: 'Choose a direction.',
  minChangePct: 'Enter a change of 0 or more.',
  types: 'Choose from the listed types.',
  regions: 'Choose from the listed regions.',
  minMagnitude: 'Enter a number or leave the field empty.',
  minSeverity: 'Choose a severity from 1 to 5.',
  targetIds: `Choose from 1 to ${LIMITS.targetIds} targets.`,
};

export type AlertErrors = Partial<Record<keyof typeof errorMessages, string>>;

// Filter issues sit under filters.<key>, so the filters prefix is dropped to key them by field.
export function alertErrors(
  issues: readonly { path: readonly PropertyKey[] }[],
): AlertErrors {
  return fieldErrors(
    issues.map(({ path }) => ({
      path: path[0] === 'filters' ? path.slice(1) : path,
    })),
    errorMessages,
  );
}

export function summarizeFilters(alert: AlertInput): string {
  switch (alert.category) {
    case 'news': {
      const { keywords } = alert.filters;
      return keywords.length > 0
        ? `Keywords: ${keywords.join(', ')}`
        : 'Any news';
    }
    case 'market': {
      const { symbols, direction, minChangePct } = alert.filters;
      return [
        symbols.length > 0 ? symbols.join(', ') : 'Any symbol',
        direction === 'any' ? 'up or down' : direction,
        `${minChangePct}% or more`,
      ].join(' · ');
    }
    case 'disaster': {
      const { types, regions, minMagnitude } = alert.filters;
      const parts = [
        types.length > 0
          ? types.map((type) => disasterTypeLabels[type]).join(', ')
          : 'Any type',
        regions.length > 0
          ? regions.map((region) => regionLabels[region]).join(', ')
          : 'any region',
      ];
      if (minMagnitude !== undefined) {
        parts.push(`earthquakes from magnitude ${minMagnitude}`);
      }
      return parts.join(' · ');
    }
  }
}

import type {
  AlertInput,
  DisasterEventData,
  DisasterFilters,
  EventDto,
  MarketEventData,
  MarketFilters,
  NewsFilters,
} from '@alerts/shared';

type PickEach<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never;

// One branch per category, so data and filters stay paired with their category.
export type MatchEvent = PickEach<
  EventDto,
  'category' | 'title' | 'summary' | 'severity' | 'data'
>;
export type MatchAlert = PickEach<
  AlertInput,
  'category' | 'minSeverity' | 'filters'
>;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// \b only knows ASCII word characters, so it fails for keywords such as C++, $TSLA or café.
function keywordPattern(keyword: string): RegExp {
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])${escapeRegExp(keyword)}(?![\p{L}\p{N}])`,
    'iu',
  );
}

function matchesNews(
  event: { title: string; summary: string },
  filters: NewsFilters,
): boolean {
  if (filters.keywords.length === 0) {
    return true;
  }
  return filters.keywords.some((keyword) => {
    const pattern = keywordPattern(keyword);
    return pattern.test(event.title) || pattern.test(event.summary);
  });
}

function matchesMarket(data: MarketEventData, filters: MarketFilters): boolean {
  const symbol = data.symbol.toUpperCase();
  const symbolMatches =
    filters.symbols.length === 0 ||
    filters.symbols.some((candidate) => candidate.toUpperCase() === symbol);
  const directionMatches =
    filters.direction === 'any' ||
    (filters.direction === 'up' && data.changePct > 0) ||
    (filters.direction === 'down' && data.changePct < 0);
  return (
    symbolMatches &&
    directionMatches &&
    Math.abs(data.changePct) >= filters.minChangePct
  );
}

function matchesDisaster(
  data: DisasterEventData,
  filters: DisasterFilters,
): boolean {
  if (filters.types.length > 0 && !filters.types.includes(data.type)) {
    return false;
  }
  if (filters.regions.length > 0 && !filters.regions.includes(data.region)) {
    return false;
  }
  if (filters.minMagnitude !== undefined && data.type === 'earthquake') {
    return (
      data.magnitude !== undefined && data.magnitude >= filters.minMagnitude
    );
  }
  return true;
}

export function matchesFilters(event: MatchEvent, alert: MatchAlert): boolean {
  if (event.severity < alert.minSeverity) {
    return false;
  }
  if (event.category === 'news' && alert.category === 'news') {
    return matchesNews(event, alert.filters);
  }
  if (event.category === 'market' && alert.category === 'market') {
    return matchesMarket(event.data, alert.filters);
  }
  if (event.category === 'disaster' && alert.category === 'disaster') {
    return matchesDisaster(event.data, alert.filters);
  }
  return false;
}

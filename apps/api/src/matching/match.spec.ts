import type {
  DisasterEventData,
  DisasterFilters,
  MarketFilters,
} from '@alerts/shared';
import { matchesFilters, type MatchAlert, type MatchEvent } from './match';

function newsEvent(title: string, summary = ''): MatchEvent {
  return { category: 'news', title, summary, severity: 3, data: {} };
}

function newsAlert(keywords: string[]): MatchAlert {
  return { category: 'news', minSeverity: 1, filters: { keywords } };
}

function marketEvent(symbol: string, changePct: number): MatchEvent {
  const data = { symbol, price: 100, changePct };
  return { category: 'market', title: 'Move', summary: '', severity: 3, data };
}

function marketAlert(filters: Partial<MarketFilters>): MatchAlert {
  return {
    category: 'market',
    minSeverity: 1,
    filters: { symbols: [], direction: 'any', minChangePct: 0, ...filters },
  };
}

function disasterEvent(data: DisasterEventData): MatchEvent {
  return {
    category: 'disaster',
    title: 'Event',
    summary: '',
    severity: 3,
    data,
  };
}

function disasterAlert(filters: Partial<DisasterFilters>): MatchAlert {
  return {
    category: 'disaster',
    minSeverity: 1,
    filters: { types: [], regions: [], ...filters },
  };
}

describe('matchesFilters', () => {
  describe('news', () => {
    it.each<[string, string[], boolean]>([
      ['Oil prices climb', ['oil'], true],
      ['Water starts to boil', ['oil'], false],
      ['New oilfield found', ['oil'], false],
      ['New C++ standard published', ['C++'], true],
      ['S&P 500 falls', ['S&P'], true],
      ['$TSLA trends on social media', ['$TSLA'], true],
      ['Café opens downtown', ['café'], true],
      ['Cafés close early', ['café'], false],
      ['Gold rallies', ['oil', 'gold'], true],
      ['Gold rallies', ['oil', 'gas'], false],
      ['Price is 100', ['1.0'], false],
      ['Anything at all', [], true],
    ])('title %j with keywords %j gives %s', (title, keywords, expected) => {
      expect(matchesFilters(newsEvent(title), newsAlert(keywords))).toBe(
        expected,
      );
    });

    it('matches a keyword that appears only in the summary', () => {
      const event = newsEvent('Markets today', 'Oil rises after the report');
      expect(matchesFilters(event, newsAlert(['oil']))).toBe(true);
    });
  });

  describe('market', () => {
    it.each<[string, number, Partial<MarketFilters>, boolean]>([
      ['TSLA', -3, {}, true],
      ['TSLA', 3, { symbols: ['tsla'] }, true],
      ['aapl', 3, { symbols: ['AAPL'] }, true],
      ['TSLA', 3, { symbols: ['AAPL'] }, false],
      ['TSLA', 3, { direction: 'up' }, true],
      ['TSLA', -3, { direction: 'up' }, false],
      ['TSLA', 0, { direction: 'up' }, false],
      ['TSLA', -3, { direction: 'down' }, true],
      ['TSLA', 3, { direction: 'down' }, false],
      ['TSLA', -2, { minChangePct: 2 }, true],
      ['TSLA', 1.99, { minChangePct: 2 }, false],
    ])('%s %s%% with %j gives %s', (symbol, changePct, filters, expected) => {
      const event = marketEvent(symbol, changePct);
      expect(matchesFilters(event, marketAlert(filters))).toBe(expected);
    });
  });

  describe('disaster', () => {
    it.each<[DisasterEventData, Partial<DisasterFilters>, boolean]>([
      [{ type: 'flood', region: 'europe' }, {}, true],
      [{ type: 'storm', region: 'asia' }, { types: ['storm'] }, true],
      [{ type: 'storm', region: 'asia' }, { types: ['flood'] }, false],
      [{ type: 'flood', region: 'europe' }, { regions: ['europe'] }, true],
      [{ type: 'flood', region: 'europe' }, { regions: ['asia'] }, false],
      [
        { type: 'earthquake', region: 'asia', magnitude: 5 },
        { minMagnitude: 5 },
        true,
      ],
      [
        { type: 'earthquake', region: 'asia', magnitude: 4.9 },
        { minMagnitude: 5 },
        false,
      ],
      [{ type: 'earthquake', region: 'asia' }, { minMagnitude: 5 }, false],
      [{ type: 'earthquake', region: 'asia' }, {}, true],
      [{ type: 'flood', region: 'europe' }, { minMagnitude: 5 }, true],
    ])('%j with %j gives %s', (data, filters, expected) => {
      const event = disasterEvent(data);
      expect(matchesFilters(event, disasterAlert(filters))).toBe(expected);
    });
  });

  describe('severity and category', () => {
    const news = newsEvent('Anything');

    it('rejects an event below minSeverity and accepts one at it', () => {
      const alert = newsAlert([]);
      expect(matchesFilters(news, { ...alert, minSeverity: 4 })).toBe(false);
      expect(matchesFilters(news, { ...alert, minSeverity: 3 })).toBe(true);
    });

    it.each<{ event: MatchEvent; alert: MatchAlert }>([
      { event: news, alert: marketAlert({}) },
      { event: marketEvent('TSLA', 5), alert: disasterAlert({}) },
      {
        event: disasterEvent({ type: 'storm', region: 'asia' }),
        alert: newsAlert([]),
      },
    ])(
      'a $event.category event never matches a $alert.category alert',
      ({ event, alert }) => {
        expect(matchesFilters(event, alert)).toBe(false);
      },
    );
  });
});

import { buildMessage, buildTestMessage } from './message';

describe('buildMessage', () => {
  it('formats the subject as "[category] title"', () => {
    const message = buildMessage(
      {
        category: 'news',
        title: 'Central bank cuts rates',
        summary: 'The cut was larger than expected.',
        severity: 2,
        data: {},
      },
      'Rate news',
    );
    expect(message.subject).toBe('[news] Central bank cuts rates');
    expect(message.text).toBe(
      'The cut was larger than expected.\nSeverity: 2 of 5\nAlert: Rate news',
    );
  });

  it('describes market data and names the alert', () => {
    const { text } = buildMessage(
      {
        category: 'market',
        title: 'TSLA drops',
        summary: '',
        severity: 3,
        data: { symbol: 'TSLA', price: 182.5, changePct: -6.234 },
      },
      'Tesla swings',
    );
    expect(text).toBe(
      'Severity: 3 of 5\nTSLA fell 6.23% to 182.5.\nAlert: Tesla swings',
    );
  });

  it('describes disaster data with and without a magnitude', () => {
    const quake = buildMessage(
      {
        category: 'disaster',
        title: 'Earthquake near the coast',
        summary: 'Felt in several cities.',
        severity: 3,
        data: { type: 'earthquake', region: 'south-america', magnitude: 6.4 },
      },
      'Big quakes',
    );
    expect(quake.text).toContain(
      'Earthquake in South America, magnitude 6.4.',
    );
    expect(quake.text).toContain('Alert: Big quakes');

    const flood = buildMessage(
      {
        category: 'disaster',
        title: 'River floods',
        summary: '',
        severity: 2,
        data: { type: 'flood', region: 'europe' },
      },
      'Floods',
    );
    expect(flood.text).toContain('Flood in Europe.');
  });
});

describe('buildTestMessage', () => {
  it('names the target', () => {
    expect(buildTestMessage('Team inbox').text).toContain('"Team inbox"');
  });
});

import { assertAllowedSlackUrl, SlackUrlError } from './slack-url';

const prefixes = ['https://hooks.slack.com/services/'];

describe('assertAllowedSlackUrl', () => {
  it('returns the parsed URL for an allowed webhook', () => {
    const url = assertAllowedSlackUrl(
      'https://hooks.slack.com/services/T000/B000/XXXX',
      prefixes,
    );
    expect(url.href).toBe('https://hooks.slack.com/services/T000/B000/XXXX');
  });

  it.each([
    ['a look-alike host', 'https://hooks.slack.com.evil.com/services/x'],
    ['the prefix in the query', 'https://evil.com/?https://hooks.slack.com/services/'],
    ['a username', 'https://user@hooks.slack.com/services/x'],
    ['a password', 'https://:secret@hooks.slack.com/services/x'],
    ['a path that climbs out of the prefix', 'https://hooks.slack.com/services/../api'],
    ['http when only https is allowed', 'http://hooks.slack.com/services/x'],
    ['a value that is not a URL', 'hooks.slack.com/services/x'],
  ])('rejects %s without echoing the URL', (_label, raw) => {
    let thrown: unknown;
    try {
      assertAllowedSlackUrl(raw, prefixes);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SlackUrlError);
    const message = (thrown as Error).message;
    expect(message).not.toContain(raw);
    expect(message).not.toContain('slack.com');
  });
});

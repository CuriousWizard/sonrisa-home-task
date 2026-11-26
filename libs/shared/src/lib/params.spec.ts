import { ChannelIdParam, HookIdParam, IdParam, SourceIdParam } from './params';

describe('route params', () => {
  it('IdParam rejects an id that is not a uuid', () => {
    expect(IdParam.safeParse({ id: '123' }).success).toBe(false);
  });

  it('SourceIdParam rejects uppercase letters', () => {
    expect(SourceIdParam.safeParse({ id: 'GDACS' }).success).toBe(false);
  });

  it('ChannelIdParam rejects an unknown channel', () => {
    expect(ChannelIdParam.safeParse({ id: 'sms' }).success).toBe(false);
  });

  it('HookIdParam rejects a slash', () => {
    expect(HookIdParam.safeParse({ hookId: 'a/b' }).success).toBe(false);
  });
});

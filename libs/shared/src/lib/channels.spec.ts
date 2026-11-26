import { TargetInput } from './channels';

const slackConfig = { webhookUrl: 'https://hooks.slack.com/services/T0/B0/x' };

describe('TargetInput', () => {
  it('accepts a slack config under channel slack', () => {
    const result = TargetInput.safeParse({
      name: 'Team',
      channel: 'slack',
      config: slackConfig,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a slack config under channel email', () => {
    const result = TargetInput.safeParse({
      name: 'Team',
      channel: 'email',
      config: slackConfig,
    });
    expect(result.success).toBe(false);
  });
});

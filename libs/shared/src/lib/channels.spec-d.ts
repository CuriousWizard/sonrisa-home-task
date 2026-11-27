import { channels, EmailConfig, type ChannelDefinition } from './channels';

describe('channel fields', () => {
  it('rejects a field key that is not in the config', () => {
    const email: ChannelDefinition<typeof EmailConfig> = {
      configSchema: EmailConfig,
      label: 'Email',
      // @ts-expect-error "adress" is not a key of the email config.
      fields: [{ key: 'adress', label: 'Email address', inputType: 'email' }],
    };

    expectTypeOf(email.fields[0].key).toEqualTypeOf<'address'>();
  });

  it('keeps the config keys of each channel in the shared map', () => {
    expectTypeOf(channels.email.fields[0].key).toEqualTypeOf<'address'>();
    expectTypeOf(channels.slack.fields[0].key).toEqualTypeOf<'webhookUrl'>();
  });
});

import { createTransport } from 'nodemailer';
import { EmailConfig } from '@alerts/shared';
import type { Config } from '../config';
import type { NotificationChannel } from './channel';

// The Nodemailer defaults run up to 10 minutes, longer than the delivery lease.
const SMTP_TIMEOUT_MS = 10_000;

function smtpErrorMessage(error: unknown): string {
  const code =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  return code ? `SMTP error: ${code}` : 'SMTP error';
}

export function createEmailChannel(
  config: Pick<Config, 'SMTP_HOST' | 'SMTP_PORT' | 'MAIL_FROM'>,
): NotificationChannel<EmailConfig> {
  const transport = createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  return {
    id: 'email',
    configSchema: EmailConfig,
    async send(target, message) {
      try {
        await transport.sendMail({
          from: config.MAIL_FROM,
          to: target.address,
          subject: message.subject,
          text: message.text,
        });
      } catch (error) {
        // Nodemailer messages can quote the server reply or credentials, so only the code is kept.
        throw new Error(smtpErrorMessage(error));
      }
    },
  };
}

import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  /** false = no way to send email here: features that need it answer 503. */
  readonly enabled: boolean;
  send(message: MailMessage): Promise<void>;
}

/** Any SMTP relay: Brevo in production, Mailpit locally. */
export function createSmtpMailer(options: {
  host: string;
  port: number;
  secure: boolean;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
}): Mailer {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    // Port 587: refuse to send credentials or codes if STARTTLS is not offered.
    requireTLS: !options.secure && options.port !== 1025,
    ...(options.user && options.pass ? { auth: { user: options.user, pass: options.pass } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    enabled: true,
    async send(message) {
      await transport.sendMail({ from: options.from, ...message });
    },
  };
}

/** Tests: keeps every message so a test can read the code that was "emailed". */
export function createMemoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    enabled: true,
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

/** Local development without SMTP: print the message (the code!) to the console. */
function createLogMailer(): Mailer {
  return {
    enabled: true,
    send(message) {
      logger.warn(
        { to: message.to, subject: message.subject, text: message.text },
        'DEV MAILER — not sent, set SMTP_HOST to deliver (this log contains the code)',
      );
      return Promise.resolve();
    },
  };
}

const disabledMailer: Mailer = {
  enabled: false,
  send: () => Promise.reject(new Error('Email is not configured (SMTP_HOST is unset)')),
};

function chooseMailer(): Mailer {
  if (config.SMTP_HOST && config.MAIL_FROM) {
    return createSmtpMailer({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
      from: config.MAIL_FROM,
    });
  }
  if (config.NODE_ENV === 'test') return createMemoryMailer();
  // Never print reset codes in production logs; there the feature is simply unavailable.
  if (config.NODE_ENV === 'development') return createLogMailer();
  return disabledMailer;
}

export const mailer: Mailer = chooseMailer();

import { Injectable, Logger } from '@nestjs/common';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(input: SendMailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.MAIL_FROM?.trim() || 'Easement <onboarding@resend.dev>';

    if (!apiKey) {
      // Local / demo: same payload you would send.
      // eslint-disable-next-line no-console
      console.log('[mail]', {
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Resend failed (${res.status}): ${body}`);
      throw new Error(`Failed to send email (${res.status})`);
    }
  }
}

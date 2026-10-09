import { Resend } from "resend";
import type { EmailMessage, EmailSender, SendResult } from "./email-sender";

export class ResendSender implements EmailSender {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (error || !data) return { ok: false, error: error?.message ?? "Resend returned no id" };
      return { ok: true, id: data.id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown Resend error" };
    }
  }
}

import { Resend } from "resend";
import { sendInChunks } from "./batch";
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

  /** Resend batch endpoint, 100 emails per call (strict validation: a bad email fails its whole call). */
  sendBatch(messages: readonly EmailMessage[]): Promise<SendResult[]> {
    return sendInChunks(messages, async (batch) => {
      const { data, error } = await this.client.batch.send(
        batch.map((m) => ({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text })),
      );
      if (error || !data) {
        const reason = error?.message ?? "Resend returned no data";
        return batch.map((): SendResult => ({ ok: false, error: reason }));
      }
      return batch.map((_, i): SendResult => {
        const item = data.data[i];
        return item ? { ok: true, id: item.id } : { ok: false, error: "Resend returned no id" };
      });
    });
  }
}

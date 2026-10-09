import type { EmailMessage, EmailSender, SendResult } from "./email-sender";

/** Development fallback: prints the plain-text body (it contains the ticket link). */
export class ConsoleSender implements EmailSender {
  async send(message: EmailMessage): Promise<SendResult> {
    console.info(`[email:console] to=${message.to} subject=${message.subject}\n${message.text}`);
    return { ok: true, id: "console" };
  }
}

import { getTicketingEnv } from "@/lib/env";
import { ConsoleSender } from "./console-sender";
import { ResendSender } from "./resend-sender";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/** Port implemented by the Resend and console senders. Implementations must not throw. */
export interface EmailSender {
  send(message: EmailMessage): Promise<SendResult>;
}

/** Resend when configured; console only outside production (env enforces the key in production). */
export function createEmailSender(): EmailSender {
  const { resendApiKey, emailFrom } = getTicketingEnv();
  if (resendApiKey && emailFrom) return new ResendSender(resendApiKey, emailFrom);
  return new ConsoleSender();
}

/** Never throws: configuration or provider problems come back as `{ ok: false }`. */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  try {
    return await createEmailSender().send(message);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }
}

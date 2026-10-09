export interface TicketingEnv {
  signingSecret: string;
  resendApiKey: string;
  emailFrom: string;
  appUrl: string;
}

type EnvSource = Record<string, string | undefined>;

const MIN_SIGNING_SECRET_LENGTH = 32;

/**
 * Fail-fast reader for ticketing/email env vars. Pure over `source` so it can be
 * tested; call `getTicketingEnv()` from server code that actually needs them, so
 * pages that do not send email still boot without the variables.
 */
export function readTicketingEnv(source: EnvSource): TicketingEnv {
  const required = (name: string): string => {
    const value = source[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };

  const signingSecret = required("TICKET_SIGNING_SECRET");
  if (signingSecret.length < MIN_SIGNING_SECRET_LENGTH) {
    throw new Error(`TICKET_SIGNING_SECRET must be at least ${MIN_SIGNING_SECRET_LENGTH} characters`);
  }

  return {
    signingSecret,
    resendApiKey: required("RESEND_API_KEY"),
    emailFrom: required("EMAIL_FROM"),
    appUrl: required("NEXT_PUBLIC_APP_URL").replace(/\/+$/, ""),
  };
}

let cached: TicketingEnv | undefined;

export function getTicketingEnv(): TicketingEnv {
  cached ??= readTicketingEnv(process.env);
  return cached;
}

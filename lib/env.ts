export interface TicketingEnv {
  signingSecret: string;
  /** Undefined outside production: emails fall back to the console sender. */
  resendApiKey: string | undefined;
  emailFrom: string | undefined;
  appUrl: string;
}

type EnvSource = Record<string, string | undefined>;

const MIN_SIGNING_SECRET_LENGTH = 32;
const DEV_APP_URL = "http://localhost:3000";

function isLocalUrl(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Fail-fast reader for ticketing/email env vars. Pure over `source` so it can be
 * tested; call `getTicketingEnv()` from server code that actually needs them, so
 * pages that do not send email still boot without the variables.
 *
 * The signing secret is always required. Email settings and the public app URL
 * are required in production only; elsewhere they degrade to the console sender
 * and localhost so local development works without a Resend account.
 */
export function readTicketingEnv(source: EnvSource): TicketingEnv {
  const production = source.NODE_ENV === "production";
  const read = (name: string): string | undefined => source[name]?.trim() || undefined;
  const required = (name: string): string => {
    const value = read(name);
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };
  const productionOnly = (name: string): string | undefined => (production ? required(name) : read(name));

  const signingSecret = required("TICKET_SIGNING_SECRET");
  if (signingSecret.length < MIN_SIGNING_SECRET_LENGTH) {
    throw new Error(`TICKET_SIGNING_SECRET must be at least ${MIN_SIGNING_SECRET_LENGTH} characters`);
  }

  const appUrl = productionOnly("NEXT_PUBLIC_APP_URL") ?? DEV_APP_URL;
  const resendApiKey = productionOnly("RESEND_API_KEY");
  // Safety net for deploys with a wrong NODE_ENV: a public URL without a mail key must not silently use the console sender.
  if (!resendApiKey && !isLocalUrl(appUrl)) {
    throw new Error("Missing required environment variable: RESEND_API_KEY (NEXT_PUBLIC_APP_URL is not localhost)");
  }
  return {
    signingSecret,
    resendApiKey,
    emailFrom: productionOnly("EMAIL_FROM"),
    appUrl: appUrl.replace(/\/+$/, ""),
  };
}

let cached: TicketingEnv | undefined;

export function getTicketingEnv(): TicketingEnv {
  cached ??= readTicketingEnv(process.env);
  return cached;
}

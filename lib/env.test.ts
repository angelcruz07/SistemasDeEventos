import { describe, expect, it } from "vitest";
import { readTicketingEnv } from "./env";

const good = {
  TICKET_SIGNING_SECRET: "x".repeat(32),
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Eventos <no-reply@example.com>",
  NEXT_PUBLIC_APP_URL: "https://example.com",
  NODE_ENV: "production",
};

describe("readTicketingEnv", () => {
  it("returns typed values when everything is set", () => {
    expect(readTicketingEnv(good)).toMatchObject({ appUrl: "https://example.com", emailFrom: good.EMAIL_FROM });
  });

  it("fails fast in production naming the missing variable", () => {
    expect(() => readTicketingEnv({ ...good, RESEND_API_KEY: "" })).toThrow(/RESEND_API_KEY/);
    expect(() => readTicketingEnv({ ...good, EMAIL_FROM: undefined })).toThrow(/EMAIL_FROM/);
    expect(() => readTicketingEnv({ ...good, NEXT_PUBLIC_APP_URL: undefined })).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("allows missing email settings and app URL outside production", () => {
    const dev = { TICKET_SIGNING_SECRET: good.TICKET_SIGNING_SECRET, NODE_ENV: "development" };
    expect(readTicketingEnv(dev)).toEqual({
      signingSecret: good.TICKET_SIGNING_SECRET,
      resendApiKey: undefined,
      emailFrom: undefined,
      appUrl: "http://localhost:3000",
    });
  });

  it("throws when a non-local app URL has no Resend key (misconfigured deploy)", () => {
    const staging = {
      TICKET_SIGNING_SECRET: good.TICKET_SIGNING_SECRET,
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "https://staging.example.com",
    };
    expect(() => readTicketingEnv(staging)).toThrow(/RESEND_API_KEY/);
    expect(readTicketingEnv({ ...staging, RESEND_API_KEY: "re_x", EMAIL_FROM: "a <a@b.co>" }).appUrl).toBe(
      "https://staging.example.com",
    );
  });

  it("allows localhost URLs without a Resend key", () => {
    const base = { TICKET_SIGNING_SECRET: good.TICKET_SIGNING_SECRET, NODE_ENV: "development" };
    expect(readTicketingEnv({ ...base, NEXT_PUBLIC_APP_URL: "http://localhost:3001" }).appUrl).toBe("http://localhost:3001");
    expect(readTicketingEnv({ ...base, NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" }).resendApiKey).toBeUndefined();
  });

  it("still requires the signing secret outside production", () => {
    expect(() => readTicketingEnv({ NODE_ENV: "development" })).toThrow(/TICKET_SIGNING_SECRET/);
  });

  it("rejects a short signing secret", () => {
    expect(() => readTicketingEnv({ ...good, TICKET_SIGNING_SECRET: "short" })).toThrow(/TICKET_SIGNING_SECRET/);
  });

  it("strips a trailing slash from the app URL", () => {
    expect(readTicketingEnv({ ...good, NEXT_PUBLIC_APP_URL: "https://example.com/" }).appUrl).toBe("https://example.com");
  });
});

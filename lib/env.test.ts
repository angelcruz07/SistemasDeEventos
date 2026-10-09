import { describe, expect, it } from "vitest";
import { readTicketingEnv } from "./env";

const good = {
  TICKET_SIGNING_SECRET: "x".repeat(32),
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Eventos <no-reply@example.com>",
  NEXT_PUBLIC_APP_URL: "https://example.com",
};

describe("readTicketingEnv", () => {
  it("returns typed values when everything is set", () => {
    expect(readTicketingEnv(good)).toMatchObject({ appUrl: "https://example.com", emailFrom: good.EMAIL_FROM });
  });

  it("fails fast naming the missing variable", () => {
    expect(() => readTicketingEnv({ ...good, RESEND_API_KEY: "" })).toThrow(/RESEND_API_KEY/);
    expect(() => readTicketingEnv({ ...good, EMAIL_FROM: undefined })).toThrow(/EMAIL_FROM/);
  });

  it("rejects a short signing secret", () => {
    expect(() => readTicketingEnv({ ...good, TICKET_SIGNING_SECRET: "short" })).toThrow(/TICKET_SIGNING_SECRET/);
  });

  it("strips a trailing slash from the app URL", () => {
    expect(readTicketingEnv({ ...good, NEXT_PUBLIC_APP_URL: "https://example.com/" }).appUrl).toBe("https://example.com");
  });
});

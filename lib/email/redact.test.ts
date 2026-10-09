import { describe, expect, it } from "vitest";
import { redactEmails } from "./redact";

describe("redactEmails", () => {
  it("replaces every address in a string", () => {
    expect(redactEmails("to ana@example.com and <bob@x.org> failed")).toBe("to [email] and <[email]> failed");
  });

  it("leaves text without addresses untouched", () => {
    expect(redactEmails("rate limited")).toBe("rate limited");
  });
});

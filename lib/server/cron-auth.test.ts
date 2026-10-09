import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

describe("isCronAuthorized", () => {
  it("accepts the matching bearer token", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });
  it("rejects mismatches, missing headers and wrong schemes", () => {
    expect(isCronAuthorized("Bearer nope", "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer s3cret-longer", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
    expect(isCronAuthorized("Basic s3cret", "s3cret")).toBe(false);
  });
  it("rejects everything when the secret is unset or empty", () => {
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer x", undefined)).toBe(false);
  });
});

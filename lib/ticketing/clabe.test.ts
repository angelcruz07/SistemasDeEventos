import { describe, expect, it } from "vitest";
import { isValidClabe } from "./clabe";

describe("isValidClabe", () => {
  it("accepts a CLABE with a correct check digit", () => {
    expect(isValidClabe("032180000118359719")).toBe(true);
    expect(isValidClabe("002010077777777771")).toBe(true);
  });
  it("rejects a wrong check digit", () => {
    expect(isValidClabe("032180000118359718")).toBe(false);
  });
  it("rejects wrong length and non-digits", () => {
    expect(isValidClabe("03218000011835971")).toBe(false);
    expect(isValidClabe("0321800001183597190")).toBe(false);
    expect(isValidClabe("03218000011835971A")).toBe(false);
    expect(isValidClabe("")).toBe(false);
  });
});

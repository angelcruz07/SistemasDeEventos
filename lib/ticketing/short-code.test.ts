import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  createWithUniqueCode,
  formatShortCode,
  generateShortCode,
  normalizeShortCode,
} from "./short-code";

describe("alphabet", () => {
  it("has 32 symbols and excludes I L O U", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    for (const c of "ILOU") expect(CODE_ALPHABET).not.toContain(c);
  });
});

describe("generateShortCode", () => {
  it("produces 6 chars from the injected randomness", () => {
    expect(generateShortCode(() => 0)).toBe("000000");
    expect(generateShortCode(() => 31)).toBe("ZZZZZZ");
    expect(generateShortCode(() => 0)).toHaveLength(CODE_LENGTH);
  });

  it("asks for values below the alphabet size", () => {
    const seen: number[] = [];
    generateShortCode((max) => {
      seen.push(max);
      return 1;
    });
    expect(seen).toEqual(Array(6).fill(32));
  });
});

describe("formatShortCode", () => {
  it("shows XXX-XXX", () => {
    expect(formatShortCode("7K3Q9M")).toBe("7K3-Q9M");
  });
});

describe("normalizeShortCode", () => {
  it("uppercases, strips dashes and spaces", () => {
    expect(normalizeShortCode(" 7k3-q9m ")).toBe("7K3Q9M");
  });

  it("maps O to 0 and I/L to 1", () => {
    expect(normalizeShortCode("OIL-OIL")).toBe("011011");
  });
});

describe("createWithUniqueCode", () => {
  const collision = Object.assign(new Error("dup"), { code: "P2002" });
  const isCollision = (e: unknown) => (e as { code?: string })?.code === "P2002";

  it("retries on collision then succeeds", async () => {
    let n = 0;
    const result = await createWithUniqueCode(
      () => `C${n++}`,
      async (code) => {
        if (n < 3) throw collision;
        return code;
      },
      isCollision,
    );
    expect(result).toBe("C2");
  });

  it("gives up after 5 attempts", async () => {
    let calls = 0;
    await expect(
      createWithUniqueCode(
        () => "X",
        async () => {
          calls++;
          throw collision;
        },
        isCollision,
      ),
    ).rejects.toThrow();
    expect(calls).toBe(5);
  });

  it("rethrows non-collision errors immediately", async () => {
    let calls = 0;
    await expect(
      createWithUniqueCode(
        () => "X",
        async () => {
          calls++;
          throw new Error("boom");
        },
        isCollision,
      ),
    ).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });
});

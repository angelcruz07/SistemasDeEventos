import { describe, expect, it } from "vitest";
import { collectAnsweredFieldIds, parseTicketingConfig, type TicketingConfigInput } from "./ticketing-config";

const VALID_CLABE = "002010077777777771";

function input(overrides: Partial<TicketingConfigInput> = {}): TicketingConfigInput {
  return {
    price: "350.50",
    allowSpei: true,
    allowCash: false,
    speiClabe: VALID_CLABE,
    speiBank: "Banamex",
    speiBeneficiary: "Juan Perez",
    capacity: "100",
    displayCapacity: "",
    registrationOpen: true,
    ...overrides,
  };
}

function errorsOf(i: TicketingConfigInput) {
  const r = parseTicketingConfig(i);
  if (!("errors" in r)) throw new Error("expected errors");
  return r.errors;
}

describe("parseTicketingConfig", () => {
  it("converts pesos to cents and normalises optional numbers", () => {
    const r = parseTicketingConfig(input());
    expect(r).toEqual({
      data: {
        priceCents: 35050,
        allowSpei: true,
        allowCash: false,
        speiClabe: VALID_CLABE,
        speiBank: "Banamex",
        speiBeneficiary: "Juan Perez",
        capacity: 100,
        displayCapacity: null,
        registrationOpen: true,
      },
    });
  });

  it("rejects an invalid price", () => {
    expect(errorsOf(input({ price: "abc" })).price).toBeDefined();
    expect(errorsOf(input({ price: "-5" })).price).toBeDefined();
  });

  it("blocks price > 0 with no payment method", () => {
    expect(errorsOf(input({ allowSpei: false, allowCash: false })).methods).toBeDefined();
  });

  it("allows a free event with no payment method and no SPEI data", () => {
    const r = parseTicketingConfig(
      input({ price: "0", allowSpei: false, allowCash: false, speiClabe: "", speiBank: "", speiBeneficiary: "" }),
    );
    expect("data" in r && r.data.priceCents).toBe(0);
  });

  it("does not require SPEI data for a free event even if SPEI is toggled on", () => {
    const r = parseTicketingConfig(input({ price: "0", speiClabe: "", speiBank: "", speiBeneficiary: "" }));
    expect("data" in r).toBe(true);
  });

  it("requires SPEI fields when SPEI is enabled on a paid event", () => {
    const e = errorsOf(input({ speiClabe: "", speiBank: " ", speiBeneficiary: "" }));
    expect(e.speiClabe).toBeDefined();
    expect(e.speiBank).toBeDefined();
    expect(e.speiBeneficiary).toBeDefined();
  });

  it("rejects a CLABE with a bad check digit and accepts spaces", () => {
    expect(errorsOf(input({ speiClabe: "002010077777777772" })).speiClabe).toBeDefined();
    const r = parseTicketingConfig(input({ speiClabe: "0020 1007 7777 7777 71" }));
    expect("data" in r && r.data.speiClabe).toBe(VALID_CLABE);
  });

  it("does not require SPEI data when only cash is enabled", () => {
    const r = parseTicketingConfig(input({ allowSpei: false, allowCash: true, speiClabe: "" }));
    expect("data" in r).toBe(true);
  });

  it("validates capacity and displayCapacity as positive integers or empty", () => {
    expect(errorsOf(input({ capacity: "0" })).capacity).toBeDefined();
    expect(errorsOf(input({ capacity: "1.5" })).capacity).toBeDefined();
    expect(errorsOf(input({ displayCapacity: "-3" })).displayCapacity).toBeDefined();
    const r = parseTicketingConfig(input({ capacity: "", displayCapacity: "250" }));
    expect("data" in r && r.data.capacity).toBeNull();
    expect("data" in r && r.data.displayCapacity).toBe(250);
  });
});

describe("collectAnsweredFieldIds", () => {
  it("returns ids with a stored answer across tickets", () => {
    const ids = collectAnsweredFieldIds([
      { a: { label: "A", value: "x" }, b: { label: "B", value: 1 } },
      { a: { label: "A", value: "y" } },
      null,
      "garbage",
      [],
    ]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("parseTicketingConfig hardening", () => {
  it("caps the price at 100,000 pesos", () => {
    const ok = parseTicketingConfig(input({ price: "100000" }));
    expect("data" in ok && ok.data.priceCents).toBe(10_000_000);
    expect(errorsOf(input({ price: "100000.01" })).price).toBeDefined();
    expect(errorsOf(input({ price: "99999999999" })).price).toBeDefined();
  });

  it("validates a non-empty CLABE even for free events or when SPEI is off", () => {
    expect(errorsOf(input({ price: "0", speiClabe: "123" })).speiClabe).toBeDefined();
    expect(errorsOf(input({ allowSpei: false, allowCash: true, speiClabe: "002010077777777772" })).speiClabe).toBeDefined();
  });

  it("caps bank and beneficiary at 100 characters", () => {
    expect("data" in parseTicketingConfig(input({ speiBank: "b".repeat(100) }))).toBe(true);
    expect(errorsOf(input({ speiBank: "b".repeat(101) })).speiBank).toBeDefined();
    expect(errorsOf(input({ speiBeneficiary: "b".repeat(101) })).speiBeneficiary).toBeDefined();
  });
});

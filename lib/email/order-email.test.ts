import { describe, expect, it } from "vitest";
import { buildOrderEmail } from "./order-email";

const order = { name: "Ana", code: "7K3Q9M", amountCents: 70000 };
const event = {
  title: "Gala 2026",
  priceCents: 35000,
  speiClabe: "012345678901234567",
  speiBank: "BBVA",
  speiBeneficiary: "Club Gala AC",
};
const link = "https://app.test/ticket/abc.def";

describe("buildOrderEmail", () => {
  it("received: charges the ORDER amount (not the unit price) and uses the order code as concept", () => {
    const { text } = buildOrderEmail("received", { order, event, link });
    expect(text).toContain("$700.00");
    expect(text).not.toContain("$350.00");
    expect(text).toContain("Concepto: 7K3-Q9M");
    expect(text).toContain(link);
  });

  it("received: omits SPEI data for a free event or missing bank details", () => {
    expect(buildOrderEmail("received", { order, event: { ...event, priceCents: 0 }, link }).text).not.toContain("CLABE");
    expect(buildOrderEmail("received", { order, event: { ...event, speiClabe: null }, link }).text).not.toContain("CLABE");
  });

  it("rejected: includes the reason and the link", () => {
    const { text } = buildOrderEmail("rejected", { order, event, link, reason: "Comprobante borroso" });
    expect(text).toContain("Comprobante borroso");
    expect(text).toContain(link);
  });
});

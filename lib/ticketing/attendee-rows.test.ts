import { describe, expect, it } from "vitest";
import { issuedTickets, toOrderRow, type OrderRowInput } from "./attendee-rows";

const base: OrderRowInput = {
  id: "o1",
  code: "7K3Q9M",
  name: "Ana",
  email: "ana@x.com",
  quantity: 3,
  amountCents: 30000,
  status: "PAID",
  paymentMethod: "SPEI",
  createdAt: new Date("2026-10-09T18:30:00Z"),
  paidAt: new Date("2026-10-09T19:00:00Z"),
  rejectionReason: null,
  answers: { f1: { label: "Empresa", value: "Acme" }, bad: 5 },
  receipts: [],
  tickets: [],
};

const ticket = (seq: number, status: string, extra = {}) => ({
  id: `t${seq}`,
  code: `AAAA0${seq}`,
  seq,
  status: status as never,
  checkedInAt: null,
  checkedInBy: null,
  ...extra,
});

describe("issuedTickets", () => {
  it("drops the pre-issue mirror tickets of unpaid orders", () => {
    const list = [ticket(1, "PENDING_RECEIPT"), ticket(2, "PENDING_VALIDATION"), ticket(3, "REJECTED"), ticket(4, "PAID")];
    expect(issuedTickets(list).map((t) => t.seq)).toEqual([4]);
  });
  it("hides the mirror ticket of an order cancelled without ever being paid", () => {
    const list = [ticket(1, "CANCELLED")];
    expect(issuedTickets(list, { status: "CANCELLED", paidAt: null })).toEqual([]);
  });
  it("keeps cancelled tickets of an order that was paid", () => {
    const list = [ticket(1, "CANCELLED")];
    expect(issuedTickets(list, { status: "CANCELLED", paidAt: new Date() })).toHaveLength(1);
  });
  it("keeps cancelled and checked-in tickets", () => {
    expect(issuedTickets([ticket(1, "CANCELLED"), ticket(2, "CHECKED_IN")])).toHaveLength(2);
  });
});

describe("toOrderRow", () => {
  it("formats code, amount, date and answers", () => {
    const row = toOrderRow(base);
    expect(row.code).toBe("7K3-Q9M");
    expect(row.amount).toBe("$300.00");
    expect(row.createdAt).toBe("09/10/2026 12:30");
    expect(row.answers).toEqual([{ label: "Empresa", value: "Acme" }]);
    expect(row.quantity).toBe(3);
  });

  it("picks the latest receipt by uploadedAt and flags purged ones", () => {
    const row = toOrderRow({
      ...base,
      receipts: [
        { id: "old", mimeType: "image/png", purgedAt: null, uploadedAt: new Date("2026-10-01T00:00:00Z") },
        { id: "new", mimeType: "application/pdf", purgedAt: new Date(), uploadedAt: new Date("2026-10-02T00:00:00Z") },
      ],
    });
    expect(row.receipt).toEqual({ id: "new", mimeType: "application/pdf", purged: true });
    expect(toOrderRow(base).receipt).toBeNull();
  });

  it("labels each issued ticket 'n de N' with a formatted code and check-in info", () => {
    const row = toOrderRow({
      ...base,
      tickets: [
        ticket(2, "CHECKED_IN", { checkedInAt: new Date("2026-10-09T20:05:00Z"), checkedInBy: "Luis" }),
        ticket(1, "PAID"),
        ticket(3, "PENDING_VALIDATION"),
      ],
    });
    expect(row.tickets.map((t) => t.position)).toEqual(["1 de 3", "2 de 3"]);
    expect(row.tickets[0].code).toBe("AAA-A01");
    expect(row.tickets[1]).toMatchObject({ checkedInAt: "09/10/2026 14:05", checkedInBy: "Luis", canCancel: false });
    expect(row.tickets[0].canCancel).toBe(true);
  });

  it("derives the order actions from the order status", () => {
    expect(toOrderRow({ ...base, status: "PENDING_VALIDATION" })).toMatchObject({
      canReview: true,
      canCancel: true,
      canResend: false,
    });
    expect(toOrderRow({ ...base, status: "PENDING_RECEIPT" }).canResend).toBe(true);
    expect(toOrderRow({ ...base, status: "PAID" })).toMatchObject({ canReview: false, canCancel: true, canResend: true });
    expect(toOrderRow({ ...base, status: "CANCELLED" })).toMatchObject({
      canReview: false,
      canCancel: false,
      canResend: false,
    });
  });

  it("cannot resend without an email", () => {
    expect(toOrderRow({ ...base, email: null }).canResend).toBe(false);
  });
});

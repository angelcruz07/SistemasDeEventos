import { describe, expect, it } from "vitest";
import { toDoorEventView, toDoorTicketView } from "./door-view";

const ticket = {
  id: "t1",
  eventId: "e1",
  code: "7K3Q9M",
  name: "Ana",
  email: "ana@example.com",
  answers: { diet: { label: "Dieta", value: "Vegana" } },
  status: "PAID",
  paymentMethod: "SPEI",
  amountCents: 35000,
  currency: "MXN",
  rejectionReason: "x",
  checkedInAt: null,
  checkedInBy: null,
  receipts: [{ id: "r1" }],
};

describe("toDoorTicketView", () => {
  it("keeps only staff-safe fields", () => {
    expect(toDoorTicketView(ticket)).toEqual({
      id: "t1",
      code: "7K3Q9M",
      name: "Ana",
      status: "PAID",
      paymentMethod: "SPEI",
      answers: [{ label: "Dieta", value: "Vegana" }],
      checkedInAt: null,
      checkedInBy: null,
    });
  });
  it("never exposes money, receipts, email or review data", () => {
    const view = JSON.stringify(toDoorTicketView(ticket));
    for (const leaked of ["amountCents", "currency", "receipts", "email", "ana@", "rejectionReason", "35000"]) {
      expect(view).not.toContain(leaked);
    }
  });
  it("tolerates malformed answers", () => {
    expect(toDoorTicketView({ ...ticket, answers: "junk" }).answers).toEqual([]);
    expect(toDoorTicketView({ ...ticket, answers: { a: 1, b: null } }).answers).toEqual([]);
  });
});

describe("toDoorEventView", () => {
  it("keeps only display fields", () => {
    const event = {
      id: "e1",
      title: "Fiesta",
      date: new Date("2026-10-26T00:00:00Z"),
      time: "20:00",
      location: "CDMX",
      priceCents: 35000,
      speiClabe: "012345678901234567",
      capacity: 100,
      allowCash: true,
    };
    expect(toDoorEventView(event)).toEqual({
      id: "e1",
      title: "Fiesta",
      date: event.date,
      time: "20:00",
      location: "CDMX",
    });
  });
});

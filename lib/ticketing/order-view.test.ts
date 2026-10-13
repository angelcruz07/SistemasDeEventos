import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/app/generated/prisma/enums";
import { orderViewFor, ticketLabel, ticketRedirectsToOrder } from "./order-view";

const base = { status: "PENDING_RECEIPT" as OrderStatus, rejectionReason: null };

describe("orderViewFor", () => {
  it("asks for the receipt while pending", () => {
    expect(orderViewFor(base)).toEqual({ kind: "upload", rejectionReason: null });
  });
  it("asks again with the reason when rejected", () => {
    expect(orderViewFor({ status: "REJECTED", rejectionReason: "Monto incorrecto" })).toEqual({
      kind: "upload",
      rejectionReason: "Monto incorrecto",
    });
  });
  it("shows the review state", () => {
    expect(orderViewFor({ ...base, status: "PENDING_VALIDATION" })).toEqual({ kind: "review" });
  });
  it("lists the tickets once paid", () => {
    expect(orderViewFor({ ...base, status: "PAID" })).toEqual({ kind: "tickets" });
  });
  it("shows cancelled", () => {
    expect(orderViewFor({ ...base, status: "CANCELLED" })).toEqual({ kind: "cancelled" });
  });
  it.each(["PENDING_RECEIPT", "REJECTED", "PENDING_VALIDATION", "PAID"] as const)(
    "shows cancelled for %s when the event is cancelled",
    (status) => {
      expect(orderViewFor({ status, rejectionReason: null, eventCancelled: true })).toEqual({ kind: "cancelled" });
    },
  );
});

describe("ticketLabel", () => {
  it("reads 'Boleto n de N'", () => {
    expect(ticketLabel(2, 3)).toBe("Boleto 2 de 3");
    expect(ticketLabel(1, 1)).toBe("Boleto 1 de 1");
  });
});

describe("ticketRedirectsToOrder", () => {
  it.each(["PENDING_RECEIPT", "PENDING_VALIDATION", "REJECTED"] as const)("redirects a pre-issue %s ticket", (s) => {
    expect(ticketRedirectsToOrder(s)).toBe(true);
  });
  it.each(["PAID", "CHECKED_IN", "CANCELLED"] as const)("keeps an issued or cancelled %s ticket", (s) => {
    expect(ticketRedirectsToOrder(s)).toBe(false);
  });
});

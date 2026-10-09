import { describe, expect, it } from "vitest";
import type { TicketStatus } from "@/app/generated/prisma/enums";
import { ticketViewFor } from "./ticket-view";

const base = { status: "PENDING_RECEIPT" as TicketStatus, rejectionReason: null, priceCents: 15000 };

describe("ticketViewFor", () => {
  it("asks for the receipt when pending", () => {
    expect(ticketViewFor(base)).toEqual({ kind: "upload", rejectionReason: null });
  });
  it("asks again for the receipt with the reason when rejected", () => {
    expect(ticketViewFor({ ...base, status: "REJECTED", rejectionReason: "Monto incorrecto" })).toEqual({
      kind: "upload",
      rejectionReason: "Monto incorrecto",
    });
  });
  it("shows the review state", () => {
    expect(ticketViewFor({ ...base, status: "PENDING_VALIDATION" })).toEqual({ kind: "review" });
  });
  it("shows the QR for PAID and CHECKED_IN", () => {
    expect(ticketViewFor({ ...base, status: "PAID" })).toEqual({ kind: "ticket", checkedIn: false });
    expect(ticketViewFor({ ...base, status: "CHECKED_IN" })).toEqual({ kind: "ticket", checkedIn: true });
  });
  it("shows cancelled", () => {
    expect(ticketViewFor({ ...base, status: "CANCELLED" })).toEqual({ kind: "cancelled" });
  });
});

describe("ticketViewFor cancelled event", () => {
  it.each(["PENDING_RECEIPT", "REJECTED", "PENDING_VALIDATION", "PAID", "CHECKED_IN"] as const)(
    "shows cancelled for %s when the event is cancelled",
    (status) => {
      expect(ticketViewFor({ status, rejectionReason: null, eventCancelled: true })).toEqual({ kind: "cancelled" });
    },
  );
});

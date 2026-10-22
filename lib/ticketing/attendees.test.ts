import { describe, expect, it } from "vitest";
import {
  MAX_PAGE,
  ORDER_STATUS_LABELS,
  PAGE_SIZE,
  STATUS_LABELS,
  buildAttendeeWhere,
  countByStatus,
  parseAttendeeFilter,
} from "./attendees";

describe("parseAttendeeFilter", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseAttendeeFilter({})).toEqual({ status: undefined, q: "", page: 1 });
  });

  it("accepts a known order status and ignores unknown ones", () => {
    expect(parseAttendeeFilter({ status: "PAID" }).status).toBe("PAID");
    expect(parseAttendeeFilter({ status: "HACKED" }).status).toBeUndefined();
  });

  it("does not accept ticket-only statuses", () => {
    expect(parseAttendeeFilter({ status: "CHECKED_IN" }).status).toBeUndefined();
  });

  it("takes the first value of repeated params and trims/limits the query", () => {
    expect(parseAttendeeFilter({ q: ["  ana  ", "x"] }).q).toBe("ana");
    expect(parseAttendeeFilter({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("clamps invalid pages to 1", () => {
    expect(parseAttendeeFilter({ page: "3" }).page).toBe(3);
    expect(parseAttendeeFilter({ page: "0" }).page).toBe(1);
    expect(parseAttendeeFilter({ page: "-2" }).page).toBe(1);
    expect(parseAttendeeFilter({ page: "abc" }).page).toBe(1);
    expect(parseAttendeeFilter({ page: "1.5" }).page).toBe(1);
  });

  it("caps huge pages so skip cannot overflow", () => {
    expect(parseAttendeeFilter({ page: "10000" }).page).toBe(MAX_PAGE);
    expect(parseAttendeeFilter({ page: "99999999999999999999" }).page).toBe(MAX_PAGE);
    expect(MAX_PAGE * PAGE_SIZE).toBeLessThan(2 ** 31);
  });
});

describe("buildAttendeeWhere (orders)", () => {
  it("always scopes to the event", () => {
    expect(buildAttendeeWhere("e1", { q: "", page: 1 })).toEqual({ eventId: "e1" });
  });

  it("applies the status filter to the order", () => {
    expect(buildAttendeeWhere("e1", { status: "PAID", q: "", page: 1 })).toEqual({ eventId: "e1", status: "PAID" });
  });

  it("searches buyer name, email, order code and ticket codes (normalized)", () => {
    const where = buildAttendeeWhere("e1", { q: "7k3-q9m", page: 1 });
    expect(where.OR).toContainEqual({ code: { contains: "7K3Q9M" } });
    expect(where.OR).toContainEqual({ tickets: { some: { code: { contains: "7K3Q9M" } } } });
    expect(where.OR).toContainEqual({ name: { contains: "7k3-q9m", mode: "insensitive" } });
    expect(where.OR).toContainEqual({ email: { contains: "7k3-q9m", mode: "insensitive" } });
  });

  it("skips the code clauses for very short queries", () => {
    const where = buildAttendeeWhere("e1", { q: "a", page: 1 });
    expect(where.OR?.some((c) => "code" in c || "tickets" in c)).toBe(false);
  });
});

describe("countByStatus", () => {
  it("fills zero for missing order statuses", () => {
    const counts = countByStatus([{ status: "PAID", _count: { _all: 3 } }]);
    expect(counts.PAID).toBe(3);
    expect(counts.REJECTED).toBe(0);
    expect(counts.PENDING_CASH).toBe(0);
    expect(Object.keys(counts)).toHaveLength(6);
  });
});

describe("labels", () => {
  it("has a Spanish label per status", () => {
    expect(STATUS_LABELS.PENDING_RECEIPT).toBe("Pendiente de comprobante");
    expect(STATUS_LABELS.CHECKED_IN).toBe("Ingresó");
    expect(ORDER_STATUS_LABELS.PENDING_VALIDATION).toBe("Pendiente de validar");
    expect(ORDER_STATUS_LABELS.PAID).toBe("Pagado");
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});

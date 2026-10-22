import { describe, expect, it } from "vitest";
import { checkInDecision, escapeLike, isRepeatScan, parseScanInput, parseWalkIn, parseSearchQuery } from "./checkin";
import { signTicketToken } from "./token";

const SECRET = "x".repeat(40);

describe("parseScanInput", () => {
  it("extracts the ticket id from a valid signed token", () => {
    const token = signTicketToken("ticket-1", SECRET);
    expect(parseScanInput(token, SECRET)).toEqual({ kind: "ticket", ticketId: "ticket-1" });
  });

  it("trims surrounding whitespace", () => {
    const token = signTicketToken("ticket-1", SECRET);
    expect(parseScanInput(`  ${token}\n`, SECRET)).toEqual({ kind: "ticket", ticketId: "ticket-1" });
  });

  it("rejects a forged token", () => {
    const token = signTicketToken("ticket-1", SECRET);
    const forged = `${token.split(".")[0]}.AAAA`;
    expect(parseScanInput(forged, SECRET)).toEqual({ kind: "invalid" });
  });

  it("accepts a manual short code in any common form", () => {
    expect(parseScanInput("7k3-q9m", SECRET)).toEqual({ kind: "code", code: "7K3Q9M" });
    expect(parseScanInput("7K3 Q9M", SECRET)).toEqual({ kind: "code", code: "7K3Q9M" });
  });

  it("rejects junk", () => {
    for (const junk of ["", "   ", "hello world", "abc", "https://example.com/x", "7K3-Q9M-XX"]) {
      expect(parseScanInput(junk, SECRET)).toEqual({ kind: "invalid" });
    }
  });
});

describe("parseSearchQuery", () => {
  it("requires at least 2 characters", () => {
    expect(parseSearchQuery(" a ")).toBeNull();
    expect(parseSearchQuery("ab")).toEqual({ text: "ab", code: "AB" });
  });

  it("caps the length", () => {
    expect(parseSearchQuery("a".repeat(500))?.text.length).toBe(100);
  });

  it("normalizes the code variant", () => {
    expect(parseSearchQuery("7k3-q9m")?.code).toBe("7K3Q9M");
  });
});

describe("checkInDecision", () => {
  const base = { eventId: "e1", status: "PAID", checkedInAt: null, checkedInBy: null } as const;

  it("allows a paid ticket of this event", () => {
    expect(checkInDecision(base, "e1")).toEqual({ kind: "allow" });
  });

  it("reports an earlier check-in with time and staff", () => {
    const d = checkInDecision(
      { ...base, status: "CHECKED_IN", checkedInAt: new Date("2026-10-26T02:30:00Z"), checkedInBy: "Ana" },
      "e1",
    );
    expect(d).toEqual({ kind: "already", message: "Ya ingresó a las 20:30 por Ana" });
  });

  it("refuses unpaid statuses with the status label", () => {
    const d = checkInDecision({ ...base, status: "PENDING_VALIDATION" }, "e1");
    expect(d).toEqual({ kind: "denied", message: "Pago no confirmado: Pendiente de validar" });
    expect(checkInDecision({ ...base, status: "REJECTED" }, "e1").kind).toBe("denied");
    expect(checkInDecision({ ...base, status: "PENDING_RECEIPT" }, "e1").kind).toBe("denied");
  });

  it("asks to collect the whole order amount for a cash pre-registration", () => {
    const d = checkInDecision({ ...base, status: "PENDING_CASH", order: { amountCents: 70_000, quantity: 2 } }, "e1");
    expect(d).toEqual({ kind: "collect", amount: "$700.00", quantity: 2, message: "Cobrar $700.00 en efectivo (2 boletos)" });
    const one = checkInDecision({ ...base, status: "PENDING_CASH", order: { amountCents: 35_000, quantity: 1 } }, "e1");
    expect(one).toMatchObject({ kind: "collect", message: "Cobrar $350.00 en efectivo (1 boleto)" });
  });

  it("never asks to collect when the amount is unknown or the ticket is from another event", () => {
    expect(checkInDecision({ ...base, status: "PENDING_CASH" }, "e1").kind).toBe("denied");
    const other = { ...base, status: "PENDING_CASH", order: { amountCents: 100, quantity: 1 } };
    expect(checkInDecision(other, "e2")).toEqual({ kind: "denied", message: "Boleto de otro evento" });
    expect(checkInDecision(other, "e1", { eventCancelled: true })).toEqual({ kind: "denied", message: "Evento cancelado" });
  });

  it("refuses cancelled tickets", () => {
    expect(checkInDecision({ ...base, status: "CANCELLED" }, "e1")).toEqual({ kind: "denied", message: "Cancelado" });
  });

  it("refuses tickets of another event before anything else", () => {
    expect(checkInDecision({ ...base, status: "CHECKED_IN" }, "e2")).toEqual({
      kind: "denied",
      message: "Boleto de otro evento",
    });
  });
});

describe("parseWalkIn", () => {
  it("requires a name", () => {
    expect(parseWalkIn({ name: "  " })).toEqual({ errors: { name: "Ingresa el nombre" } });
  });

  it("accepts name only", () => {
    expect(parseWalkIn({ name: " Ana " })).toEqual({ data: { name: "Ana", email: null, phone: null } });
  });

  it("lowercases and validates optional email", () => {
    expect(parseWalkIn({ name: "Ana", email: " ANA@Mail.com " })).toEqual({
      data: { name: "Ana", email: "ana@mail.com", phone: null },
    });
    expect(parseWalkIn({ name: "Ana", email: "nope" })).toEqual({ errors: { email: "Ingresa un correo válido" } });
  });

  it("validates optional phone", () => {
    expect(parseWalkIn({ name: "Ana", phone: "55 1234 5678" })).toEqual({
      data: { name: "Ana", email: null, phone: "55 1234 5678" },
    });
    expect(parseWalkIn({ name: "Ana", phone: "abc" })).toEqual({ errors: { phone: "Ingresa un teléfono válido" } });
  });

  it("rejects non-object and oversized input", () => {
    expect(parseWalkIn(null).errors?.name).toBeDefined();
    expect(parseWalkIn({ name: "a".repeat(200) }).errors?.name).toBeDefined();
  });
});

describe("isRepeatScan", () => {
  it("ignores the same value inside the window only", () => {
    const last = { value: "abc", at: 1000 };
    expect(isRepeatScan(last, "abc", 3999, 3000)).toBe(true);
    expect(isRepeatScan(last, "abc", 4000, 3000)).toBe(false);
    expect(isRepeatScan(last, "other", 1500, 3000)).toBe(false);
    expect(isRepeatScan(null, "abc", 1500, 3000)).toBe(false);
  });
});

describe("search code clause", () => {
  it("is null when the query cannot be a code prefix", () => {
    expect(parseSearchQuery("Ana Perez")?.code).toBeNull();
    expect(parseSearchQuery("7K3Q9MX")?.code).toBeNull();
    expect(parseSearchQuery("u!")?.code).toBeNull();
    expect(parseSearchQuery("100%")?.code).toBeNull();
  });

  it("is kept for plausible prefixes", () => {
    expect(parseSearchQuery("7k3")?.code).toBe("7K3");
    expect(parseSearchQuery("Ana")?.code).toBe("ANA");
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("checkInDecision with a cancelled event", () => {
  it("denies even a paid ticket", () => {
    const t = { eventId: "e1", status: "PAID", checkedInAt: null, checkedInBy: null };
    expect(checkInDecision(t, "e1", { eventCancelled: true })).toEqual({ kind: "denied", message: "Evento cancelado" });
  });
});

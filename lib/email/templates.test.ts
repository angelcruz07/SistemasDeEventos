import { describe, expect, it } from "vitest";
import { renderRegistrationReceived, renderTicketIssued, renderTicketRejected } from "./templates";

const base = {
  name: "Ana",
  eventTitle: "Gala 2026",
  shortCode: "7K3-Q9M",
  ticketUrl: "https://app.test/ticket/abc.def",
};

const spei = {
  clabe: "012345678901234567",
  bank: "BBVA",
  beneficiary: "Club Gala AC",
  amount: "$350.00",
  concept: "7K3-Q9M",
};

describe("renderRegistrationReceived", () => {
  it("includes SPEI data, the concept and the upload link in html and text", () => {
    const m = renderRegistrationReceived({ ...base, spei });
    expect(m.subject).toBe("Recibimos tu registro: Gala 2026");
    for (const body of [m.html, m.text]) {
      expect(body).toContain("012345678901234567");
      expect(body).toContain("BBVA");
      expect(body).toContain("Club Gala AC");
      expect(body).toContain("$350.00");
      expect(body).toContain("7K3-Q9M");
      expect(body).toContain("https://app.test/ticket/abc.def");
    }
  });

  it("omits the SPEI block when there are no payment details", () => {
    const m = renderRegistrationReceived(base);
    expect(m.html).not.toContain("CLABE");
    expect(m.text).toContain("https://app.test/ticket/abc.def");
  });

  it("escapes user-provided values in html but not in text", () => {
    const m = renderRegistrationReceived({
      ...base,
      name: `<script>alert("x")</script>`,
      eventTitle: `Fiesta & <b>Baile</b>`,
      spei: { ...spei, beneficiary: `"><img src=x onerror=alert(1)>` },
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(m.html).toContain("Fiesta &amp; &lt;b&gt;Baile&lt;/b&gt;");
    expect(m.text).toContain(`<script>alert("x")</script>`);
  });

  it("strips line breaks from the subject to prevent header injection", () => {
    const m = renderRegistrationReceived({ ...base, eventTitle: "Gala\r\nBcc: evil@x.com" });
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.subject).toBe("Recibimos tu registro: Gala Bcc: evil@x.com");
  });

  it("rejects a non-http ticket url", () => {
    expect(() => renderRegistrationReceived({ ...base, ticketUrl: "javascript:alert(1)" })).toThrow();
  });
});

describe("renderTicketIssued", () => {
  const ticket = {
    ...base,
    qrUrl: "https://app.test/api/tickets/abc.def/qr.png",
    dateText: "sábado, 31 de octubre de 2026",
    time: "20:00",
    location: "Salón Central",
  };

  it("includes the QR image, the link, code and event details", () => {
    const m = renderTicketIssued(ticket);
    expect(m.subject).toBe("Tu boleto: Gala 2026");
    expect(m.html).toContain(`<img src="https://app.test/api/tickets/abc.def/qr.png"`);
    for (const body of [m.html, m.text]) {
      expect(body).toContain("7K3-Q9M");
      expect(body).toContain("https://app.test/ticket/abc.def");
      expect(body).toContain("Salón Central");
      expect(body).toContain("20:00");
    }
  });

  it("escapes the location and name", () => {
    const m = renderTicketIssued({ ...ticket, location: "<i>Sala</i>", name: "A&B" });
    expect(m.html).toContain("&lt;i&gt;Sala&lt;/i&gt;");
    expect(m.html).toContain("A&amp;B");
  });
});

describe("renderTicketRejected", () => {
  it("shows the reason and the re-upload link, escaped in html", () => {
    const m = renderTicketRejected({ ...base, reason: `Monto <incorrecto> & borroso` });
    expect(m.subject).toBe("No pudimos validar tu pago: Gala 2026");
    expect(m.html).toContain("Monto &lt;incorrecto&gt; &amp; borroso");
    expect(m.text).toContain("Monto <incorrecto> & borroso");
    expect(m.text).toContain("https://app.test/ticket/abc.def");
  });
});

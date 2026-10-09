import { formatMxn } from "@/lib/ticketing/money";

export interface SpeiDetails {
  clabe: string | null;
  bank: string | null;
  beneficiary: string | null;
  amountCents: number;
  /** Already formatted short code, used as the transfer concept. */
  concept: string;
}

export function SpeiInstructions({ clabe, bank, beneficiary, amountCents, concept }: SpeiDetails) {
  const rows: [string, string | null][] = [
    ["CLABE", clabe],
    ["Banco", bank],
    ["Beneficiario", beneficiary],
    ["Monto", formatMxn(amountCents)],
    ["Concepto", concept],
  ];
  return (
    <section aria-labelledby="spei-title" className="space-y-3">
      <h2 id="spei-title" className="text-base font-semibold">
        Paga por transferencia SPEI
      </h2>
      <dl className="divide-y rounded-md border text-sm">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:justify-between">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all font-mono font-medium">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="text-sm text-muted-foreground">
        Usa el concepto indicado para que podamos identificar tu pago y después sube tu comprobante.
      </p>
    </section>
  );
}

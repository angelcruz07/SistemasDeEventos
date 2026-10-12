import { formatMxn } from "@/lib/ticketing/money";
import { CopyButton } from "./CopyButton";

export interface SpeiDetails {
  clabe: string | null;
  bank: string | null;
  beneficiary: string | null;
  amountCents: number;
  /** Already formatted short code, used as the transfer concept. */
  concept: string;
}

export function SpeiInstructions({ clabe, bank, beneficiary, amountCents, concept }: SpeiDetails) {
  // [label, displayed value, value to copy (null = not copyable)]
  const rows: [string, string | null, string | null][] = [
    ["CLABE", clabe, clabe],
    ["Banco", bank, null],
    ["Beneficiario", beneficiary, beneficiary],
    // Banking apps reject "$" and thousands separators when pasting the amount.
    ["Monto", formatMxn(amountCents), (amountCents / 100).toFixed(2)],
    ["Concepto", concept, concept],
  ];
  return (
    <section aria-labelledby="spei-title" className="space-y-3">
      <h2 id="spei-title" className="text-base font-semibold">
        Paga por transferencia SPEI
      </h2>
      <dl className="divide-y rounded-md border text-sm">
        {rows.map(([label, value, copyValue]) =>
          value ? (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all font-mono font-medium">{value}</dd>
              </div>
              {copyValue ? <CopyButton value={copyValue} label={`Copiar ${label === "CLABE" ? label : label.toLowerCase()}`} /> : null}
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

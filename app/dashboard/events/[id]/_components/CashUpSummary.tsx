import type { computeCashUp } from "@/lib/ticketing/cash-up";

type CashUp = ReturnType<typeof computeCashUp>;

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "boleto" : "boletos"}`;

export function CashUpSummary({ summary, exportHref }: { summary: CashUp; exportHref: string }) {
  const { byMethod, formatted } = summary;
  return (
    <section className="space-y-2" aria-label="Corte de caja">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          Ingresaron {summary.checkedIn} de {summary.paidTotal} pagados
        </h2>
        <a href={exportHref} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent" download>
          Exportar CSV
        </a>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Card label="Efectivo" value={formatted.CASH} hint={plural(byMethod.CASH.count)} />
        <Card label="SPEI" value={formatted.SPEI} hint={plural(byMethod.SPEI.count)} />
        <Card label="Gratis" value={String(byMethod.FREE.count)} />
        <Card label="Total cobrado" value={formatted.total} />
      </div>
    </section>
  );
}

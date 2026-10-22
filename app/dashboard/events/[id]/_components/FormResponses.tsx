import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber, type FieldSummary } from "@/lib/ticketing/event-stats";
import { BarList, ChartCard, EmptyChart } from "./StatsCharts";

const TYPE_LABELS: Record<FieldSummary["field"]["type"], string> = {
  text: "Respuesta corta",
  textarea: "Párrafo",
  select: "Opción múltiple",
  checkbox: "Casilla",
  number: "Número",
  phone: "Teléfono",
};

const plural = (n: number) => `${formatNumber(n)} ${n === 1 ? "respuesta" : "respuestas"}`;

function MiniStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value === null ? "—" : formatNumber(value)}</p>
    </div>
  );
}

function FieldCard({ summary, eventId }: { summary: FieldSummary; eventId: string }) {
  const { field, responses } = summary;
  const description = `${TYPE_LABELS[field.type]}${field.required ? " · obligatoria" : ""} · ${plural(responses)}`;

  let body: React.ReactNode;
  if (responses === 0) {
    body = <EmptyChart>Aún no hay respuestas para esta pregunta.</EmptyChart>;
  } else if (summary.kind === "choice") {
    body = <BarList items={summary.items} />;
  } else if (summary.kind === "number") {
    body = (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniStat label="Promedio" value={summary.mean} />
          <MiniStat label="Mediana" value={summary.median} />
          <MiniStat label="Mínimo" value={summary.min} />
          <MiniStat label="Máximo" value={summary.max} />
        </div>
        <BarList items={summary.items} />
      </div>
    );
  } else if (summary.kind === "text") {
    body = (
      <div className="space-y-4">
        {summary.top.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Respuestas que se repiten</p>
            <BarList items={summary.top} />
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {responses > summary.recent.length ? `Últimas ${summary.recent.length} respuestas` : "Respuestas"}
          </p>
          <ul className="max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
            {summary.recent.map((text, i) => (
              <li key={i} className="px-3 py-2 break-words">
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  } else {
    body = (
      <p className="text-sm text-muted-foreground">
        {plural(responses)}. Los datos de contacto se consultan en{" "}
        <Link href={`/dashboard/events/${eventId}/attendees`} className="underline hover:text-foreground">
          Asistentes
        </Link>{" "}
        o en el CSV.
      </p>
    );
  }

  return (
    <ChartCard title={field.label} description={description}>
      {body}
    </ChartCard>
  );
}

export type ResponseScope = "all" | "paid";

export function FormResponses({
  eventId,
  summaries,
  scope,
  totalResponses,
}: {
  eventId: string;
  summaries: FieldSummary[];
  scope: ResponseScope;
  totalResponses: number;
}) {
  const base = `/dashboard/events/${eventId}/stats`;
  const scopes: Array<{ value: ResponseScope; label: string; href: string }> = [
    { value: "all", label: "Todos los registros", href: `${base}#respuestas` },
    { value: "paid", label: "Solo pagados", href: `${base}?scope=paid#respuestas` },
  ];

  return (
    <section id="respuestas" className="space-y-3 scroll-mt-4" aria-label="Respuestas del formulario">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Respuestas del formulario</h2>
          <p className="text-xs text-muted-foreground">
            {plural(totalResponses)} · resumen por pregunta, como en Google Forms
          </p>
        </div>
        <nav className="inline-flex rounded-md border p-0.5 text-xs w-fit" aria-label="Qué registros incluir">
          {scopes.map((s) => (
            <Link
              key={s.value}
              href={s.href}
              scroll={false}
              aria-current={scope === s.value ? "true" : undefined}
              className={cn(
                "rounded px-2.5 py-1 transition-colors",
                scope === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {summaries.length === 0 ? (
        <EmptyChart>
          <span>
            Este evento no tiene preguntas personalizadas.{" "}
            <Link href={`/dashboard/events/${eventId}/form`} className="underline hover:text-foreground">
              Agrega preguntas en Formulario
            </Link>
            .
          </span>
        </EmptyChart>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {summaries.map((s) => (
            <FieldCard key={s.field.id} summary={s} eventId={eventId} />
          ))}
        </div>
      )}
    </section>
  );
}

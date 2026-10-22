import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/ticketing/event-stats";

/* Small, dependency-free chart pieces for the event stats tab. Server components: hover
 * tooltips are pure CSS (group-hover / group-focus-visible), so nothing ships to the client. */

export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = "rounded-lg border bg-card p-3 sm:p-4";
  return href ? (
    <Link href={href} className={cn(cls, "block hover:bg-accent transition-colors")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border bg-card p-4 min-w-0", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground text-center px-4">
      {children}
    </div>
  );
}

/** Rounds up to 1, 2 or 5 x 10^n so the axis reads cleanly. */
function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  const r = max / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}

export interface ColumnPoint {
  key: string;
  /** Short axis label. */
  label: string;
  value: number;
  /** Tooltip lines; the first one is the heading. */
  tooltip: string[];
}

/**
 * Vertical columns from one baseline. Axis labels are thinned so they never collide; every
 * column has a hover/focus tooltip and the whole series is available as a table.
 */
export function ColumnChart({
  points,
  valueLabel,
  tableHeaders,
  tableRows,
}: {
  points: ColumnPoint[];
  valueLabel: string;
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
}) {
  const max = niceCeil(Math.max(...points.map((p) => p.value)));
  const half = max / 2;
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const n = points.length;
  // First and last always; in between every k-th, skipping one that would crowd the last label.
  const showLabel = (i: number) =>
    i === 0 || i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= Math.ceil(labelEvery / 2));

  return (
    <div>
      <div className="flex gap-2">
        {/* y axis */}
        <div className="relative h-44 w-8 shrink-0 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatNumber(max)}</span>
          {Number.isInteger(half) && <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatNumber(half)}</span>}
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          {/* grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44" aria-hidden>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
            <div className="absolute inset-x-0 bottom-0 border-t border-border" />
          </div>
          {/* columns */}
          <ol className="relative flex h-44 items-end gap-0.5" aria-label={valueLabel}>
            {points.map((p, i) => {
              const align = i < n * 0.25 ? "left-0" : i >= n * 0.75 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <li
                  key={p.key}
                  tabIndex={0}
                  aria-label={p.tooltip.join(", ")}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                >
                  <div
                    className={cn(
                      "relative w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity",
                      "group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    )}
                    style={{ height: p.value > 0 ? `max(2px, ${(p.value / max) * 100}%)` : 0 }}
                  >
                    {/* Inside the bar so the tooltip sits right above the column's top. */}
                    <div
                      role="tooltip"
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md",
                        "group-hover:block group-focus-visible:block",
                        align,
                      )}
                    >
                      <p className="font-medium">{p.tooltip[0]}</p>
                      {p.tooltip.slice(1).map((line) => (
                        <p key={line} className="text-muted-foreground tabular-nums">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {/* x axis */}
          <div className="relative mt-1.5 flex h-4 gap-0.5 text-[10px] text-muted-foreground" aria-hidden>
            {points.map((p, i) => (
              <div key={p.key} className="relative min-w-0 flex-1">
                {showLabel(i) && (
                  <span
                    className={cn(
                      "absolute top-0 whitespace-nowrap",
                      i === 0 ? "left-0" : i === n - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {p.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <DataTable headers={tableHeaders} rows={tableRows} />
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground w-fit">Ver tabla</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-left tabular-nums">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface BarListItem {
  label: string;
  count: number;
  /** 0..1, drawn as the bar length and printed as a percentage. */
  share: number;
  /** Extra text after the count, e.g. an amount of money. */
  hint?: string;
}

/**
 * Horizontal bars, one per row, like the Google Forms summary: label, value and share are
 * always printed, so the bar length is never the only carrier of the number.
 */
export function BarList({ items, showShare = true }: { items: BarListItem[]; showShare?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} title={`${item.label}: ${item.count}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{formatNumber(item.count)}</span>
              {showShare && <> · {formatPercent(item.share)}</>}
              {item.hint && <> · {item.hint}</>}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-r-[4px] bg-muted">
            <div
              className="h-full rounded-r-[4px] bg-chart-1"
              style={{ width: item.count > 0 ? `max(3px, ${Math.min(1, item.share) * 100}%)` : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

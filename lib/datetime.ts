const MX_TIME_ZONE = "America/Mexico_City";

const mxFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: MX_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Formats an instant as `DD/MM/YYYY HH:mm` in Mexico City time. */
export function formatMx(date: Date | string): string {
  const parts = Object.fromEntries(
    mxFormatter.formatToParts(new Date(date)).map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

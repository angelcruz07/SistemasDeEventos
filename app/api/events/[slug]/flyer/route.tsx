import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import prisma from "@/app/lib/prisma";
import { formatEventDate } from "@/lib/datetime";
import { deriveEventTheme } from "@/lib/ticketing/event-theme";
import {
  FLYER_FORMATS,
  cloudinaryJpegUrl,
  cloudinaryTransform,
  flyerFilename,
  flyerTitleFontSize,
  parseFlyerFormat,
  truncateText,
} from "@/lib/ticketing/flyer";
import { formatMxn } from "@/lib/ticketing/money";
import { parseTicketDesign, sanitizeImageUrl } from "@/lib/ticketing/ticket-design";

export const runtime = "nodejs";

const IMAGE_TIMEOUT_MS = 4000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const TITLE_MAX = 90;
const LOCATION_MAX = 60;

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * The renderer fetches <img> sources itself, so we fetch only sanitized Cloudinary URLs
 * ourselves and inline them as data URLs. Any failure degrades to "no image" instead of a 500.
 */
async function fetchImageDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), redirect: "error" });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || (type !== "image/jpeg" && type !== "image/png")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > IMAGE_MAX_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams, origin } = new URL(request.url);
  const format = parseFlyerFormat(searchParams.get("format"));
  const { width, height } = FLYER_FORMATS[format];

  // Same whitelist as the public event page: nothing here is private.
  const event = await prisma.event.findFirst({
    where: { slug, isCancelled: false },
    select: {
      slug: true,
      title: true,
      date: true,
      time: true,
      location: true,
      priceCents: true,
      ticketDesign: true,
      images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
    },
  });
  if (!event) return notFound();

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const design = parseTicketDesign(event.ticketDesign, cloudName);
  const theme = deriveEventTheme(design);
  const coverUrl = sanitizeImageUrl(event.images[0]?.url, cloudName) ?? design.headerImageUrl;
  const logoUrl = design.logoUrl;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || origin).replace(/\/+$/, "");
  const [qr, cover, logo] = await Promise.all([
    QRCode.toDataURL(`${appUrl}/event/${encodeURIComponent(event.slug)}`, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
    }),
    fetchImageDataUrl(coverUrl && cloudinaryJpegUrl(coverUrl, width, 900)),
    fetchImageDataUrl(logoUrl && cloudinaryTransform(logoUrl, "f_png,c_limit,w_320,h_160")),
  ]);

  const title = truncateText(event.title, TITLE_MAX);
  const price = event.priceCents > 0 ? formatMxn(event.priceCents) : "Gratis";
  const details = [
    formatEventDate(event.date),
    event.time,
    truncateText(event.location || "Ubicación por confirmar", LOCATION_MAX),
  ];

  /* eslint-disable @next/next/no-img-element -- rendered by next/og, not the browser */
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: theme.background,
          color: theme.text,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 200,
            display: "flex",
            position: "relative",
            overflow: "hidden",
            backgroundImage: `linear-gradient(135deg, ${theme.accent}, ${theme.background})`,
          }}
        >
          {cover && (
            <img
              src={cover}
              alt=""
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          {logo && (
            <div
              style={{
                position: "absolute",
                top: 40,
                left: 40,
                display: "flex",
                padding: 16,
                borderRadius: 20,
                backgroundColor: "#FFFFFF",
              }}
            >
              <img src={logo} alt="" style={{ maxHeight: 80, maxWidth: 240, objectFit: "contain" }} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "48px 56px 56px", gap: 32 }}>
          <div
            style={{
              display: "flex",
              fontSize: flyerTitleFontSize(title.length),
              fontWeight: 700,
              lineHeight: 1.1,
              wordBreak: "break-word",
              color: theme.text,
            }}
          >
            {title}
          </div>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14, fontSize: 34 }}>
              {details.map((line) => (
                <div key={line} style={{ display: "flex", wordBreak: "break-word" }}>
                  {line}
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  marginTop: 8,
                  padding: "10px 28px",
                  borderRadius: 999,
                  fontSize: 40,
                  fontWeight: 700,
                  backgroundColor: theme.accent,
                  color: theme.accentText,
                }}
              >
                {price}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: 270 }}>
              <div style={{ display: "flex", padding: 14, borderRadius: 20, backgroundColor: "#FFFFFF" }}>
                <img src={qr} alt="" width={242} height={242} />
              </div>
              <div style={{ display: "flex", fontSize: 24, textAlign: "center", color: theme.accentOnBackground }}>
                Regístrate escaneando el código
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        ...(searchParams.get("download") === "1" && {
          "Content-Disposition": `attachment; filename="${flyerFilename(event.slug, format)}"`,
        }),
      },
    },
  );
}

/* eslint-disable jsx-a11y/alt-text -- react-pdf Image is a PDF primitive, not an HTML img */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { TicketDesign } from "@/lib/ticketing/ticket-design";

export interface TicketDocumentProps {
  design: TicketDesign;
  eventTitle: string;
  dateLabel: string;
  time: string;
  location: string;
  attendeeName: string;
  code: string;
  qrDataUrl: string;
  /** Pre-fetched PNG/JPEG data URLs; null when absent or the fetch failed. */
  logoDataUrl: string | null;
  headerDataUrl: string | null;
}

export function TicketDocument(props: TicketDocumentProps) {
  const { design } = props;
  const s = StyleSheet.create({
    page: { padding: 32, backgroundColor: design.backgroundColor, color: design.textColor, fontFamily: "Helvetica" },
    card: { borderWidth: 2, borderColor: design.accentColor, borderRadius: 8, overflow: "hidden" },
    header: { width: "100%", height: 120, objectFit: "cover" },
    body: { padding: 20, alignItems: "center" },
    logo: { height: 40, marginBottom: 12, objectFit: "contain" },
    title: { fontSize: 22, fontFamily: "Helvetica-Bold", color: design.accentColor, textAlign: "center", marginBottom: 12 },
    line: { fontSize: 12, marginBottom: 4, textAlign: "center" },
    label: { fontSize: 9, marginTop: 14, opacity: 0.7 },
    name: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
    code: { fontSize: 20, fontFamily: "Courier-Bold", letterSpacing: 3, marginTop: 4 },
    qr: { width: 200, height: 200, marginTop: 16, backgroundColor: "#FFFFFF", padding: 6 },
    footer: { fontSize: 10, marginTop: 16, textAlign: "center", opacity: 0.8 },
  });

  return (
    <Document title={`Boleto ${props.code}`} author="Sistema de eventos">
      <Page size="A5" style={s.page}>
        <View style={s.card}>
          {design.template === "image" && props.headerDataUrl && <Image src={props.headerDataUrl} style={s.header} />}
          <View style={s.body}>
            {props.logoDataUrl && <Image src={props.logoDataUrl} style={s.logo} />}
            <Text style={s.title}>{props.eventTitle}</Text>
            <Text style={s.line}>{props.dateLabel}</Text>
            <Text style={s.line}>{props.time}</Text>
            <Text style={s.line}>{props.location}</Text>
            <Text style={s.label}>ASISTENTE</Text>
            <Text style={s.name}>{props.attendeeName}</Text>
            <Text style={s.code}>{props.code}</Text>
            <Image src={props.qrDataUrl} style={s.qr} />
            {design.footerText ? <Text style={s.footer}>{design.footerText}</Text> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

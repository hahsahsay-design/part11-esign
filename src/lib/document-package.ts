import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface AuditLine {
  sequenceNumber: number;
  timestampUtc: string;
  eventType: string;
  user: string;
  description: string;
}

/**
 * Appends a paginated "Audit Trail" section to an already-finalized signed
 * PDF (which already carries a Certificate of Completion from
 * flattenSignedDocument) — the downloadable package a QA reviewer needs
 * without opening the application separately (spec section J).
 */
export async function appendAuditTrail(pdfBytes: Uint8Array, events: AuditLine[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const rowsPerPage = 32;
  for (let i = 0; i < events.length; i += rowsPerPage) {
    const page = pdf.addPage([612, 792]);
    let y = 740;
    if (i === 0) {
      page.drawText("Audit Trail", { x: 50, y, size: 18, font: boldFont, color: rgb(0.12, 0.16, 0.35) });
      y -= 28;
    } else {
      page.drawText(`Audit Trail (continued)`, { x: 50, y, size: 12, font: boldFont, color: rgb(0.12, 0.16, 0.35) });
      y -= 22;
    }
    page.drawText("Seq", { x: 50, y, size: 8, font: boldFont });
    page.drawText("Timestamp (UTC)", { x: 85, y, size: 8, font: boldFont });
    page.drawText("Event", { x: 210, y, size: 8, font: boldFont });
    page.drawText("User", { x: 340, y, size: 8, font: boldFont });
    page.drawText("Description", { x: 420, y, size: 8, font: boldFont });
    y -= 12;
    page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 10;

    for (const event of events.slice(i, i + rowsPerPage)) {
      page.drawText(String(event.sequenceNumber), { x: 50, y, size: 7, font });
      page.drawText(event.timestampUtc.slice(0, 19).replace("T", " "), { x: 85, y, size: 7, font });
      page.drawText(truncate(event.eventType, 24), { x: 210, y, size: 7, font });
      page.drawText(truncate(event.user, 18), { x: 340, y, size: 7, font });
      page.drawText(truncate(event.description, 60), { x: 420, y, size: 7, font });
      y -= 13;
    }
  }

  return pdf.save();
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface FlattenField {
  page: number; // 1-indexed
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  kind: "TEXT" | "SIGNATURE";
  lines: string[]; // 1 line for TEXT/DATE/CHECKBOX; 2-3 for a signature manifestation
}

export interface CertificateSigner {
  name: string;
  email: string;
  meaning: string;
  signedAtIso: string;
  ipAddress: string | null;
}

export interface FlattenInput {
  pdfBytes: Buffer;
  fields: FlattenField[];
  certificate: {
    documentTitle: string;
    requestTitle: string;
    completedAtIso: string;
    originalHash: string;
    finalHashPlaceholder?: string;
    signers: CertificateSigner[];
  };
}

/**
 * Produces the finalized, signed-record PDF: the original pages with each
 * completed field's value or signature manifestation stamped at its
 * recorded position, plus an appended certificate-of-completion page
 * summarizing who signed, what each signature meant, and when — the kind of
 * evidence a QA reviewer needs without opening the audit trail separately.
 * Signatures are rendered as text manifestations (printed name + meaning +
 * UTC timestamp), never as a drawn image standing in for the signature.
 */
export async function flattenSignedDocument(input: FlattenInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.pdfBytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const pages = pdf.getPages();

  for (const field of input.fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();

    const boxX = (field.xPct / 100) * width;
    const boxTopY = height - (field.yPct / 100) * height;
    const boxW = (field.widthPct / 100) * width;
    const boxH = (field.heightPct / 100) * height;
    const boxBottomY = boxTopY - boxH;

    if (field.kind === "SIGNATURE") {
      page.drawRectangle({
        x: boxX,
        y: boxBottomY,
        width: boxW,
        height: boxH,
        borderColor: rgb(0.12, 0.16, 0.35),
        borderWidth: 0.75,
        color: rgb(0.96, 0.97, 1),
      });
      const lineHeight = Math.max(8, Math.min(11, boxH / Math.max(input.certificate ? 3 : 1, field.lines.length)));
      let y = boxBottomY + boxH - lineHeight;
      field.lines.forEach((line, i) => {
        page.drawText(line, {
          x: boxX + 4,
          y: Math.max(boxBottomY + 2, y),
          size: i === 0 ? Math.min(11, lineHeight) : Math.min(7, lineHeight - 1),
          font: i === 0 ? italicFont : font,
          color: i === 0 ? rgb(0.1, 0.15, 0.4) : rgb(0.35, 0.35, 0.35),
        });
        y -= lineHeight;
      });
    } else {
      page.drawText(field.lines[0] ?? "", {
        x: boxX + 2,
        y: boxBottomY + Math.max(2, boxH / 2 - 5),
        size: 10,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
  }

  // Certificate of completion — appended, never inserted among the original pages.
  const cert = pdf.addPage([612, 792]);
  let y = 740;
  cert.drawText("Certificate of Completion", { x: 50, y, size: 18, font: boldFont, color: rgb(0.12, 0.16, 0.35) });
  y -= 28;
  cert.drawText(input.certificate.documentTitle, { x: 50, y, size: 12, font: boldFont });
  y -= 18;
  cert.drawText(`Signature request: ${input.certificate.requestTitle}`, { x: 50, y, size: 10, font });
  y -= 14;
  cert.drawText(`Completed: ${input.certificate.completedAtIso}`, { x: 50, y, size: 10, font });
  y -= 14;
  cert.drawText(`Original document SHA-256: ${input.certificate.originalHash}`, { x: 50, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
  y -= 28;
  cert.drawText("Signers", { x: 50, y, size: 12, font: boldFont });
  y -= 18;
  for (const signer of input.certificate.signers) {
    cert.drawText(`/s/ ${signer.name} <${signer.email}>`, { x: 50, y, size: 10, font: italicFont });
    y -= 13;
    cert.drawText(
      `   ${signer.meaning} — ${signer.signedAtIso} UTC${signer.ipAddress ? `  (IP ${signer.ipAddress})` : ""}`,
      { x: 50, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) },
    );
    y -= 20;
  }
  y -= 10;
  cert.drawText(
    "This certificate summarizes the signing event for human review. The authoritative, cryptographically",
    { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) },
  );
  y -= 11;
  cert.drawText(
    "bound record of each signature is stored in the platform's audit trail and electronic signature records.",
    { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) },
  );

  return pdf.save();
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { getObject } from "@/lib/storage";
import { appendAuditTrail } from "@/lib/document-package";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

// The full compliance package for one signature request (spec section J):
// the finalized signed PDF — which already carries a Certificate of
// Completion — plus every audit event tied to this document or request,
// appended as additional pages.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership, session } = await requireApiContext("audit.export");

    const sigRequest = await prisma.signatureRequest.findFirst({
      where: { id, organizationId: membership.organizationId },
      include: { document: true, finalVersion: true },
    });
    if (!sigRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!sigRequest.finalVersion) {
      return NextResponse.json({ error: "This request has not been completed yet — there is no final signed record." }, { status: 409 });
    }

    const finalBytes = await getObject(sigRequest.finalVersion.storageKey);

    const events = await prisma.auditEvent.findMany({
      where: {
        organizationId: membership.organizationId,
        OR: [{ documentId: sigRequest.documentId }, { signatureRequestId: sigRequest.id }],
      },
      include: { user: true },
      orderBy: { sequenceNumber: "asc" },
    });

    const packageBytes = await appendAuditTrail(
      finalBytes,
      events.map((e) => ({
        sequenceNumber: e.sequenceNumber,
        timestampUtc: e.timestampUtc.toISOString(),
        eventType: e.eventType,
        user: e.user?.fullName ?? "",
        description: e.description,
      })),
    );

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      documentId: sigRequest.documentId,
      signatureRequestId: sigRequest.id,
      eventType: "COMPLIANCE_REPORT_EXPORTED",
      description: `${user.fullName} downloaded the complete compliance package for "${sigRequest.document.title}".`,
      ipAddress: requestIp(request.headers),
      sessionId: session.id,
    });

    return new NextResponse(new Blob([Uint8Array.from(packageBytes)]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sigRequest.document.title.replace(/[^a-z0-9]+/gi, "-")}-compliance-package.pdf"`,
      },
    });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

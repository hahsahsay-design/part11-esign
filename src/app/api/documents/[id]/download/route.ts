import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { getObject } from "@/lib/storage";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership, session } = await requireApiContext("documents.view_all");

    const document = await prisma.document.findFirst({
      where: { id, organizationId: membership.organizationId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!document || document.versions.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const version = document.versions[0];
    const bytes = await getObject(version.storageKey);

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      documentId: document.id,
      eventType: "DOCUMENT_DOWNLOADED",
      description: `${user.fullName} downloaded "${document.title}" (version ${version.versionNumber}).`,
      ipAddress: requestIp(request.headers),
      sessionId: session.id,
    });

    return new NextResponse(new Blob([Uint8Array.from(bytes)]), {
      headers: {
        "Content-Type": version.mimeType,
        "Content-Disposition": `attachment; filename="${version.originalFileName}"`,
      },
    });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

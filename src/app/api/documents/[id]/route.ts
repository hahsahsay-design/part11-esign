import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError, hasPermission } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { membership } = await requireApiContext("documents.view_all");
    const document = await prisma.document.findFirst({
      where: { id, organizationId: membership.organizationId },
      include: { versions: { orderBy: { versionNumber: "desc" } }, folder: true },
    });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ document });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, membership, session } = await requireApiContext();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const existing = await prisma.document.findFirst({
      where: { id, organizationId: membership.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (
      (parsed.data.title !== undefined || parsed.data.folderId !== undefined) &&
      !(await hasPermission(membership, "documents.rename"))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (parsed.data.archived !== undefined && !(await hasPermission(membership, "documents.archive"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: { title?: string; folderId?: string | null; status?: "ARCHIVED" | "DRAFT"; archivedAt?: Date | null } = {};
    const ip = requestIp(request.headers);

    if (parsed.data.title && parsed.data.title !== existing.title) {
      data.title = parsed.data.title;
      await recordAuditEvent({
        organizationId: membership.organizationId,
        userId: user.id,
        documentId: id,
        eventType: "DOCUMENT_RENAMED",
        description: `${user.fullName} renamed "${existing.title}" to "${parsed.data.title}".`,
        ipAddress: ip,
        sessionId: session.id,
        previousValue: { title: existing.title },
        newValue: { title: parsed.data.title },
      });
    }

    if (parsed.data.folderId !== undefined && parsed.data.folderId !== existing.folderId) {
      data.folderId = parsed.data.folderId;
      await recordAuditEvent({
        organizationId: membership.organizationId,
        userId: user.id,
        documentId: id,
        eventType: "DOCUMENT_MOVED",
        description: `${user.fullName} moved "${existing.title}" to a different folder.`,
        ipAddress: ip,
        sessionId: session.id,
        previousValue: { folderId: existing.folderId },
        newValue: { folderId: parsed.data.folderId },
      });
    }

    if (parsed.data.archived !== undefined) {
      const willArchive = parsed.data.archived;
      if (willArchive && existing.legalHoldId) {
        return NextResponse.json({ error: "This document is under legal hold and cannot be archived." }, { status: 409 });
      }
      if (willArchive && existing.status !== "ARCHIVED") {
        data.status = "ARCHIVED";
        data.archivedAt = new Date();
        await recordAuditEvent({
          organizationId: membership.organizationId,
          userId: user.id,
          documentId: id,
          eventType: "DOCUMENT_ARCHIVED",
          description: `${user.fullName} archived "${existing.title}".`,
          ipAddress: ip,
          sessionId: session.id,
        });
      } else if (!willArchive && existing.status === "ARCHIVED") {
        data.status = "DRAFT";
        data.archivedAt = null;
        await recordAuditEvent({
          organizationId: membership.organizationId,
          userId: user.id,
          documentId: id,
          eventType: "ADMIN_ACTION",
          description: `${user.fullName} unarchived "${existing.title}".`,
          ipAddress: ip,
          sessionId: session.id,
        });
      }
    }

    const document = await prisma.document.update({ where: { id }, data });
    return NextResponse.json({ document });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import type { Prisma, DocumentStatus } from "@/generated/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { putObject, documentStorageKey } from "@/lib/storage";
import { sha256Hex } from "@/lib/crypto";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";
import { assertUnderDocumentLimit, UsageLimitExceededError } from "@/lib/usage-limits";

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const { membership } = await requireApiContext("documents.view_all");
    const url = new URL(request.url);
    const search = url.searchParams.get("q")?.trim();
    const status = url.searchParams.get("status");
    const folderId = url.searchParams.get("folderId");

    const where: Prisma.DocumentWhereInput = { organizationId: membership.organizationId };
    if (search) where.title = { contains: search, mode: "insensitive" };
    if (status && status !== "ALL") where.status = status as DocumentStatus;
    if (folderId) where.folderId = folderId === "none" ? null : folderId;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 }, folder: true },
    });
    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, membership, session } = await requireApiContext("documents.upload");

    try {
      await assertUnderDocumentLimit(membership.organizationId);
    } catch (e) {
      if (e instanceof UsageLimitExceededError) return NextResponse.json({ error: e.message }, { status: 402 });
      throw e;
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "");
    const folderId = formData.get("folderId");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF documents are supported." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds the 25MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256Hash = sha256Hex(buffer);

    let pageCount: number | null = null;
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdf.getPageCount();
    } catch {
      return NextResponse.json({ error: "This file could not be read as a valid PDF." }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        organizationId: membership.organizationId,
        title: title.trim() || file.name,
        status: "DRAFT",
        createdById: user.id,
        folderId: typeof folderId === "string" && folderId ? folderId : null,
      },
    });

    const storageKey = documentStorageKey(membership.organizationId, document.id, 1, file.name);
    await putObject(storageKey, buffer);

    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        kind: "ORIGINAL",
        originalFileName: file.name,
        storageKey,
        mimeType: file.type,
        fileSizeBytes: file.size,
        sha256Hash,
        pageCount,
        createdById: user.id,
      },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      documentId: document.id,
      eventType: "DOCUMENT_UPLOADED",
      description: `${user.fullName} uploaded "${document.title}" (${(file.size / 1024).toFixed(0)} KB, sha256 ${sha256Hash.slice(0, 12)}…).`,
      ipAddress: requestIp(request.headers),
      sessionId: session.id,
      newValue: { documentId: document.id, versionId: version.id, sha256Hash },
    });

    return NextResponse.json({ document, version }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

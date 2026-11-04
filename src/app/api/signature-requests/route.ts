import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";
import { newRecipientToken, sendSigningInvitation } from "@/lib/signing-notifications";

const fieldSchema = z.object({
  recipientTempId: z.string(),
  type: z.enum(["SIGNATURE", "INITIALS", "DATE", "TEXT", "CHECKBOX"]),
  page: z.number().int().min(1),
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  widthPct: z.number().min(0.5).max(100),
  heightPct: z.number().min(0.5).max(100),
  required: z.boolean().default(true),
  label: z.string().max(120).nullable().optional(),
  meaningCode: z.string().nullable().optional(),
});

const recipientSchema = z.object({
  tempId: z.string(),
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().min(1).max(160),
  recipientRole: z.enum(["SIGNER", "APPROVER", "CC", "WITNESS"]).default("SIGNER"),
  signingOrder: z.number().int().min(1).default(1),
});

const createSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(2000).nullable().optional(),
  signingMode: z.enum(["SEQUENTIAL", "PARALLEL"]).default("SEQUENTIAL"),
  expiresAt: z.string().datetime().nullable().optional(),
  recipients: z.array(recipientSchema).min(1),
  fields: z.array(fieldSchema),
});

export async function POST(request: Request) {
  try {
    const { user, membership, session } = await requireApiContext("signature_requests.create");
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
    }
    const input = parsed.data;
    const ip = requestIp(request.headers);

    const document = await prisma.document.findFirst({
      where: { id: input.documentId, organizationId: membership.organizationId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!document || document.versions.length === 0) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    if (document.status === "OUT_FOR_SIGNATURE") {
      return NextResponse.json({ error: "This document already has a signature request in progress." }, { status: 409 });
    }
    const sourceVersion = document.versions[0];

    const emailSet = new Set(input.recipients.map((r) => r.email));
    if (emailSet.size !== input.recipients.length) {
      return NextResponse.json({ error: "Recipient emails must be unique." }, { status: 400 });
    }
    const tempIds = new Set(input.recipients.map((r) => r.tempId));
    for (const f of input.fields) {
      if (!tempIds.has(f.recipientTempId)) {
        return NextResponse.json({ error: "A field is assigned to an unknown recipient." }, { status: 400 });
      }
    }

    const meanings = await prisma.signatureMeaning.findMany({
      where: { organizationId: membership.organizationId, active: true },
    });
    const meaningByCode = new Map(meanings.map((m) => [m.code, m]));
    const defaultMeaning = meaningByCode.get("SIGNED") ?? meanings[0];
    if (!defaultMeaning) {
      return NextResponse.json({ error: "This organization has no active signature meanings configured." }, { status: 400 });
    }
    for (const f of input.fields) {
      if ((f.type === "SIGNATURE" || f.type === "INITIALS") && f.meaningCode && !meaningByCode.has(f.meaningCode)) {
        return NextResponse.json({ error: `Unknown signature meaning "${f.meaningCode}".` }, { status: 400 });
      }
    }

    const sequential = input.signingMode === "SEQUENTIAL";
    const actingRecipients = input.recipients.filter((r) => r.recipientRole !== "CC");
    const firstOrder = sequential ? Math.min(...actingRecipients.map((r) => r.signingOrder)) : null;

    const result = await prisma.$transaction(async (tx) => {
      const sigRequest = await tx.signatureRequest.create({
        data: {
          organizationId: membership.organizationId,
          documentId: document.id,
          sourceVersionId: sourceVersion.id,
          title: input.title,
          instructions: input.instructions ?? null,
          signingMode: input.signingMode,
          status: "SENT",
          createdById: user.id,
          sentAt: new Date(),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });

      const recipientIdByTemp = new Map<string, string>();
      const tokensToSend: { recipientId: string; token: string; email: string; name: string }[] = [];
      // recordAuditEvent opens its own transaction to serialize chain
      // appends, so it cannot be called from inside this $transaction's
      // callback (the row it would reference isn't committed yet on that
      // separate connection). Collect events here and fire them after commit.
      const pendingAuditEvents: Parameters<typeof recordAuditEvent>[0][] = [];

      for (const r of input.recipients) {
        const willNotifyNow = r.recipientRole === "CC" ? false : sequential ? r.signingOrder === firstOrder : true;
        const { token, tokenHash } = newRecipientToken();
        const created = await tx.signatureRequestRecipient.create({
          data: {
            signatureRequestId: sigRequest.id,
            userId: null,
            email: r.email,
            fullName: r.fullName,
            recipientRole: r.recipientRole,
            signingOrder: r.signingOrder,
            status: willNotifyNow ? "SENT" : "PENDING",
            accessTokenHash: tokenHash,
            tokenExpiresAt: input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        recipientIdByTemp.set(r.tempId, created.id);
        if (willNotifyNow) tokensToSend.push({ recipientId: created.id, token, email: r.email, name: r.fullName });

        pendingAuditEvents.push({
          organizationId: membership.organizationId,
          userId: user.id,
          documentId: document.id,
          signatureRequestId: sigRequest.id,
          eventType: "RECIPIENT_INVITED",
          description: `${r.fullName} <${r.email}> added as ${r.recipientRole.toLowerCase()}, signing order ${r.signingOrder}.`,
          ipAddress: ip,
          sessionId: session.id,
        });
      }

      for (const f of input.fields) {
        const recipientId = recipientIdByTemp.get(f.recipientTempId);
        if (!recipientId) continue;
        const meaning = (f.type === "SIGNATURE" || f.type === "INITIALS") && f.meaningCode
          ? meaningByCode.get(f.meaningCode)
          : f.type === "SIGNATURE" || f.type === "INITIALS"
            ? defaultMeaning
            : undefined;
        await tx.signatureField.create({
          data: {
            signatureRequestId: sigRequest.id,
            documentVersionId: sourceVersion.id,
            recipientId,
            type: f.type,
            page: f.page,
            xPct: f.xPct,
            yPct: f.yPct,
            widthPct: f.widthPct,
            heightPct: f.heightPct,
            required: f.required,
            label: f.label ?? null,
            defaultMeaningId: meaning?.id ?? null,
          },
        });
      }

      await tx.document.update({ where: { id: document.id }, data: { status: "OUT_FOR_SIGNATURE" } });

      pendingAuditEvents.push({
        organizationId: membership.organizationId,
        userId: user.id,
        documentId: document.id,
        signatureRequestId: sigRequest.id,
        eventType: "SIGNATURE_REQUEST_CREATED",
        description: `${user.fullName} created signature request "${input.title}" (${input.signingMode.toLowerCase()}).`,
        ipAddress: ip,
        sessionId: session.id,
      });
      pendingAuditEvents.push({
        organizationId: membership.organizationId,
        userId: user.id,
        documentId: document.id,
        signatureRequestId: sigRequest.id,
        eventType: "SIGNATURE_REQUEST_SENT",
        description: `${user.fullName} sent "${input.title}" for signature.`,
        ipAddress: ip,
        sessionId: session.id,
      });

      return { sigRequest, tokensToSend, pendingAuditEvents };
    });

    for (const event of result.pendingAuditEvents) {
      await recordAuditEvent(event);
    }

    for (const t of result.tokensToSend) {
      await sendSigningInvitation({
        organizationId: membership.organizationId,
        recipientId: t.recipientId,
        recipientEmail: t.email,
        recipientName: t.name,
        documentTitle: document.title,
        requestTitle: input.title,
        instructions: input.instructions ?? null,
        token: t.token,
      });
    }

    return NextResponse.json({ signatureRequestId: result.sigRequest.id }, { status: 201 });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

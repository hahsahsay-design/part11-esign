import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { AuditEventType, Prisma } from "@/generated/prisma";

const GENESIS_HASH = "GENESIS";

function signingKey(): string {
  const key = process.env.AUDIT_SIGNING_KEY;
  if (!key) throw new Error("AUDIT_SIGNING_KEY is not configured");
  return key;
}

function computeHash(previousHash: string, canonicalRow: string): string {
  return createHmac("sha256", signingKey()).update(previousHash + canonicalRow).digest("hex");
}

/**
 * Deterministic JSON serialization with object keys sorted recursively.
 * Required because previousValue/newValue/metadata are stored as Postgres
 * `jsonb`, which does not preserve key order or exact formatting on
 * round-trip — a plain JSON.stringify of the value we wrote and of the same
 * value read back can legitimately differ in byte form while being the same
 * data. Hashing must use a form that both sides agree on regardless of
 * storage round-tripping.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (typeof value === "object") {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface RecordAuditEventInput {
  organizationId?: string | null;
  userId?: string | null;
  documentId?: string | null;
  signatureRequestId?: string | null;
  eventType: AuditEventType;
  description: string;
  ipAddress?: string | null;
  sessionId?: string | null;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Appends one event to the organization's (or platform's) hash-chained audit
 * log. This is the only sanctioned way to write an AuditEvent — there is no
 * update or delete path exposed anywhere in the app for this model.
 *
 * Chain integrity: concurrent appends to the same chain are serialized with a
 * transaction + row lock on the last entry, so sequenceNumber/previousHash
 * never race. See prisma/schema.prisma AuditEvent doc-comment for the
 * limitations of this tamper-detection scheme.
 */
export async function recordAuditEvent(input: RecordAuditEventInput) {
  const chainKey = input.organizationId ?? "PLATFORM";

  return prisma.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE semantics via raw query to serialize appenders on
    // this chain; Prisma has no first-class row-lock API for this.
    const [last] = await tx.$queryRaw<{ sequenceNumber: number; hash: string }[]>`
      SELECT "sequenceNumber", "hash" FROM "AuditEvent"
      WHERE "chainKey" = ${chainKey}
      ORDER BY "sequenceNumber" DESC
      LIMIT 1
      FOR UPDATE
    `;

    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const previousHash = last?.hash ?? GENESIS_HASH;
    const timestampUtc = new Date();

    const canonicalRow = canonicalStringify({
      chainKey,
      sequenceNumber,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      documentId: input.documentId ?? null,
      signatureRequestId: input.signatureRequestId ?? null,
      eventType: input.eventType,
      description: input.description,
      ipAddress: input.ipAddress ?? null,
      sessionId: input.sessionId ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      metadata: input.metadata ?? null,
      timestampUtc: timestampUtc.toISOString(),
    });

    const hash = computeHash(previousHash, canonicalRow);

    return tx.auditEvent.create({
      data: {
        chainKey,
        sequenceNumber,
        previousHash,
        hash,
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        documentId: input.documentId ?? null,
        signatureRequestId: input.signatureRequestId ?? null,
        eventType: input.eventType,
        description: input.description,
        ipAddress: input.ipAddress ?? null,
        sessionId: input.sessionId ?? null,
        previousValue: input.previousValue ?? undefined,
        newValue: input.newValue ?? undefined,
        metadata: input.metadata ?? undefined,
        timestampUtc,
      },
    });
  });
}

/** Verifies the hash chain for one chainKey, returning the first broken link if any. */
export async function verifyAuditChain(chainKey: string) {
  const events = await prisma.auditEvent.findMany({
    where: { chainKey },
    orderBy: { sequenceNumber: "asc" },
  });

  let previousHash = GENESIS_HASH;
  for (const event of events) {
    const canonicalRow = canonicalStringify({
      chainKey: event.chainKey,
      sequenceNumber: event.sequenceNumber,
      organizationId: event.organizationId,
      userId: event.userId,
      documentId: event.documentId,
      signatureRequestId: event.signatureRequestId,
      eventType: event.eventType,
      description: event.description,
      ipAddress: event.ipAddress,
      sessionId: event.sessionId,
      previousValue: event.previousValue,
      newValue: event.newValue,
      metadata: event.metadata,
      timestampUtc: event.timestampUtc.toISOString(),
    });
    const expectedHash = computeHash(previousHash, canonicalRow);
    if (expectedHash !== event.hash || event.previousHash !== previousHash) {
      return { valid: false, brokenAt: event.id, sequenceNumber: event.sequenceNumber };
    }
    previousHash = event.hash;
  }
  return { valid: true as const };
}

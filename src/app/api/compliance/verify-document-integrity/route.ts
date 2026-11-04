import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { getObject } from "@/lib/storage";
import { sha256Hex } from "@/lib/crypto";
import { recordAuditEvent } from "@/lib/audit";

export async function POST() {
  try {
    const { user, membership } = await requireApiContext("audit.view");
    const documents = await prisma.document.findMany({
      where: { organizationId: membership.organizationId },
      include: { versions: true },
    });

    const results: { documentTitle: string; versionNumber: number; storedHash: string; recomputedHash: string; match: boolean }[] = [];
    for (const doc of documents) {
      for (const v of doc.versions) {
        let recomputedHash = "ERROR";
        try {
          const bytes = await getObject(v.storageKey);
          recomputedHash = sha256Hex(Buffer.from(bytes));
        } catch {
          recomputedHash = "FILE_NOT_FOUND";
        }
        results.push({
          documentTitle: doc.title,
          versionNumber: v.versionNumber,
          storedHash: v.sha256Hash,
          recomputedHash,
          match: recomputedHash === v.sha256Hash,
        });
      }
    }

    const failures = results.filter((r) => !r.match);
    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "COMPLIANCE_REPORT_GENERATED",
      description: `${user.fullName} ran a document integrity verification across ${results.length} version(s) — ${failures.length} mismatch(es).`,
    });

    return NextResponse.json({ results, failureCount: failures.length });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

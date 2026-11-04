import { NextResponse } from "next/server";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { verifyAuditChain } from "@/lib/audit";
import { recordAuditEvent } from "@/lib/audit";

export async function POST() {
  try {
    const { user, membership, session } = await requireApiContext("audit.view");
    const result = await verifyAuditChain(membership.organizationId);
    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ADMIN_ACTION",
      description: `${user.fullName} ran an audit trail integrity check — result: ${result.valid ? "valid" : "BROKEN"}.`,
      sessionId: session.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiAuthError(error);
  }
}

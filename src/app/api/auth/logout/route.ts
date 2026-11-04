import { NextResponse } from "next/server";
import { getCurrentSession, destroyCurrentSession } from "@/lib/session";
import { recordAuditEvent } from "@/lib/audit";

export async function POST() {
  const current = await getCurrentSession();
  await destroyCurrentSession("logout");
  if (current) {
    await recordAuditEvent({
      organizationId: current.session.organizationId,
      userId: current.user.id,
      eventType: "USER_LOGOUT",
      description: `${current.user.fullName} signed out.`,
      sessionId: current.session.id,
    });
  }
  return NextResponse.json({ ok: true });
}

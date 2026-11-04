import { prisma } from "@/lib/prisma";
import type { NotificationEventType } from "@/generated/prisma";

export interface SendEmailInput {
  to: string;
  eventType: NotificationEventType;
  subject: string;
  body: string;
  organizationId?: string | null;
  relatedId?: string | null;
}

/**
 * Sends a notification email. Every send/attempt is logged to EmailLog
 * regardless of outcome, giving QA an audit trail of what notifications were
 * actually dispatched (section J: email notifications).
 *
 * No RESEND_API_KEY configured (the default in this environment) -> the
 * email is logged as SENT with the body printed to the server console
 * instead of a real network call. This keeps the full signup/signing flow
 * testable end-to-end without a paid provider, while making the gap explicit
 * rather than silently pretending delivery happened over a real provider.
 */
export async function sendEmail(input: SendEmailInput) {
  const log = await prisma.emailLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      toEmail: input.to,
      eventType: input.eventType,
      relatedId: input.relatedId ?? null,
      status: "QUEUED",
    },
  });

  const apiKey = process.env.RESEND_API_KEY;

  try {
    if (apiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: input.to,
          subject: input.subject,
          html: input.body,
        }),
      });
      if (!res.ok) throw new Error(`Resend API responded ${res.status}`);
      const data = (await res.json()) as { id?: string };
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date(), providerMessageId: data.id ?? null },
      });
    } else {
      console.log(`[dev email] to=${input.to} subject="${input.subject}"\n${input.body}`);
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date(), providerMessageId: "dev-console" },
      });
    }
  } catch (error) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) },
    });
  }

  return log;
}

import Link from "next/link";
import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  PenTool,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
} from "lucide-react";

export default async function DashboardPage() {
  const { user, membership } = await requireAuthenticatedContext();
  const organizationId = membership.organizationId;

  const [
    totalDocuments,
    awaitingMySignature,
    sentForSignature,
    completed,
    declined,
    expired,
    recentSignatures,
    recentActivity,
  ] = await Promise.all([
    prisma.document.count({ where: { organizationId } }),
    prisma.signatureRequestRecipient.count({
      where: {
        userId: user.id,
        status: { in: ["SENT", "VIEWED"] },
        signatureRequest: { organizationId },
      },
    }),
    prisma.signatureRequest.count({
      where: { organizationId, createdById: user.id, status: { in: ["SENT", "IN_PROGRESS"] } },
    }),
    prisma.signatureRequest.count({ where: { organizationId, status: "COMPLETED" } }),
    prisma.signatureRequest.count({ where: { organizationId, status: "DECLINED" } }),
    prisma.signatureRequest.count({ where: { organizationId, status: "EXPIRED" } }),
    prisma.electronicSignature.findMany({
      where: { signatureRequest: { organizationId } },
      orderBy: { signedAtUtc: "desc" },
      take: 5,
      include: { field: { include: { signatureRequest: { include: { document: true } } } }, meaning: true },
    }),
    prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { timestampUtc: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Total documents", value: totalDocuments, icon: FileText },
    { label: "Awaiting my signature", value: awaitingMySignature, icon: PenTool },
    { label: "Sent for signature", value: sentForSignature, icon: Send },
    { label: "Completed", value: completed, icon: CheckCircle2 },
    { label: "Declined", value: declined, icon: XCircle },
    { label: "Expired", value: expired, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.fullName.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening at {membership.organization.name}.</p>
        </div>
        <Button render={<Link href="/signatures/new" />} nativeButton={false}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Signature Request
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className="mb-2 h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently signed documents</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSignatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signatures yet. Completed signatures will appear here.</p>
            ) : (
              <ul className="space-y-3">
                {recentSignatures.map((sig) => (
                  <li key={sig.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{sig.field.signatureRequest.document.title}</span>
                    <span className="text-muted-foreground">
                      {sig.printedName} — {sig.meaning.label} · {sig.signedAtUtc.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent account activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((event) => (
                  <li key={event.id} className="text-sm">
                    <div className="font-medium">{event.description}</div>
                    <div className="text-xs text-muted-foreground">{event.timestampUtc.toLocaleString()} UTC</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

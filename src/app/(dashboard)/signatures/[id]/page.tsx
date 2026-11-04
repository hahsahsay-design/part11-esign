import { notFound } from "next/navigation";
import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VoidRequestButton } from "@/components/dashboard/void-request-button";
import { CheckCircle2, Clock, XCircle, Download, Package } from "lucide-react";

const RECIPIENT_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  COMPLETED: CheckCircle2,
  DECLINED: XCircle,
};

export default async function SignatureRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireAuthenticatedContext();

  const request = await prisma.signatureRequest.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      document: true,
      recipients: { orderBy: { signingOrder: "asc" } },
      finalVersion: true,
      fields: true,
    },
  });
  if (!request) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
          <p className="text-sm text-muted-foreground">{request.document.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {request.finalVersion && (
            <>
              <a
                href={`/api/documents/${request.documentId}/download`}
                className="inline-flex h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                Download signed PDF
              </a>
              <a
                href={`/api/signature-requests/${request.id}/package`}
                className="inline-flex h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <Package className="h-4 w-4" />
                Download compliance package
              </a>
            </>
          )}
          {["SENT", "IN_PROGRESS"].includes(request.status) && <VoidRequestButton signatureRequestId={request.id} />}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge>{request.status.replaceAll("_", " ")}</Badge>
        <span className="text-sm text-muted-foreground">
          {request.signingMode === "SEQUENTIAL" ? "Sequential signing" : "Parallel signing"}
        </span>
        {request.expiresAt && (
          <span className="text-sm text-muted-foreground">Expires {request.expiresAt.toLocaleDateString()}</span>
        )}
      </div>

      {request.instructions && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{request.instructions}</CardContent>
        </Card>
      )}

      {request.voidedReason && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Voided</CardTitle>
            <CardDescription>{request.voidedReason}</CardDescription>
          </CardHeader>
        </Card>
      )}
      {request.declinedReason && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">Declined</CardTitle>
            <CardDescription>{request.declinedReason}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.recipients.map((r) => {
            const Icon = RECIPIENT_STATUS_ICON[r.status] ?? Clock;
            const fieldCount = request.fields.filter((f) => f.recipientId === r.id).length;
            return (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 ${
                      r.status === "COMPLETED" ? "text-success" : r.status === "DECLINED" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <div className="font-medium">{r.fullName}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </div>
                  <Badge variant="outline">{r.recipientRole}</Badge>
                  {request.signingMode === "SEQUENTIAL" && r.recipientRole !== "CC" && (
                    <Badge variant="secondary">#{r.signingOrder}</Badge>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{r.status}</div>
                  <div>
                    {fieldCount} field{fieldCount === 1 ? "" : "s"}
                  </div>
                  {r.completedAt && <div>{r.completedAt.toLocaleString()}</div>}
                  {r.viewedAt && !r.completedAt && <div>Viewed {r.viewedAt.toLocaleString()}</div>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

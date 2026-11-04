import Link from "next/link";
import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VerifyAuditButton } from "@/components/dashboard/verify-audit-button";
import { VerifyDocumentIntegrityButton } from "@/components/dashboard/verify-document-integrity-button";
import { ReportViewer } from "@/components/dashboard/report-viewer";
import { ClipboardList, FileText } from "lucide-react";

export default async function CompliancePage() {
  const { membership } = await requireAuthenticatedContext();
  const canExport = await hasPermission(membership, "audit.export");

  const events = await prisma.auditEvent.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { sequenceNumber: "desc" },
    take: 100,
    include: { user: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compliance Center</h1>
          <p className="text-sm text-muted-foreground">
            Audit trail, compliance reports, and document integrity verification (21 CFR 11.10).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/compliance/matrix" />} nativeButton={false}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Compliance matrix
          </Button>
          <Button variant="outline" render={<Link href="/compliance/validation" />} nativeButton={false}>
            <FileText className="mr-2 h-4 w-4" />
            Validation docs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="integrity">Document Integrity</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trail integrity</CardTitle>
              <CardDescription>
                Each event is linked to the previous one with an HMAC hash chain. Verifying recomputes the chain
                and flags any row that was altered after the fact.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerifyAuditButton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent events ({events.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Timestamp (UTC)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground">{e.sequenceNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{e.eventType}</TableCell>
                      <TableCell>{e.user?.fullName ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate text-sm">{e.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.timestampUtc.toISOString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance reports</CardTitle>
              <CardDescription>
                Document audit trail, signature history, user access, failed authentication, document integrity,
                organization activity, training, and system configuration history — exportable as CSV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReportViewer canExport={canExport} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document integrity verification</CardTitle>
              <CardDescription>
                Recomputes the SHA-256 of every stored document version and compares it to the hash recorded at
                upload or finalization — detects corruption or unauthorized modification of the stored file
                itself.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerifyDocumentIntegrityButton />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

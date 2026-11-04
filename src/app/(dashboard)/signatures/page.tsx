import Link from "next/link";
import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PenTool, Plus } from "lucide-react";

export default async function SignaturesPage() {
  const { membership } = await requireAuthenticatedContext();

  const requests = await prisma.signatureRequest.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "desc" },
    include: { document: true, recipients: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Signature Requests</h1>
          <p className="text-sm text-muted-foreground">Track every envelope sent for signature.</p>
        </div>
        <Button render={<Link href="/signatures/new" />} nativeButton={false}>
          <Plus className="mr-2 h-4 w-4" />
          New signature request
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <PenTool className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No signature requests yet</p>
              <p className="text-sm text-muted-foreground">Create one from a document to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/signatures/${r.id}`} className="hover:underline">
                        {r.document.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge>{r.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{r.recipients.length}</TableCell>
                    <TableCell>{r.sentAt?.toLocaleDateString() ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

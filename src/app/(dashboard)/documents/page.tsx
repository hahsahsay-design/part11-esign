import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/api-guard";
import type { Prisma, DocumentStatus } from "@/generated/prisma";
import { UploadDocumentDialog } from "@/components/dashboard/upload-document-dialog";
import { DocumentToolbar } from "@/components/dashboard/document-toolbar";
import { DocumentRowActions } from "@/components/dashboard/document-row-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Scale } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  OUT_FOR_SIGNATURE: "default",
  COMPLETED: "default",
  DECLINED: "destructive",
  VOIDED: "destructive",
  EXPIRED: "outline",
  ARCHIVED: "outline",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; folderId?: string }>;
}) {
  const { membership } = await requireAuthenticatedContext();
  const { q, status, folderId } = await searchParams;
  const canManageRetention = await hasPermission(membership, "retention.manage");

  const where: Prisma.DocumentWhereInput = { organizationId: membership.organizationId };
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (status && status !== "ALL") where.status = status as DocumentStatus;
  if (folderId) where.folderId = folderId === "none" ? null : folderId;

  const [documents, folders] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    }),
    prisma.documentFolder.findMany({
      where: { organizationId: membership.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Upload, organize, and track every document in your organization.</p>
        </div>
        <UploadDocumentDialog folders={folders} />
      </div>

      <DocumentToolbar folders={folders} />

      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No documents match these filters</p>
              <p className="text-sm text-muted-foreground">Upload a PDF, or clear your search and filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latest version</TableHead>
                  <TableHead>SHA-256</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const latest = doc.versions[0];
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        {doc.title}
                        {doc.legalHoldId && (
                          <Badge variant="outline" className="ml-2 gap-1">
                            <Scale className="h-3 w-3" />
                            Legal hold
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[doc.status] ?? "secondary"}>{doc.status.replaceAll("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>v{latest?.versionNumber ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {latest?.sha256Hash.slice(0, 16)}…
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.createdAt.toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DocumentRowActions
                          documentId={doc.id}
                          title={doc.title}
                          status={doc.status}
                          folders={folders}
                          currentFolderId={doc.folderId}
                          hasLegalHold={Boolean(doc.legalHoldId)}
                          canManageRetention={canManageRetention}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

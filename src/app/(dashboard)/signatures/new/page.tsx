import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";

export default async function NewSignatureRequestPage() {
  const { membership } = await requireAuthenticatedContext();

  const [documents, meanings] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId: membership.organizationId, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    }),
    prisma.signatureMeaning.findMany({
      where: { organizationId: membership.organizationId, active: true },
      orderBy: { label: "asc" },
    }),
  ]);

  return (
    <WorkflowBuilder
      documents={documents.map((d) => ({
        id: d.id,
        title: d.title,
        pageCount: d.versions[0]?.pageCount ?? 1,
      }))}
      meanings={meanings.map((m) => ({ code: m.code, label: m.label }))}
    />
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ComplianceReportType } from "@/generated/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { buildReport, toCsv, REPORT_TYPES, REPORT_LABELS, type ReportType } from "@/lib/reports";
import { recordAuditEvent } from "@/lib/audit";
import { requestIp } from "@/lib/session";

function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params;
    if (!isReportType(type)) return NextResponse.json({ error: "Unknown report type" }, { status: 404 });

    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    const documentId = url.searchParams.get("documentId") ?? undefined;

    const { user, membership, session } = await requireApiContext(format === "csv" ? "audit.export" : "audit.view");

    const result = await buildReport(membership.organizationId, type, documentId);

    if (format === "csv") {
      const csv = toCsv(result);
      await prisma.complianceReport.create({
        data: {
          organizationId: membership.organizationId,
          type: reportTypeToEnum(type),
          generatedById: user.id,
          parameters: documentId ? { documentId } : undefined,
          format: "CSV",
        },
      });
      await recordAuditEvent({
        organizationId: membership.organizationId,
        userId: user.id,
        eventType: "COMPLIANCE_REPORT_EXPORTED",
        description: `${user.fullName} exported the "${REPORT_LABELS[type]}" report as CSV (${result.rows.length} rows).`,
        ipAddress: requestIp(request.headers),
        sessionId: session.id,
      });
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiAuthError(error);
  }
}

function reportTypeToEnum(type: ReportType): ComplianceReportType {
  const map: Record<ReportType, ComplianceReportType> = {
    "document-audit-trail": "DOCUMENT_AUDIT_TRAIL",
    "signature-history": "SIGNATURE_HISTORY",
    "user-access": "USER_ACCESS",
    "failed-auth": "FAILED_AUTHENTICATION",
    "document-integrity": "DOCUMENT_INTEGRITY",
    "org-activity": "ORGANIZATION_ACTIVITY",
    training: "USER_TRAINING",
    "system-config": "SYSTEM_CONFIGURATION_HISTORY",
  };
  return map[type];
}

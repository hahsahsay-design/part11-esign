import "server-only";
import { prisma } from "@/lib/prisma";

export const REPORT_TYPES = [
  "document-audit-trail",
  "signature-history",
  "user-access",
  "failed-auth",
  "document-integrity",
  "org-activity",
  "training",
  "system-config",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  "document-audit-trail": "Document Audit Trail",
  "signature-history": "Signature History",
  "user-access": "User Access",
  "failed-auth": "Failed Authentication Attempts",
  "document-integrity": "Document Integrity",
  "org-activity": "Organization Activity",
  training: "User Training",
  "system-config": "System Configuration History",
};

export interface ReportRow {
  [key: string]: string;
}

export interface ReportResult {
  columns: string[];
  rows: ReportRow[];
}

export async function buildReport(organizationId: string, type: ReportType, documentId?: string): Promise<ReportResult> {
  switch (type) {
    case "document-audit-trail": {
      const events = await prisma.auditEvent.findMany({
        where: { organizationId, ...(documentId ? { documentId } : {}) },
        include: { user: true, document: true },
        orderBy: { sequenceNumber: "asc" },
        take: 2000,
      });
      return {
        columns: ["Sequence", "Timestamp (UTC)", "Event", "Document", "User", "Description", "IP Address"],
        rows: events.map((e) => ({
          Sequence: String(e.sequenceNumber),
          "Timestamp (UTC)": e.timestampUtc.toISOString(),
          Event: e.eventType,
          Document: e.document?.title ?? "",
          User: e.user?.fullName ?? "",
          Description: e.description,
          "IP Address": e.ipAddress ?? "",
        })),
      };
    }
    case "signature-history": {
      const signatures = await prisma.electronicSignature.findMany({
        where: { signatureRequest: { organizationId } },
        include: {
          recipient: true,
          meaning: true,
          field: { include: { signatureRequest: { include: { document: true } } } },
          documentVersion: true,
        },
        orderBy: { signedAtUtc: "desc" },
        take: 2000,
      });
      return {
        columns: ["Document", "Signer", "Email", "Meaning", "Signed At (UTC)", "Document Version Hash", "Integrity Signature", "IP Address"],
        rows: signatures.map((s) => ({
          Document: s.field.signatureRequest.document.title,
          Signer: s.printedName,
          Email: s.recipient.email,
          Meaning: s.meaning.label,
          "Signed At (UTC)": s.signedAtUtc.toISOString(),
          "Document Version Hash": s.documentHashAtSigning,
          "Integrity Signature": s.integritySignature,
          "IP Address": s.ipAddress ?? "",
        })),
      };
    }
    case "user-access": {
      const members = await prisma.organizationMembership.findMany({
        where: { organizationId },
        include: { user: true, department: true },
        orderBy: { invitedAt: "asc" },
      });
      const lastLogins = await prisma.authenticationEvent.groupBy({
        by: ["userId"],
        where: { organizationId, type: "LOGIN", success: true, userId: { not: null } },
        _max: { createdAt: true },
      });
      const lastLoginByUser = new Map(lastLogins.map((l) => [l.userId, l._max.createdAt]));
      return {
        columns: ["Name", "Email", "Role", "Department", "Status", "MFA Enrolled", "Last Login (UTC)"],
        rows: await Promise.all(
          members.map(async (m) => {
            const mfa = await prisma.mfaFactor.findFirst({ where: { userId: m.userId, type: "TOTP", verifiedAt: { not: null }, disabledAt: null } });
            const lastLogin = lastLoginByUser.get(m.userId);
            return {
              Name: m.user.fullName,
              Email: m.user.email,
              Role: m.role,
              Department: m.department?.name ?? "",
              Status: m.status,
              "MFA Enrolled": mfa ? "Yes" : "No",
              "Last Login (UTC)": lastLogin ? lastLogin.toISOString() : "Never",
            };
          }),
        ),
      };
    }
    case "failed-auth": {
      const events = await prisma.authenticationEvent.findMany({
        where: { organizationId, success: false },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });
      return {
        columns: ["Timestamp (UTC)", "Type", "User", "IP Address", "User Agent"],
        rows: events.map((e) => ({
          "Timestamp (UTC)": e.createdAt.toISOString(),
          Type: e.type,
          User: e.user?.fullName ?? e.user?.email ?? "(unknown / external)",
          "IP Address": e.ipAddress ?? "",
          "User Agent": e.userAgent ?? "",
        })),
      };
    }
    case "document-integrity": {
      const documents = await prisma.document.findMany({
        where: { organizationId },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
      const rows: ReportRow[] = [];
      for (const doc of documents) {
        for (const v of doc.versions) {
          rows.push({
            Document: doc.title,
            Version: String(v.versionNumber),
            Kind: v.kind,
            "File Name": v.originalFileName,
            "SHA-256": v.sha256Hash,
            "Size (bytes)": String(v.fileSizeBytes),
            "Created At (UTC)": v.createdAt.toISOString(),
          });
        }
      }
      return {
        columns: ["Document", "Version", "Kind", "File Name", "SHA-256", "Size (bytes)", "Created At (UTC)"],
        rows,
      };
    }
    case "org-activity": {
      const events = await prisma.auditEvent.findMany({
        where: { organizationId },
        include: { user: true },
        orderBy: { sequenceNumber: "desc" },
        take: 2000,
      });
      return {
        columns: ["Sequence", "Timestamp (UTC)", "Event", "User", "Description"],
        rows: events.map((e) => ({
          Sequence: String(e.sequenceNumber),
          "Timestamp (UTC)": e.timestampUtc.toISOString(),
          Event: e.eventType,
          User: e.user?.fullName ?? "",
          Description: e.description,
        })),
      };
    }
    case "training": {
      const records = await prisma.trainingRecord.findMany({
        where: { organizationId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        columns: ["Member", "Email", "Course", "Completed", "Expires", "Score"],
        rows: records.map((r) => ({
          Member: r.user.fullName,
          Email: r.user.email,
          Course: r.courseName,
          Completed: r.completedAt?.toISOString() ?? "",
          Expires: r.expiresAt?.toISOString() ?? "",
          Score: r.score != null ? String(r.score) : "",
        })),
      };
    }
    case "system-config": {
      const events = await prisma.auditEvent.findMany({
        where: {
          organizationId,
          eventType: { in: ["ORG_SETTINGS_CHANGED", "MEMBERSHIP_PERMISSION_CHANGED", "MEMBERSHIP_ROLE_CHANGED"] },
        },
        include: { user: true },
        orderBy: { sequenceNumber: "desc" },
        take: 2000,
      });
      return {
        columns: ["Sequence", "Timestamp (UTC)", "Event", "Changed By", "Description"],
        rows: events.map((e) => ({
          Sequence: String(e.sequenceNumber),
          "Timestamp (UTC)": e.timestampUtc.toISOString(),
          Event: e.eventType,
          "Changed By": e.user?.fullName ?? "",
          Description: e.description,
        })),
      };
    }
  }
}

export function toCsv(result: ReportResult): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const lines = [result.columns.map(escape).join(",")];
  for (const row of result.rows) {
    lines.push(result.columns.map((c) => escape(row[c] ?? "")).join(","));
  }
  return lines.join("\n");
}

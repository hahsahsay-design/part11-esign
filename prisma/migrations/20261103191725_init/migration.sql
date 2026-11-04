-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORG_OWNER', 'ORG_ADMIN', 'QA_MANAGER', 'QC_MANAGER', 'DOCUMENT_ADMIN', 'STANDARD_USER', 'EXTERNAL_SIGNER', 'READ_ONLY_AUDITOR');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "MfaType" AS ENUM ('TOTP', 'BACKUP_CODES');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('LOGIN', 'LOGOUT', 'MFA_CHALLENGE', 'MFA_ENROLL', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKOUT', 'REAUTH_FOR_SIGNING', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'OUT_FOR_SIGNATURE', 'COMPLETED', 'DECLINED', 'VOIDED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentVersionKind" AS ENUM ('ORIGINAL', 'SIGNED_RECORD');

-- CreateEnum
CREATE TYPE "SigningMode" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'VOIDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RecipientRole" AS ENUM ('SIGNER', 'APPROVER', 'CC', 'WITNESS');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'COMPLETED', 'DECLINED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('SIGNATURE', 'INITIALS', 'DATE', 'TEXT', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('USER_REGISTERED', 'USER_EMAIL_VERIFIED', 'USER_LOGIN_SUCCESS', 'USER_LOGIN_FAILED', 'USER_LOGOUT', 'USER_MFA_ENROLLED', 'USER_MFA_VERIFIED', 'USER_PASSWORD_CHANGED', 'USER_PASSWORD_RESET', 'USER_ACCOUNT_LOCKED', 'USER_DEACTIVATED', 'USER_REACTIVATED', 'MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP_INVITED', 'MEMBERSHIP_PERMISSION_CHANGED', 'ORG_SETTINGS_CHANGED', 'DOCUMENT_UPLOADED', 'DOCUMENT_RENAMED', 'DOCUMENT_VERSION_CREATED', 'DOCUMENT_VIEWED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_ARCHIVED', 'DOCUMENT_MOVED', 'LEGAL_HOLD_PLACED', 'LEGAL_HOLD_RELEASED', 'SIGNATURE_REQUEST_CREATED', 'SIGNATURE_REQUEST_SENT', 'RECIPIENT_INVITED', 'RECIPIENT_VIEWED_DOCUMENT', 'SIGNATURE_FIELD_COMPLETED', 'SIGNATURE_APPLIED', 'SIGNATURE_REQUEST_COMPLETED', 'SIGNATURE_REQUEST_DECLINED', 'SIGNATURE_REQUEST_VOIDED', 'SIGNATURE_REQUEST_EXPIRED', 'COMPLIANCE_REPORT_GENERATED', 'COMPLIANCE_REPORT_EXPORTED', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('ARCHIVE', 'FLAG_FOR_REVIEW');

-- CreateEnum
CREATE TYPE "ComplianceReportType" AS ENUM ('DOCUMENT_AUDIT_TRAIL', 'SIGNATURE_HISTORY', 'USER_ACCESS', 'FAILED_AUTHENTICATION', 'DOCUMENT_INTEGRITY', 'ORGANIZATION_ACTIVITY', 'USER_TRAINING', 'SYSTEM_CONFIGURATION_HISTORY');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('SIGNATURE_REQUEST_RECEIVED', 'SIGNATURE_REMINDER', 'DOCUMENT_COMPLETED', 'DOCUMENT_DECLINED', 'DOCUMENT_EXPIRED', 'ACCOUNT_CREATED', 'PASSWORD_RESET', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BillingRecordStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBranding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#1E2A5A',
    "supportEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSecurityPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 12,
    "passwordRequireUpper" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireLower" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireSymbol" BOOLEAN NOT NULL DEFAULT true,
    "passwordHistoryCount" INTEGER NOT NULL DEFAULT 6,
    "passwordExpiryDays" INTEGER DEFAULT 90,
    "maxFailedLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "sessionIdleTimeoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "sessionAbsoluteTimeoutHours" INTEGER NOT NULL DEFAULT 12,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT true,
    "reauthForSigningRequired" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "OrganizationSecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPermission" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MfaType" NOT NULL,
    "secretCiphertext" TEXT,
    "backupCodesHash" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "MfaFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthenticationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "type" "AuthEventType" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthenticationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "legalHoldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "kind" "DocumentVersionKind" NOT NULL DEFAULT 'ORIGINAL',
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSizeBytes" INTEGER NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "pageCount" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureMeaning" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureMeaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "finalVersionId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "signingMode" "SigningMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declinedReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequestRecipient" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "recipientRole" "RecipientRole" NOT NULL DEFAULT 'SIGNER',
    "signingOrder" INTEGER NOT NULL DEFAULT 1,
    "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
    "accessTokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureRequestRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureField" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "page" INTEGER NOT NULL,
    "xPct" DOUBLE PRECISION NOT NULL,
    "yPct" DOUBLE PRECISION NOT NULL,
    "widthPct" DOUBLE PRECISION NOT NULL,
    "heightPct" DOUBLE PRECISION NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "defaultMeaningId" TEXT,

    CONSTRAINT "SignatureField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldResponse" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectronicSignature" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "signerUserId" TEXT,
    "printedName" TEXT NOT NULL,
    "meaningId" TEXT NOT NULL,
    "authenticationEventId" TEXT NOT NULL,
    "signedAtUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "documentHashAtSigning" TEXT NOT NULL,
    "integritySignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectronicSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "documentId" TEXT,
    "signatureRequestId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "sessionId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "timestampUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chainKey" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentCategory" TEXT,
    "retentionPeriodDays" INTEGER NOT NULL,
    "actionOnExpiry" "RetentionAction" NOT NULL DEFAULT 'ARCHIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalHold" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "placedById" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "releasedById" TEXT,

    CONSTRAINT "LegalHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ComplianceReportType" NOT NULL,
    "generatedById" TEXT NOT NULL,
    "parameters" JSONB,
    "storageKey" TEXT,
    "format" "ReportFormat" NOT NULL DEFAULT 'PDF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "toEmail" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "relatedId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthlyCents" INTEGER NOT NULL,
    "priceAnnualCents" INTEGER NOT NULL,
    "usageLimits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "BillingRecordStatus" NOT NULL DEFAULT 'PENDING',
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBranding_organizationId_key" ON "OrganizationBranding"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSecurityPolicy_organizationId_key" ON "OrganizationSecurityPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "MembershipPermission_organizationId_idx" ON "MembershipPermission"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPermission_membershipId_permissionId_key" ON "MembershipPermission"("membershipId", "permissionId");

-- CreateIndex
CREATE INDEX "MfaFactor_userId_idx" ON "MfaFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_tokenHash_idx" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "AuthenticationEvent_organizationId_idx" ON "AuthenticationEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AuthenticationEvent_userId_type_idx" ON "AuthenticationEvent"("userId", "type");

-- CreateIndex
CREATE INDEX "AuthenticationEvent_createdAt_idx" ON "AuthenticationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentFolder_organizationId_idx" ON "DocumentFolder"("organizationId");

-- CreateIndex
CREATE INDEX "Document_organizationId_status_idx" ON "Document"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "SignatureMeaning_organizationId_idx" ON "SignatureMeaning"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureMeaning_organizationId_code_key" ON "SignatureMeaning"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SignatureRequest_organizationId_status_idx" ON "SignatureRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SignatureRequest_documentId_idx" ON "SignatureRequest"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequestRecipient_accessTokenHash_key" ON "SignatureRequestRecipient"("accessTokenHash");

-- CreateIndex
CREATE INDEX "SignatureRequestRecipient_signatureRequestId_idx" ON "SignatureRequestRecipient"("signatureRequestId");

-- CreateIndex
CREATE INDEX "SignatureRequestRecipient_email_idx" ON "SignatureRequestRecipient"("email");

-- CreateIndex
CREATE INDEX "SignatureField_signatureRequestId_idx" ON "SignatureField"("signatureRequestId");

-- CreateIndex
CREATE INDEX "SignatureField_recipientId_idx" ON "SignatureField"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldResponse_fieldId_key" ON "FieldResponse"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectronicSignature_fieldId_key" ON "ElectronicSignature"("fieldId");

-- CreateIndex
CREATE INDEX "ElectronicSignature_signatureRequestId_idx" ON "ElectronicSignature"("signatureRequestId");

-- CreateIndex
CREATE INDEX "ElectronicSignature_documentVersionId_idx" ON "ElectronicSignature"("documentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_hash_key" ON "AuditEvent"("hash");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_timestampUtc_idx" ON "AuditEvent"("organizationId", "timestampUtc");

-- CreateIndex
CREATE INDEX "AuditEvent_documentId_idx" ON "AuditEvent"("documentId");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_chainKey_sequenceNumber_key" ON "AuditEvent"("chainKey", "sequenceNumber");

-- CreateIndex
CREATE INDEX "RetentionPolicy_organizationId_idx" ON "RetentionPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "LegalHold_organizationId_idx" ON "LegalHold"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingRecord_organizationId_userId_idx" ON "TrainingRecord"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "ComplianceReport_organizationId_type_idx" ON "ComplianceReport"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_organizationId_eventType_key" ON "NotificationPreference"("organizationId", "eventType");

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_idx" ON "EmailLog"("organizationId");

-- CreateIndex
CREATE INDEX "EmailLog_toEmail_idx" ON "EmailLog"("toEmail");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_stripeInvoiceId_key" ON "BillingRecord"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "BillingRecord_organizationId_idx" ON "BillingRecord"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationBranding" ADD CONSTRAINT "OrganizationBranding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSecurityPolicy" ADD CONSTRAINT "OrganizationSecurityPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermission" ADD CONSTRAINT "MembershipPermission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermission" ADD CONSTRAINT "MembershipPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermission" ADD CONSTRAINT "MembershipPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaFactor" ADD CONSTRAINT "MfaFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticationEvent" ADD CONSTRAINT "AuthenticationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticationEvent" ADD CONSTRAINT "AuthenticationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_legalHoldId_fkey" FOREIGN KEY ("legalHoldId") REFERENCES "LegalHold"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureMeaning" ADD CONSTRAINT "SignatureMeaning_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_finalVersionId_fkey" FOREIGN KEY ("finalVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequestRecipient" ADD CONSTRAINT "SignatureRequestRecipient_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignatureRequestRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_defaultMeaningId_fkey" FOREIGN KEY ("defaultMeaningId") REFERENCES "SignatureMeaning"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldResponse" ADD CONSTRAINT "FieldResponse_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SignatureField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldResponse" ADD CONSTRAINT "FieldResponse_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignatureRequestRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SignatureField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignatureRequestRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "SignatureMeaning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectronicSignature" ADD CONSTRAINT "ElectronicSignature_authenticationEventId_fkey" FOREIGN KEY ("authenticationEventId") REFERENCES "AuthenticationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalHold" ADD CONSTRAINT "LegalHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceReport" ADD CONSTRAINT "ComplianceReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

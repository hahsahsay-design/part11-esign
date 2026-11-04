-- CreateTable
CREATE TABLE "OrgInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "departmentId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvite_tokenHash_key" ON "OrgInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "OrgInvite_organizationId_idx" ON "OrgInvite"("organizationId");

-- CreateIndex
CREATE INDEX "OrgInvite_email_idx" ON "OrgInvite"("email");

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

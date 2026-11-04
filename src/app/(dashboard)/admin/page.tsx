import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, roleHasPermissionByDefault, type PermissionKey } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";
import { ROLE_LABELS } from "@/lib/roles";
import { RevokeInviteButton } from "@/components/admin/revoke-invite-button";
import { MemberActionsMenu } from "@/components/admin/member-actions-menu";
import { DepartmentsPanel } from "@/components/admin/departments-panel";
import { SecurityPolicyForm } from "@/components/admin/security-policy-form";
import { TrainingPanel } from "@/components/admin/training-panel";
import { RetentionPanel } from "@/components/admin/retention-panel";
import { BrandingForm } from "@/components/admin/branding-form";

async function effectivePermission(membershipId: string, role: string, key: PermissionKey, overridesByMembership: Map<string, Record<string, boolean>>) {
  const overrides = overridesByMembership.get(membershipId);
  if (overrides && key in overrides) return overrides[key];
  return roleHasPermissionByDefault(role as Parameters<typeof roleHasPermissionByDefault>[0], key);
}

export default async function AdminPage() {
  const { membership } = await requireAuthenticatedContext();
  const organizationId = membership.organizationId;

  const [members, departments, securityPolicy, invites, allOverrides, trainingRecords, retentionPolicies, branding] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { organizationId },
      include: { user: true, department: true },
      orderBy: { invitedAt: "asc" },
    }),
    prisma.department.findMany({ where: { organizationId }, include: { _count: { select: { memberships: true } } } }),
    prisma.organizationSecurityPolicy.findUniqueOrThrow({ where: { organizationId } }),
    prisma.orgInvite.findMany({ where: { organizationId, acceptedAt: null, revokedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.membershipPermission.findMany({ where: { organizationId } }),
    prisma.trainingRecord.findMany({ where: { organizationId }, include: { user: true }, orderBy: { createdAt: "desc" } }),
    prisma.retentionPolicy.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.organizationBranding.findUniqueOrThrow({ where: { organizationId } }),
  ]);

  const overridesByMembership = new Map<string, Record<string, boolean>>();
  for (const o of allOverrides) {
    const entry = overridesByMembership.get(o.membershipId) ?? {};
    entry[o.permissionId] = o.granted;
    overridesByMembership.set(o.membershipId, entry);
  }
  // permissionId -> key lookup for the overrides map above
  const permissionRows = await prisma.permission.findMany();
  const permissionIdToKey = new Map(permissionRows.map((p) => [p.id, p.key]));
  const overridesByMembershipKeyed = new Map<string, Record<string, boolean>>();
  for (const [membershipId, byId] of overridesByMembership) {
    const byKey: Record<string, boolean> = {};
    for (const [permId, granted] of Object.entries(byId)) {
      const key = permissionIdToKey.get(permId);
      if (key) byKey[key] = granted;
    }
    overridesByMembershipKeyed.set(membershipId, byKey);
  }

  const canManageRoles = await effectivePermission(membership.id, membership.role, "users.manage_roles", overridesByMembershipKeyed);
  const canDeactivate = await effectivePermission(membership.id, membership.role, "users.deactivate", overridesByMembershipKeyed);
  const canInvite = await effectivePermission(membership.id, membership.role, "users.invite", overridesByMembershipKeyed);
  const canManageDepartments = await effectivePermission(membership.id, membership.role, "departments.manage", overridesByMembershipKeyed);
  const canManageSettings = await effectivePermission(membership.id, membership.role, "org.manage_settings", overridesByMembershipKeyed);
  const canManageBranding = await effectivePermission(membership.id, membership.role, "org.manage_branding", overridesByMembershipKeyed);
  const canManageTraining = await effectivePermission(membership.id, membership.role, "training.manage", overridesByMembershipKeyed);
  const canManageRetention = await effectivePermission(membership.id, membership.role, "retention.manage", overridesByMembershipKeyed);

  const permissionCatalog = Object.entries(PERMISSIONS).map(([key, description]) => ({
    key: key as PermissionKey,
    description,
    category: key.split(".")[0],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">Manage members, security, retention, and training for {membership.organization.name}.</p>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="security">Security Policy</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Members ({members.length})</CardTitle>
                {canInvite && <InviteMemberDialog departments={departments} />}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {m.user.fullName}
                          <div className="text-xs text-muted-foreground">{m.user.email}</div>
                        </TableCell>
                        <TableCell>{ROLE_LABELS[m.role] ?? m.role}</TableCell>
                        <TableCell>{m.department?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>{m.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <MemberActionsMenu
                            membershipId={m.id}
                            memberName={m.user.fullName}
                            role={m.role}
                            status={m.status}
                            departmentId={m.departmentId}
                            departments={departments}
                            permissions={permissionCatalog}
                            overrides={overridesByMembershipKeyed.get(m.id) ?? {}}
                            canManageRoles={canManageRoles}
                            canDeactivate={canDeactivate}
                            isSelf={m.id === membership.id}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Departments</CardTitle>
                </CardHeader>
                <CardContent>
                  <DepartmentsPanel
                    departments={departments.map((d) => ({ id: d.id, name: d.name, memberCount: d._count.memberships }))}
                    canManage={canManageDepartments}
                  />
                </CardContent>
              </Card>

              {invites.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pending invites</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {invites.map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{i.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {i.email} · {ROLE_LABELS[i.role] ?? i.role}
                          </div>
                        </div>
                        {canInvite && <RevokeInviteButton inviteId={i.id} />}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security policy</CardTitle>
              <CardDescription>21 CFR 11.300 identification-code and password controls for this organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <SecurityPolicyForm policy={securityPolicy} canEdit={canManageSettings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Retention policies</CardTitle>
              <CardDescription>
                Place or release legal holds from a document&apos;s row menu under Documents. Automated
                enforcement of these periods (auto-archive on expiry) is tracked as follow-up work.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RetentionPanel policies={retentionPolicies} canManage={canManageRetention} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Training records</CardTitle>
              <CardDescription>Personnel qualification evidence (21 CFR 11.10(i)).</CardDescription>
            </CardHeader>
            <CardContent>
              <TrainingPanel
                records={trainingRecords.map((r) => ({
                  id: r.id,
                  courseName: r.courseName,
                  completedAt: r.completedAt?.toISOString() ?? null,
                  expiresAt: r.expiresAt?.toISOString() ?? null,
                  score: r.score,
                  userName: r.user.fullName,
                }))}
                members={members.map((m) => ({ userId: m.userId, name: m.user.fullName }))}
                canManage={canManageTraining}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization branding</CardTitle>
            </CardHeader>
            <CardContent>
              <BrandingForm primaryColor={branding.primaryColor ?? "#1E2A5A"} supportEmail={branding.supportEmail} canEdit={canManageBranding} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

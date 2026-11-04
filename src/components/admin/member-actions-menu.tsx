"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MoreHorizontal, UserCog, ShieldQuestion, UserX, UserCheck } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import type { PermissionKey } from "@/lib/permissions";

interface PermissionCatalogEntry {
  key: PermissionKey;
  description: string;
  category: string;
}

export function MemberActionsMenu({
  membershipId,
  memberName,
  role,
  status,
  departmentId,
  departments,
  permissions,
  overrides,
  canManageRoles,
  canDeactivate,
  isSelf,
}: {
  membershipId: string;
  memberName: string;
  role: string;
  status: string;
  departmentId: string | null;
  departments: { id: string; name: string }[];
  permissions: PermissionCatalogEntry[];
  overrides: Record<string, boolean>;
  canManageRoles: boolean;
  canDeactivate: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState(role);
  const [newDepartment, setNewDepartment] = useState(departmentId ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patchMember(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That didn't work.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function setPermission(key: string, granted: boolean | null) {
    await fetch(`/api/admin/members/${membershipId}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKey: key, granted }),
    });
    router.refresh();
  }

  if (!canManageRoles && !canDeactivate) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canManageRoles && (
            <DropdownMenuItem onClick={() => setRoleDialogOpen(true)}>
              <UserCog className="mr-2 h-4 w-4" />
              Change role / department
            </DropdownMenuItem>
          )}
          {canManageRoles && (
            <DropdownMenuItem onClick={() => setPermDialogOpen(true)}>
              <ShieldQuestion className="mr-2 h-4 w-4" />
              Manage permissions
            </DropdownMenuItem>
          )}
          {canDeactivate && (
            <>
              <DropdownMenuSeparator />
              {status === "ACTIVE" ? (
                <DropdownMenuItem onClick={() => patchMember({ status: "DEACTIVATED" })} disabled={busy}>
                  <UserX className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => patchMember({ status: "ACTIVE" })} disabled={busy}>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {memberName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {isSelf && role === "ORG_OWNER" && (
              <Alert>
                <AlertDescription>You&apos;re changing your own owner role — make sure another owner exists first.</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => v && setNewRole(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => ROLE_LABELS[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={newDepartment} onValueChange={(v) => setNewDepartment(v ?? "none")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => (v === "none" ? "No department" : departments.find((d) => d.id === v)?.name ?? "No department")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={busy}
              onClick={async () => {
                const ok = await patchMember({ role: newRole, departmentId: newDepartment === "none" ? null : newDepartment });
                if (ok) setRoleDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permission overrides — {memberName}</DialogTitle>
            <DialogDescription>
              Overrides a {ROLE_LABELS[role]}&apos;s default access for this one person. Leave as &quot;Default&quot;
              to follow their role.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-3 overflow-y-auto py-2">
            {permissions.map((p) => {
              const current = p.key in overrides ? (overrides[p.key] ? "granted" : "revoked") : "default";
              return (
                <div key={p.key} className="flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-medium">{p.key}</div>
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  </div>
                  <Select
                    value={current}
                    onValueChange={(v) => setPermission(p.key, v === "default" ? null : v === "granted")}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue>{(v: string) => (v === "default" ? "Default" : v === "granted" ? "Granted" : "Revoked")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="granted">Granted</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

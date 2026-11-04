"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Policy {
  passwordMinLength: number;
  passwordRequireUpper: boolean;
  passwordRequireLower: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordHistoryCount: number;
  passwordExpiryDays: number | null;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionIdleTimeoutMinutes: number;
  sessionAbsoluteTimeoutHours: number;
  mfaRequired: boolean;
  reauthForSigningRequired: boolean;
}

export function SecurityPolicyForm({ policy, canEdit }: { policy: Policy; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Policy>(policy);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function field<K extends keyof Policy>(key: K, value: Policy[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save the security policy.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Password min length</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.passwordMinLength}
            onChange={(e) => field("passwordMinLength", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Password expiry (days, blank = never)</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.passwordExpiryDays ?? ""}
            onChange={(e) => field("passwordExpiryDays", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Password history (reuse block)</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.passwordHistoryCount}
            onChange={(e) => field("passwordHistoryCount", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max failed logins</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.maxFailedLoginAttempts}
            onChange={(e) => field("maxFailedLoginAttempts", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lockout duration (min)</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.lockoutDurationMinutes}
            onChange={(e) => field("lockoutDurationMinutes", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Session idle timeout (min)</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.sessionIdleTimeoutMinutes}
            onChange={(e) => field("sessionIdleTimeoutMinutes", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Session absolute timeout (hr)</Label>
          <Input
            type="number"
            disabled={!canEdit}
            value={form.sessionAbsoluteTimeoutHours}
            onChange={(e) => field("sessionAbsoluteTimeoutHours", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm">
        {(
          [
            ["passwordRequireUpper", "Require uppercase"],
            ["passwordRequireLower", "Require lowercase"],
            ["passwordRequireNumber", "Require a number"],
            ["passwordRequireSymbol", "Require a symbol"],
            ["mfaRequired", "MFA required for all members"],
            ["reauthForSigningRequired", "Reauthentication required to sign"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <Checkbox disabled={!canEdit} checked={form[key]} onCheckedChange={(c) => field(key, c === true)} />
            {label}
          </label>
        ))}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : "Save policy"}
          </Button>
          {saved && <span className="text-sm text-success">Saved.</span>}
        </div>
      )}
    </div>
  );
}

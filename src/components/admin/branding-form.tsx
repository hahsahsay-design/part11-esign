"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BrandingForm({
  primaryColor,
  supportEmail,
  canEdit,
}: {
  primaryColor: string;
  supportEmail: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [color, setColor] = useState(primaryColor);
  const [email, setEmail] = useState(supportEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: color, supportEmail: email || null }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label htmlFor="primaryColor">Primary color</Label>
        <div className="flex items-center gap-2">
          <input
            id="primaryColor"
            type="color"
            disabled={!canEdit}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 rounded border"
          />
          <Input className="w-28" disabled={!canEdit} value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="supportEmail">Support email</Label>
        <Input id="supportEmail" type="email" disabled={!canEdit} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {canEdit && (
        <Button onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save branding"}
        </Button>
      )}
      {saved && <span className="text-sm text-success">Saved.</span>}
    </div>
  );
}

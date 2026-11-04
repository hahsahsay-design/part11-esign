"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SigningField } from "@/components/signing/signing-session";

export function SignConfirmDialog({
  open,
  onOpenChange,
  token,
  recipientName,
  fields,
  responses,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  recipientName: string;
  fields: SigningField[];
  responses: Record<string, string>;
  onSigned: (finalized: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signatureFields = fields.filter((f) => f.type === "SIGNATURE" || f.type === "INITIALS");

  async function onConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, consent: true, responses, meanings: {} }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not complete signing.");
        return;
      }
      onOpenChange(false);
      onSigned(Boolean(data.finalized));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm and sign</DialogTitle>
          <DialogDescription>
            By signing below, you agree that your electronic signature is the legal equivalent of your manual
            signature, and that you are signing as <strong>{recipientName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1 rounded-md border p-3 text-sm">
            {signatureFields.map((f) => (
              <div key={f.id} className="flex justify-between">
                <span>{f.type === "SIGNATURE" ? "Signature" : "Initials"}</span>
                <span className="text-muted-foreground">{f.defaultMeaning?.label}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Re-enter your signing password</Label>
            <Input id="confirmPassword" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="consent" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
            <Label htmlFor="consent" className="text-sm font-normal">
              I intend this to be my legally binding electronic signature.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!consent || !password || loading} onClick={onConfirm}>
            {loading ? "Signing…" : "Sign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

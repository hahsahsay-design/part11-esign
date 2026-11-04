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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DeclineDialog({
  open,
  onOpenChange,
  token,
  onDeclined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onDeclined: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not decline this document.");
        return;
      }
      onOpenChange(false);
      onDeclined();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline to sign</DialogTitle>
          <DialogDescription>This stops the entire signing request. The sender will be notified with your reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Label htmlFor="declineReason">Reason</Label>
          <Textarea id="declineReason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={!reason.trim() || loading} onClick={onConfirm}>
            {loading ? "Declining…" : "Decline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

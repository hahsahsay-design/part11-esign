"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Ban } from "lucide-react";

export function VoidRequestButton({ signatureRequestId }: { signatureRequestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function onVoid() {
    setBusy(true);
    try {
      const res = await fetch(`/api/signature-requests/${signatureRequestId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Ban className="mr-2 h-4 w-4" />
        Void request
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this signature request</DialogTitle>
          <DialogDescription>
            Recipients will no longer be able to sign. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={busy || !reason.trim()} onClick={onVoid}>
            Void request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

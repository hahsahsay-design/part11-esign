"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/admin/invites/${inviteId}`, { method: "DELETE" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

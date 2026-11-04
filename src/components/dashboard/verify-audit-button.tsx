"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export function VerifyAuditButton() {
  const [result, setResult] = useState<{ valid: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/verify-audit", { method: "POST" });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={onVerify} disabled={loading}>
        {loading ? "Verifying…" : "Verify audit trail integrity"}
      </Button>
      {result && (
        <span className={`flex items-center gap-1 text-sm ${result.valid ? "text-success" : "text-destructive"}`}>
          {result.valid ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {result.valid ? "Hash chain intact" : "Tampering detected"}
        </span>
      )}
    </div>
  );
}

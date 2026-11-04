"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard } from "lucide-react";

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open the billing portal.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button variant="outline" onClick={onClick} disabled={loading}>
        <CreditCard className="mr-2 h-4 w-4" />
        {loading ? "Opening…" : "Manage billing"}
      </Button>
    </div>
  );
}

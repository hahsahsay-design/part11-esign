"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check } from "lucide-react";

interface Plan {
  code: string;
  name: string;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  usageLimits: { maxUsers: number | null; maxDocumentsPerMonth: number | null; maxStorageGb: number | null };
  connectedToStripe: boolean;
}

function formatPrice(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString()}`;
}

export function PlanSelector({
  plans,
  currentPlanCode,
  canManageBilling,
}: {
  plans: Plan[];
  currentPlanCode: string | null;
  canManageBilling: boolean;
}) {
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [error, setError] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);

  async function subscribe(planCode: string) {
    setLoadingCode(planCode);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle: cycle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoadingCode(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Button variant={cycle === "MONTHLY" ? "default" : "outline"} size="sm" onClick={() => setCycle("MONTHLY")}>
          Monthly
        </Button>
        <Button variant={cycle === "ANNUAL" ? "default" : "outline"} size="sm" onClick={() => setCycle("ANNUAL")}>
          Annual <span className="ml-1 text-xs opacity-75">(2 months free)</span>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const price = cycle === "ANNUAL" ? plan.priceAnnualCents : plan.priceMonthlyCents;
          return (
            <Card key={plan.code} className={isCurrent ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  {plan.name}
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground">{formatPrice(price)}</span>
                  {price > 0 && <span className="text-sm"> / {cycle === "ANNUAL" ? "year" : "month"}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {plan.usageLimits.maxUsers ?? "Unlimited"} members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {plan.usageLimits.maxDocumentsPerMonth ?? "Unlimited"} documents / month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />
                    {plan.usageLimits.maxStorageGb ?? "Unlimited"} GB storage
                  </li>
                </ul>
                {canManageBilling && !isCurrent && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={loadingCode === plan.code}
                    onClick={() => subscribe(plan.code)}
                  >
                    {loadingCode === plan.code ? "Starting…" : plan.connectedToStripe ? "Switch to this plan" : "Not connected to Stripe"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

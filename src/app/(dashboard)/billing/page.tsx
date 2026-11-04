import { requireAuthenticatedContext } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlanSelector } from "@/components/dashboard/plan-selector";
import { ManageBillingButton } from "@/components/dashboard/manage-billing-button";

export default async function BillingPage() {
  const { membership } = await requireAuthenticatedContext();
  const canManageBilling = await hasPermission(membership, "org.manage_billing");

  const [subscription, plans, billingRecords, documentCount, memberCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: membership.organizationId }, include: { plan: true } }),
    prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceMonthlyCents: "asc" } }),
    prisma.billingRecord.findMany({ where: { organizationId: membership.organizationId }, orderBy: { issuedAt: "desc" } }),
    prisma.document.count({ where: { organizationId: membership.organizationId } }),
    prisma.organizationMembership.count({ where: { organizationId: membership.organizationId, status: "ACTIVE" } }),
  ]);

  const limits = (subscription?.plan.usageLimits ?? {}) as Record<string, number | null>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">Plan, usage, and billing history for {membership.organization.name}.</p>
      </div>

      {!isStripeConfigured() && (
        <Alert>
          <AlertDescription>
            No payment provider is connected (<code>STRIPE_SECRET_KEY</code> is unset), so plan switching and
            invoices aren&apos;t live in this environment — usage limits below are still enforced from the
            current plan.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {subscription?.plan.name ?? "No plan"}{" "}
            <Badge className="ml-2" variant={subscription?.status === "ACTIVE" ? "default" : "secondary"}>
              {subscription?.status}
            </Badge>
          </CardTitle>
          <CardDescription>
            {subscription?.billingCycle === "ANNUAL" ? "Billed annually" : "Billed monthly"}
            {subscription?.trialEndsAt && ` · Trial ends ${subscription.trialEndsAt.toLocaleDateString()}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Members</div>
              <div className="font-medium">
                {memberCount} / {limits.maxUsers ?? "Unlimited"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Documents</div>
              <div className="font-medium">
                {documentCount} / {limits.maxDocumentsPerMonth ?? "Unlimited"} per month
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Storage</div>
              <div className="font-medium">{limits.maxStorageGb ?? "Unlimited"} GB</div>
            </div>
          </div>
          {canManageBilling && subscription?.stripeCustomerId && <ManageBillingButton />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanSelector
            plans={plans.map((p) => ({
              code: p.code,
              name: p.name,
              priceMonthlyCents: p.priceMonthlyCents,
              priceAnnualCents: p.priceAnnualCents,
              usageLimits: p.usageLimits as { maxUsers: number | null; maxDocumentsPerMonth: number | null; maxStorageGb: number | null },
              connectedToStripe: Boolean(p.stripePriceIdMonthly || p.stripePriceIdAnnual),
            }))}
            currentPlanCode={subscription?.plan.code ?? null}
            canManageBilling={canManageBilling}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {billingRecords.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingRecords.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.issuedAt.toLocaleDateString()}</TableCell>
                    <TableCell>
                      ${(r.amountCents / 100).toFixed(2)} {r.currency.toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "PAID" ? "default" : r.status === "FAILED" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.pdfUrl && (
                        <a href={r.pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
                          PDF
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

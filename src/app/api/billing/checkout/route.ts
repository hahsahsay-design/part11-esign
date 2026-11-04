import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { recordAuditEvent } from "@/lib/audit";

const schema = z.object({
  planCode: z.string(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
});

export async function POST(request: Request) {
  try {
    const { user, membership } = await requireApiContext("org.manage_billing");

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing isn't connected yet. An administrator needs to set STRIPE_SECRET_KEY to enable checkout." },
        { status: 501 },
      );
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: parsed.data.planCode } });
    if (!plan || !plan.active) return NextResponse.json({ error: "Unknown plan." }, { status: 404 });

    const priceId = parsed.data.billingCycle === "ANNUAL" ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
    if (!priceId) {
      return NextResponse.json(
        { error: `The "${plan.name}" plan isn't connected to a Stripe Price yet. Set SubscriptionPlan.stripePriceId${parsed.data.billingCycle === "ANNUAL" ? "Annual" : "Monthly"} to enable it.` },
        { status: 501 },
      );
    }

    const stripe = getStripeClient()!;
    const existingSubscription = await prisma.subscription.findUnique({ where: { organizationId: membership.organizationId } });

    let customerId = existingSubscription?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: membership.organization.name,
        metadata: { organizationId: membership.organizationId },
      });
      customerId = customer.id;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/billing?checkout=success`,
      cancel_url: `${process.env.APP_URL}/billing?checkout=cancelled`,
      client_reference_id: membership.organizationId,
      subscription_data: { metadata: { organizationId: membership.organizationId, planCode: plan.code } },
    });

    await recordAuditEvent({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: "ORG_SETTINGS_CHANGED",
      description: `${user.fullName} started checkout for the "${plan.name}" plan (${parsed.data.billingCycle.toLowerCase()}).`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

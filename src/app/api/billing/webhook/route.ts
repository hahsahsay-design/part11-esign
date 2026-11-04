import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { recordAuditEvent } from "@/lib/audit";

// Stripe webhook endpoint — no session/cookie auth. Trust is established
// entirely by verifying the Stripe-Signature header against
// STRIPE_WEBHOOK_SECRET, never by anything in the request body.
export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 501 });
  }

  const stripe = getStripeClient()!;
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const organizationId = session.client_reference_id;
      if (!organizationId || !session.subscription || !session.customer) break;

      const stripeSub = await stripe.subscriptions.retrieve(String(session.subscription));
      const planCode = stripeSub.metadata?.planCode;
      const plan = planCode ? await prisma.subscriptionPlan.findUnique({ where: { code: planCode } }) : null;

      await prisma.subscription.update({
        where: { organizationId },
        data: {
          stripeCustomerId: String(session.customer),
          stripeSubscriptionId: stripeSub.id,
          status: mapStripeStatus(stripeSub.status),
          planId: plan?.id,
          currentPeriodStart: new Date(stripeSub.items.data[0]?.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.items.data[0]?.current_period_end * 1000),
        },
      });
      await recordAuditEvent({
        organizationId,
        eventType: "ORG_SETTINGS_CHANGED",
        description: `Stripe checkout completed — subscription activated${plan ? ` on the "${plan.name}" plan` : ""}.`,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object;
      const organizationId = stripeSub.metadata?.organizationId;
      if (!organizationId) break;

      await prisma.subscription.update({
        where: { organizationId },
        data: {
          status: mapStripeStatus(stripeSub.status),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          currentPeriodStart: stripeSub.items.data[0] ? new Date(stripeSub.items.data[0].current_period_start * 1000) : undefined,
          currentPeriodEnd: stripeSub.items.data[0] ? new Date(stripeSub.items.data[0].current_period_end * 1000) : undefined,
          canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
        },
      });
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      const subscription = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
      if (!subscription) break;

      await prisma.billingRecord.upsert({
        where: { stripeInvoiceId: invoice.id ?? "" },
        update: { status: event.type === "invoice.paid" ? "PAID" : "FAILED", paidAt: event.type === "invoice.paid" ? new Date() : null },
        create: {
          organizationId: subscription.organizationId,
          stripeInvoiceId: invoice.id,
          amountCents: invoice.amount_due,
          currency: invoice.currency,
          status: event.type === "invoice.paid" ? "PAID" : "FAILED",
          pdfUrl: invoice.invoice_pdf ?? null,
          paidAt: event.type === "invoice.paid" ? new Date() : null,
        },
      });

      if (event.type === "invoice.payment_failed") {
        await prisma.subscription.update({ where: { organizationId: subscription.organizationId }, data: { status: "PAST_DUE" } });
      }
      await recordAuditEvent({
        organizationId: subscription.organizationId,
        eventType: "ORG_SETTINGS_CHANGED",
        description: event.type === "invoice.paid" ? "Invoice paid." : "Invoice payment failed.",
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

function mapStripeStatus(status: Stripe.Subscription.Status): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "PAST_DUE";
    default:
      return "CANCELED";
  }
}

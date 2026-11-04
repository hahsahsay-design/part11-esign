import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiContext, handleApiAuthError } from "@/lib/api-guard";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

export async function POST() {
  try {
    const { membership } = await requireApiContext("org.manage_billing");

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing isn't connected yet. An administrator needs to set STRIPE_SECRET_KEY to enable the billing portal." },
        { status: 501 },
      );
    }

    const subscription = await prisma.subscription.findUnique({ where: { organizationId: membership.organizationId } });
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account yet — subscribe to a plan first." }, { status: 400 });
    }

    const stripe = getStripeClient()!;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL}/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return handleApiAuthError(error);
  }
}

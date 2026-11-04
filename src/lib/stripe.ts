import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Lazily-constructed Stripe client. Returns null when STRIPE_SECRET_KEY is
 * unset (the default in this environment) so callers can degrade to a clear
 * "billing isn't configured yet" response instead of crashing — the same
 * pattern used for email (src/lib/email.ts) and storage (src/lib/storage.ts).
 */
export function getStripeClient(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-10-28.endive" });
  }
  return client;
}

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Allow local startup without Stripe when AUTH_MODE=dev
  console.warn("STRIPE_SECRET_KEY is not set; Stripe features are disabled.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2025-01-27.acacia"
});

/**
 * Test charges (no real billing) — set `SHOPIFY_BILLING_TEST=true` in env for dev stores while testing.
 * Production should leave this unset/false.
 */
export function billingIsTest(): boolean {
  return process.env.SHOPIFY_BILLING_TEST === "true";
}

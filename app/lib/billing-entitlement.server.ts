/**
 * Shopify Billing API is only available for apps distributed via the Shopify App Store.
 * Custom / admin-installed apps get: "Custom apps cannot use the Billing API".
 *
 * For those deployments, set PRO_SHOPS to a comma-separated list of myshopify.com
 * hostnames to grant Pro features without a subscription record in Shopify.
 */
export function shopHasEnvProEntitlement(shop: string): boolean {
  const raw = (process.env.PRO_SHOPS ?? "").trim();
  if (!raw) return false;
  const shops = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return shops.includes(shop.toLowerCase());
}

export function resolveIsPro(
  shop: string,
  hasActivePayment: boolean,
): boolean {
  return hasActivePayment || shopHasEnvProEntitlement(shop);
}

/** User-facing text when billing.request fails (e.g. custom app). */
export function formatBillingRequestError(error: unknown): string {
  const fromShopify = extractShopifyBillingMessages(error);
  for (const msg of fromShopify) {
    if (msg.includes("Custom apps cannot use the Billing API")) {
      return (
        "Shopify in-app billing is not available for custom or private apps. " +
        "Ask your developer to add this shop to the PRO_SHOPS environment variable on the app server, " +
        "or list the app on the Shopify App Store to use subscriptions."
      );
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not start the subscription. Try again or contact support.";
}

function extractShopifyBillingMessages(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];
  const rec = error as { errorData?: unknown };
  const data = rec.errorData;
  if (!Array.isArray(data)) return [];
  return data
    .map((row) =>
      row && typeof row === "object" && "message" in row
        ? String((row as { message: unknown }).message)
        : "",
    )
    .filter(Boolean);
}

import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory GDPR-style webhooks for apps on the Shopify App Store.
 * @see https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 *
 * Variant image assignments live in Shopify (variant metafields), not in this app’s DB.
 * Session rows are keyed by shop; SHOP_REDACT removes them after uninstall cleanup window.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // No customer or order data stored in this app’s database.
      break;
    case "CUSTOMERS_REDACT":
      // No customer-specific records stored beyond optional staff session fields.
      break;
    case "SHOP_REDACT": {
      const domain =
        typeof (payload as { shop_domain?: string })?.shop_domain === "string"
          ? (payload as { shop_domain: string }).shop_domain
          : shop;
      await db.session.deleteMany({ where: { shop: domain } });
      break;
    }
    default:
      break;
  }

  return new Response();
};

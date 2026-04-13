# Billing, data, and storefront behavior

## What merchants pay for (Pro)

- **Shopify Billing API** recurring subscription (`PRO` plan), configured in [`app/shopify.server.ts`](../app/shopify.server.ts).
- **Pro** unlocks: unlimited variant images per variant, unlimited products with variant-image assignments, and **Copy to another product** (duplicate mappings to another product with the same variant count).

## Free tier

Limits are defined in [`app/lib/plans.ts`](../app/lib/plans.ts) and enforced server-side in [`app/routes/app._index.tsx`](../app/routes/app._index.tsx) (save/upload) using [`app/lib/shop-usage.server.ts`](../app/lib/shop-usage.server.ts).

## Where data lives

| Data | Location |
|------|-----------|
| Variant image file references | Shopify variant metafield `custom.variant_images` |
| OAuth sessions | Your database (`Session` via Prisma) |
| Free-tier product slot counts | Your database (`ShopUsage.configuredProductIds`) |
| Subscription state | Shopify (Billing API); checked with `billing.check`. **Custom/private apps** cannot use the Billing API — use optional `PRO_SHOPS` (see [`app/lib/billing-entitlement.server.ts`](../app/lib/billing-entitlement.server.ts)). |

## Storefront (theme extension)

The **Online Store** reads metafields in Liquid; it does not call your app server on each page view.

- **v1 policy:** Paywall and limits apply to the **Admin app** (saving images). The theme block continues to render whatever metafield data exists in Shopify.
- After uninstall, [`app/routes/webhooks.app.uninstalled.tsx`](../app/routes/webhooks.app.uninstalled.tsx) removes **sessions** from your DB. **Variant metafields are not automatically deleted** (merchants keep catalog data in Shopify). To remove assignments on uninstall you would add an explicit Admin API job (optional product).

## Privacy policy (App Store)

Your public privacy policy should mention:

- Shopify OAuth and session storage.
- Use of Admin API to read/write products, variants, files, and metafields.
- **Billing**: subscription charges through Shopify.
- **ShopUsage**: storing which products are counted toward free-tier limits (shop identifier + product GIDs).

## Test billing

Set `SHOPIFY_BILLING_TEST=true` in development when using [test charges](https://shopify.dev/docs/apps/billing) on development stores. Leave unset in production.

## Custom apps (no Billing API)

Shopify returns *Custom apps cannot use the Billing API* when calling `billing.request`. That applies to admin-created or non–App Store installs. **In-app Subscribe** will not work until the app is a public App Store listing (or a distribution type that supports billing).

For those deployments, set **`PRO_SHOPS`** to a comma-separated list of `*.myshopify.com` hostnames. Those shops are treated as Pro without a Shopify subscription record. Document this in your merchant agreement if you charge outside Shopify.

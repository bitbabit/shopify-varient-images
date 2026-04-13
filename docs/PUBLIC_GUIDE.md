# BitBabit: Variant Images — Public handbook

**One page for merchants and developers:** what the app does, **pricing**, how to implement variant images on the **storefront PDP**, and where to find advanced examples.

---

## 1. What this app does

- **Admin (embedded app):** Assign one or more images **per product variant** (not only the main product image). Images are stored in Shopify as a **variant metafield** (`custom.variant_images`, list of files).
- **Online Store:** Show those images on the **product detail page (PDP)** when the customer changes variant — hero image + thumbnail strip.
- **Optional:** An **admin link** can open the app from the product details page in Shopify Admin with context.

Data lives in **Shopify** (metafields + files). The app uses your database only for **login sessions** and **free-plan usage counts**, not for storing image files.

---

## 2. Pricing (Free vs Pro)

| | **Free** | **Pro** |
|---|----------|--------|
| **Images per variant** | Up to **6** | **Unlimited** |
| **Products with variant images** | Up to **5** products | **Unlimited** |
| **Copy to another product** | No | **Yes** (duplicate mappings to another product with the same variant count) |
| **Price** | — | **USD $9.99 / month** (7-day trial; confirm in the app **Plan** page — subject to change in Partners) |

**Where to upgrade:** In the embedded app, open **Plan** (navigation) and subscribe through **Shopify** (standard App Store billing).

**Storefront:** The theme reads **metafields in Liquid**. Pro vs Free controls **saving in Admin**; existing metafield data on the storefront follows Shopify’s normal behavior (see [Billing & privacy](BILLING_AND_PRIVACY.md)).

---

## 3. Requirements (before implementation)

1. **Shopify store** with products that have **variants**.
2. **Metafield definition** (recommended before heavy use):
   - **Settings → Custom data → Variants**
   - Namespace: `custom`, key: `variant_images`
   - Type: **List of files** (images)
   - **Storefront access** enabled so Liquid can read values on the Online Store.
3. **App installed** from the Shopify App Store or your install link.

---

## 4. Assign images (merchant workflow)

1. Open **Apps → BitBabit: Variant Images** (or your app name).
2. **Select a product**, then assign images **per variant** (reorder, upload, or pick from Shopify Files).
3. **Save** each variant as needed.

Until images are saved, the storefront has nothing extra to show for that variant.

---

## 5. Storefront PDP — two ways to implement

### Option A — **Theme app extension (recommended, easiest)**

Use the **Variant image gallery** block from this app. **No custom CSS selectors** are required in the current version: the block renders its own gallery (hero + thumbnails) where you place it.

1. **Online Store → Themes → Customize**
2. Open the **Product** template
3. **Add block → Apps → Variant image gallery**
4. Drag the block to the main product area (often beside or above the buy box)
5. If you **only** want these images, use the theme editor to **hide or remove** your theme’s default **product media** block so you don’t show two galleries

**Behavior:** Variant changes use common events (`variant:changed`, variant picker `name="id"`) and `?variant=` links when applicable. You can customize the **empty message** in the block settings when a variant has no custom images.

---

### Option B — **Custom theme (snippet + event bus)**

For **fully custom themes** (e.g. Wetheme-style) you may integrate by rendering a **snippet** that toggles between native product media and metafield-driven UI, using `window.eventBus`, section IDs, and selectors such as `[data-product-media-wrapper]`.

This is **more work** but matches themes that don’t use the app block pattern.

**Full step-by-step example** (files, events, shell pattern, quick view): see the companion doc:

**[examples/variant-images-metafield-theme-integration.md](examples/variant-images-metafield-theme-integration.md)**

That document is the **reference implementation** description for “someone else’s storefront PDP” when you control the theme code.

---

## 6. Liquid quick reference (any integration)

**Read images for the selected variant:**

```liquid
{% assign variant_images = product.selected_or_first_available_variant.metafields.custom.variant_images.value %}
{% if variant_images and variant_images.size > 0 %}
  {% for image in variant_images %}
    <img src="{{ image | image_url: width: 1200 }}" alt="{{ image.alt | default: product.title | escape }}" loading="lazy">
  {% endfor %}
{% endif %}
```

Use `variant.metafields.custom.variant_images` inside `{% for variant in product.variants %}` when building JSON for JavaScript.

---

## 7. Deploy & updates

- After the developer releases a new version: **`shopify app deploy`** (or your host’s pipeline).
- Merchants may need to **accept** updated permissions or app versions when prompted.

---

## 8. Privacy, billing, and compliance

- **Sessions, billing, and data practices:** [BILLING_AND_PRIVACY.md](BILLING_AND_PRIVACY.md)
- **Hosting / env (for self-hosted installs):** [RENDER.md](../RENDER.md)

---

## 9. Support checklist (troubleshooting)

| Issue | What to check |
|--------|----------------|
| Nothing on PDP | Metafield definition has **Storefront** access; variant has saved images; theme block added **or** snippet integrated. |
| Wrong images | Confirm assignments in the app for that **variant**; hard-refresh PDP. |
| Variant change doesn’t update | Theme may use non-standard events; Option A works on most Online Store 2.0 themes. For custom themes, see **Option B** example doc. |
| “No extra images” message | That variant has no metafield files — assign in the app. |
| Free limits | Upgrade under **Plan** in the app. |

---

## 10. Document map

| Document | Audience |
|----------|----------|
| **[PUBLIC_GUIDE.md](PUBLIC_GUIDE.md)** (this page) | Merchants & implementers — overview, pricing, PDP options |
| **[examples/variant-images-metafield-theme-integration.md](examples/variant-images-metafield-theme-integration.md)** | Theme developers — deep integration example |
| **[BILLING_AND_PRIVACY.md](BILLING_AND_PRIVACY.md)** | Privacy policy inputs, billing behavior |
| **[RENDER.md](../RENDER.md)** | Hosting (e.g. Render + Neon) |

---

*Branding names (BitBabit, app title) may match your Shopify App listing. Adjust if your listing uses different wording.*

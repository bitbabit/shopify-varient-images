# BitBabit: Variant Images

Shopify app that assigns **per-variant images** (stored on a variant metafield) and shows them on the **product page** via a **theme app extension** (hero image + horizontal thumbnail strip). Includes an **embedded admin** UI and an optional **admin link** from the product details page.

---

## What gets stored

### Merchant data (in Shopify)

| Item | Value |
|------|--------|
| Owner | **Variant** |
| Namespace | `custom` |
| Key | `variant_images` |
| Type | **List of files** (images from Shopify Files / product media) |

The app writes this metafield using the Admin API. On the storefront, Liquid reads `variant.metafields.custom.variant_images`.

### App infrastructure (in your database)

The embedded app uses **Prisma** to store **OAuth sessions** (shop, access tokens, etc.) in a **`Session`** table — not product images. Variant image assignments are **only** in metafields. Postgres is required so installs stay authenticated between requests. See **[Why PostgreSQL?](RENDER.md#why-postgresql-if-we-use-shopify-metafields)** in [`RENDER.md`](RENDER.md).

---

## Requirements

- [Node.js](https://nodejs.org/) (see `package.json` `engines`)
- [Shopify Partner account](https://partners.shopify.com/) and a development store
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) (installed with the project via npm)

---

## Install and run locally

From the project root:

1. Start Postgres ([Neon](https://neon.tech/) URL in `.env`, or see [`RENDER.md`](RENDER.md) / `docker compose up -d`).
2. Copy `.env.example` → `.env` and set `DATABASE_URL` (and Shopify vars for `shopify app dev`).
3. Run migrations and dev:

```bash
npm install
npx prisma migrate dev
npm run dev
```

`npm run dev` runs `shopify app dev` (see `package.json`). Follow the CLI prompts to select your app and store. When the embedded app opens, install or update the app if asked.

**Useful commands**

| Command | Purpose |
|--------|---------|
| `npm run dev` | Local dev (app + extensions) |
| `npm run deploy` | Deploy app + extensions (`shopify app deploy`) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run setup` | `prisma generate` + `prisma migrate deploy` |

---

## Merchant setup (storefront)

1. **Custom data (metafield definition)**  
   In Shopify Admin: **Settings → Custom data → Variants**. Ensure a metafield exists:

   - Namespace and key: `custom` / `variant_images`  
   - Type: **List of files** (or equivalent)  
   - **Storefront access** enabled so Liquid and the Storefront API can read it  

   If the app created values before a definition existed, add the definition and keep the same namespace/key.

2. **Assign images in the app**  
   Open the app from **Apps**, choose a product, assign images per variant, and save.

3. **Theme**  
   **Online Store → Themes → Customize → Product template → Add block → Apps → Variant image gallery**  
   If the gallery does not swap, set **Gallery container CSS selector** to match your theme’s product media wrapper (comma-separated selectors; first match wins).

4. **Deploy**  
   After you release a new version: `npm run deploy` (or `shopify app deploy`).

---

## Fetch variant images in Liquid

Images are **file references** on the variant metafield. Use `.value` to get the list, then loop and pipe each item through the [`image_url`](https://shopify.dev/docs/api/liquid/filters/image_url) filter (and optional [`image_tag`](https://shopify.dev/docs/api/liquid/filters/image_tag)).

### Single variant (e.g. current selection)

```liquid
{% assign variant_images = product.selected_or_first_available_variant.metafields.custom.variant_images.value %}

{% if variant_images and variant_images.size > 0 %}
  {% for image in variant_images %}
    <img
      src="{{ image | image_url: width: 1200 }}"
      alt="{{ image.alt | default: product.title | escape }}"
      loading="lazy"
    >
  {% endfor %}
{% endif %}
```

### Every variant on the product (JSON for JS or server-side loop)

```liquid
{% for variant in product.variants %}
  <div data-variant-id="{{ variant.id }}">
    {% assign vimgs = variant.metafields.custom.variant_images.value %}
    {% if vimgs %}
      {% for image in vimgs %}
        {{ image | image_url: width: 800 }}
        {% unless forloop.last %}|{% endunless %}
      {% endfor %}
    {% endif %}
  </div>
{% endfor %}
```

### Pre-serialize for JavaScript (pattern used in the theme block)

```liquid
<script>
  window.myVariantImages = {
    {% for variant in product.variants %}
      "{{ variant.id }}": [
        {% assign vimgs = variant.metafields.custom.variant_images.value %}
        {% if vimgs %}
          {% for image in vimgs %}
            {
              "src": {{ image | image_url: width: 1400 | json }},
              "thumb": {{ image | image_url: width: 200 | json }},
              "alt": {{ image.alt | default: product.title | json }}
            }{% unless forloop.last %},{% endunless %}
          {% endfor %}
        {% endif %}
      ]{% unless forloop.last %},{% endunless %}
    {% endfor %}
  };
</script>
```

### Notes

- If `variant.metafields.custom.variant_images` is empty, the definition may be missing, wrong type, or **storefront visibility** is off.
- Replace `custom` / `variant_images` if you use a different namespace/key (keep them in sync with the app).

---

## Extensions in this repo

| Extension | Path | Purpose |
|-----------|------|---------|
| Theme | `extensions/varient-images/` | Block **Variant image gallery** — replaces theme gallery with hero + thumbnails when variants have images |
| Admin link | `extensions/variant-gallery-admin-link/` | Link on product details → opens app with product context |

Theme extension handle (see `extensions/varient-images/shopify.extension.toml`): `variant-gallery`.

---

## Admin link extension (CLI)

To regenerate or add another admin link:

```bash
shopify app generate extension --template admin_link --name your-link-name
```

Use `--template` (not the deprecated `--type` flag). Configure `url` and `target` in `shopify.extension.toml`.

---

## Shopify App Store (public listing)

Listing on the [Shopify App Store](https://shopify.dev/docs/apps/launch/shopify-app-store) means Shopify’s review team will test the app against [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements). The following is a practical checklist; always follow the latest official docs.

### Before you submit

1. **Production app URL**  
   Host the app on HTTPS. Replace placeholder URLs in `shopify.app.toml` (and Partner Dashboard) so `application_url` and OAuth **redirect URLs** match your deployment.

2. **Production database**  
   Use hosted PostgreSQL (e.g. **[Neon](https://neon.tech/)** — see [`RENDER.md`](RENDER.md)) and `DATABASE_URL`. Prisma stores **OAuth sessions**, not variant images (those stay in Shopify metafields).

3. **Mandatory compliance webhooks** (App Store requirement)  
   This project registers [mandatory compliance webhooks](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) in `shopify.app.toml` and handles them in `app/routes/webhooks.app.compliance.tsx`. Deploy so `/webhooks/app/compliance` is reachable on your production host.

4. **Privacy policy**  
   Publish a **public URL** to a privacy policy that describes what data the app uses (sessions, Shopify APIs, variant metafields, etc.). You will add this URL in the app listing.

5. **App listing in Partners**  
   In the [Partner Dashboard](https://partners.shopify.com/) → your app → **Distribution** → **Shopify App Store**: create the listing (description, screenshots, pricing, support email, **app icon** 1200×1200, etc.). Use the guided [App Store review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review) flow.

6. **Automated checks**  
   Complete the checks on the submission page; fix failures before requesting review.

7. **Technical expectations (summary)**  
   Embedded apps must work with **session tokens**, use **App Bridge**, and (for new public apps) use the **GraphQL Admin API** as required by current policy. See [requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) and [checklist](https://shopify.dev/docs/apps/launch/app-requirements-checklist).

8. **Test store & instructions**  
   Provide a **development store** (or clear install/testing steps) and an **emergency contact** when the form asks for them.

### Submit for review

When hosting, webhooks, and listing details are ready:

```bash
npm run deploy
```

Then finish the **Submit for review** steps in the Partner Dashboard. Review timelines and feedback are communicated by email to the submission contact.

---

## Deploy

```bash
npm run deploy
```

This publishes a new app version (embedded app + extensions). Merchants may need to accept updates or new scopes when prompted.

**Host in production:** **[`RENDER.md`](RENDER.md)** — **Render (free tier) + Neon (free tier Postgres)**. Alternative: [`RAILWAY.md`](RAILWAY.md).

---

## Project structure (high level)

- `app/` — Embedded admin (React Router), GraphQL for products, metafields, files; webhooks including **compliance** (`webhooks.app.compliance.tsx`)  
- `extensions/varient-images/` — Theme app extension (Liquid block)  
- `extensions/variant-gallery-admin-link/` — Admin link extension  
- `prisma/` — Session storage (**PostgreSQL** via `DATABASE_URL`; see `docker-compose.yml` for local)  

---

## Documentation links

- [Shopify apps](https://shopify.dev/docs/apps/getting-started)  
- [Theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)  
- [Liquid reference](https://shopify.dev/docs/api/liquid)  
- [Metafields in Liquid](https://shopify.dev/docs/api/liquid/objects/metafield)  
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)  

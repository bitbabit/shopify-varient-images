# Variant images (metafield) — theme integration guide

This document describes **how a custom Shopify theme can show per-variant images from a variant metafield** (list of image files). It is the **advanced (Option B)** integration: snippet + `eventBus` + gallery shell pattern — useful when you **do not** use the app’s theme block, or you need parity with a specific theme architecture.

**Start here for most merchants:** [PUBLIC_GUIDE.md](../PUBLIC_GUIDE.md) (single handbook: pricing, app block, overview).

---

## What the merchant / app provides

| Item | Requirement |
|------|-------------|
| **Resource** | Variant (not product-level only, unless you use a different pattern). |
| **Namespace & key** | `custom.variant_images` (must match Liquid + any app sync). |
| **Type** | List of **files** (images). Shopify Admin: *Settings → Custom data → Variants → definition*. |
| **Storefront access** | The metafield definition must be available to the **Online Store** (Liquid). |

The app (or bulk editor) should populate `variant.metafields.custom.variant_images` with one or more image files per variant.

---

## What the theme does (high level)

1. **Liquid** checks whether **any** variant has a non-empty `custom.variant_images` list.
2. If **no** variant has images → **nothing** is output (native product gallery only; no extra JS/CSS).
3. If **yes** → the theme injects a **snippet** that:
   - Builds a **JavaScript config** on `window.variantImages[…]` mapping **variant ID → `{ src, thumb, alt }[]`**.
   - Runs a **small script** that:
     - Finds the gallery container (default: `[data-product-media-wrapper]`).
     - On variant change, either shows a **custom hero + thumbnails** built from metafield URLs, or **restores the native** theme gallery when the selected variant has no metafield images.

This avoids permanently replacing the theme’s `<product-media>` markup in Liquid; it **toggles** between “native” and “metafield” UI in the browser.

---

## Files involved in this theme

| File | Role |
|------|------|
| `snippets/variant-images-metafield-gallery.liquid` | Detection, inline styles, `window.variantImages` JSON, and all gallery toggle logic. |
| `sections/template--product.liquid` | Renders the snippet **once per product page**, **after** the closing `</div>` of `[data-product-media-wrapper]` (so the script is not nested inside the media wrapper). |
| `snippets/quick-view-product.liquid` | Renders the same snippet with `section_id_override` so event scoping matches quick view. |

**Note:** `featured-product` and other sections do **not** include this snippet in the current tree; add the same `{% render 'variant-images-metafield-gallery', … %}` there if you need parity.

---

## Metafield usage in Liquid

**Detection (enable gallery only when data exists):**

```liquid
assign variant_img_gallery_active = false
for variant in product.variants
  assign _vimgs = variant.metafields.custom.variant_images.value
  if _vimgs != blank
    assign variant_img_gallery_active = true
    break
  endif
endfor
```

**Per-variant image URLs (serialized for JS):**

```liquid
assign vimgs = variant.metafields.custom.variant_images.value
for image in vimgs
  # image | image_url: width: 1400
  # image | image_url: width: 200  (thumbnail)
endfor
```

Use `image.alt | default: product.title` for accessibility.

---

## Browser config: `window.variantImages`

For each product + section instance, the theme defines a **unique key**:

`vimg-{section.id}-{product.id}`

Each entry looks like:

```js
window.variantImages["vimg-…"] = {
  selectors: "[data-product-media-wrapper]",  // optional override via snippet param
  sectionId: "<section id for event filtering>",
  byVariantId: {
    "123456789": [
      { "src": "https://…", "thumb": "https://…", "alt": "…" }
    ]
  }
};
```

- **`sectionId`** must match the theme’s `product-information` **`data-section-id`** so `eventBus` handlers only affect the correct section.
- On **main PDP**, the snippet uses `section.id`.
- On **quick view**, pass **`section_id_override`** (e.g. `quick-view-product-{section.id}`) so it matches `product-information data-section-id` in the drawer.

---

## Runtime behavior

### 1. Gallery container

The script resolves the gallery root with:

- Default selector: `[data-product-media-wrapper]`
- Optional: comma-separated list via snippet parameter `gallery_selector` (if exposed in your theme).

### 2. “Shell” pattern (native vs app UI)

When metafield images should show:

1. The **existing children** of `[data-product-media-wrapper]` are moved into a wrapper `div[data-bb-vimg-native]`.
2. A sibling `div[data-bb-vimg-app]` is added for the metafield gallery (hero + thumb strip).
3. Native root is hidden; app root is shown.

When the selected variant has **no** metafield images:

- App root is cleared and hidden; native root is shown again (`showNativeMode`).

The wrapper gets `data-bb-vimg-shelled="1"` so this is only done once.

### 3. Variant identity

The script resolves the active variant from:

- `eventBus` payloads (`variant.id`, optional `sectionId` filter),
- DOM: `select[name="id"]`, `input[name="id"]:checked`, `input[name="id"][type="hidden"]`,
- URL query `?variant=`.

Variant IDs are normalized (numeric string or GID `ProductVariant/123`).

### 4. Events wired

| Source | Purpose |
|--------|---------|
| `window.eventBus` | `variant:change`, `variant:updated` — same bus as Wetheme `product-information` / `product-media`. |
| `window.eventBus` | `product:media:updated` — re-find gallery after theme replaces media. |
| `document` | `variant:changed`, `product:variant:change` (custom events, if used). |
| `document` | `change` / `input` capture on variant `id` fields. |
| `window` | `popstate` (browser back/forward). |

Handlers compare **`ctx.sectionId`** to **`cfg.sectionId`** when present, so multiple products on a page do not cross-fire.

### 5. Timing / theme race

After applying metafield UI, the script **schedules re-applies** at short intervals so a late-running theme script does not leave the native gallery visible when metafield images exist (`scheduleReapplyBeatsTheme`).

---

## Fallback when the app is removed or data is empty

| Scenario | Behavior |
|----------|----------|
| No variant has `custom.variant_images` | Snippet outputs **nothing** — default theme gallery only. |
| Variant has an **empty** list | That variant uses **native** gallery (`showNativeMode`). |
| Metafield definition deleted | Liquid sees blank values → same as “no app”. |

No permanent DOM replacement in Liquid; removing the snippet restores stock theme behavior.

---

## Optional snippet parameters (for theme developers)

When rendering:

```liquid
{% render 'variant-images-metafield-gallery',
  product: product,
  section: section,
  section_id_override: section_id,
  gallery_selector: '[data-product-media-wrapper]'
%}
```

| Parameter | Purpose |
|-----------|-----------|
| `section_id_override` | Use in quick view / modals where `product-information`’s `data-section-id` is not `section.id`. |
| `gallery_selector` | CSS selector (or comma-separated list) for the gallery root; defaults to `[data-product-media-wrapper]`. |

---

## Aligning your app documentation

1. **Metafield definition**: variant scope, `custom.variant_images`, list of files, storefront/Liquid access.
2. **Sync**: ensure every variant that should show custom images has at least one file in the list.
3. **Theme**: one snippet + two renders (PDP + quick view) as above; namespace/key must match Liquid.
4. **Testing**: change options on PDP and in quick view; confirm `sectionId` matches so only the active product updates.

---

## Namespace / key changes

If your app uses another namespace or key (e.g. `app--12345.variant_gallery`), update **all** references in `variant-images-metafield-gallery.liquid`:

- `variant.metafields.custom.variant_images.value`

to the correct access pattern, e.g.:

- `variant.metafields["app--12345"]["variant_gallery"].value`

Keep Storefront visibility enabled for that definition.

---

## Related: collection grid (quick-add cards)

This snippet targets the **product page gallery**. **Collection / search product cards** often use a separate JSON payload (e.g. `collection-card-variant-data.liquid` + `component-collection-card-variants.js`) with `featured_image` per variant. If you want metafield images there too, extend that JSON to prefer the first file from `custom.variant_images` when present — that is **independent** of this PDP snippet.

---

*This file is maintained in the app repo as a portable example. It may mirror `shopify/docs/variant-images-metafield-theme-integration.md` in a multi-repo workspace.*

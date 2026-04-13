import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ShopifyFilesPanel } from "../components/ShopifyFilesPanel";
import { VariantImageAssignment } from "../components/VariantImageAssignment";
import {
  loadProductForVariantImages,
  normalizeShopifyProductGid,
  saveVariantImagesMetafield,
  uploadAndCreateFile,
  fetchFilePreviews,
  listShopifyImageFiles,
  duplicateVariantImagesBetweenProducts,
  type AdminGraphql,
  type ProductPayload,
  type ShopifyFileRow,
} from "../lib/variant-images.server";
import { PRO_PLAN } from "../shopify.server";
import { billingIsTest } from "../lib/billing-env.server";
import {
  FREE_MAX_IMAGES_PER_VARIANT,
  FREE_MAX_PRODUCTS_WITH_IMAGES,
} from "../lib/plans";
import {
  assertFreeTierSaveAllowed,
  getShopUsage,
  syncShopUsageAfterSave,
} from "../lib/shop-usage.server";

type LoaderData = {
  shop: string;
  product: ProductPayload | null;
  productId: string | null;
  error?: string | null;
  isPro: boolean;
  configuredProductCount: number;
  freeMaxImagesPerVariant: number;
  freeMaxProducts: number;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const { hasActivePayment } = await billing.check({
    plans: [PRO_PLAN],
    isTest: billingIsTest(),
  });
  const configuredProductIds = await getShopUsage(session.shop);
  const url = new URL(request.url);
  // Admin links often pass numeric `id`; GraphQL needs a Product GID.
  const rawProductId =
    url.searchParams.get("productId") ?? url.searchParams.get("id");
  const productId = rawProductId
    ? normalizeShopifyProductGid(rawProductId)
    : null;
  if (!productId) {
    return {
      shop: session.shop,
      product: null,
      productId: null,
      error: null,
      isPro: hasActivePayment,
      configuredProductCount: configuredProductIds.length,
      freeMaxImagesPerVariant: FREE_MAX_IMAGES_PER_VARIANT,
      freeMaxProducts: FREE_MAX_PRODUCTS_WITH_IMAGES,
    } satisfies LoaderData;
  }
  try {
    const product = await loadProductForVariantImages(
      admin.graphql as unknown as AdminGraphql,
      productId,
    );
    return {
      shop: session.shop,
      product,
      productId,
      error: product ? null : "Product not found.",
      isPro: hasActivePayment,
      configuredProductCount: configuredProductIds.length,
      freeMaxImagesPerVariant: FREE_MAX_IMAGES_PER_VARIANT,
      freeMaxProducts: FREE_MAX_PRODUCTS_WITH_IMAGES,
    } satisfies LoaderData;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load product.";
    return {
      shop: session.shop,
      product: null,
      productId,
      error: message,
      isPro: hasActivePayment,
      configuredProductCount: configuredProductIds.length,
      freeMaxImagesPerVariant: FREE_MAX_IMAGES_PER_VARIANT,
      freeMaxProducts: FREE_MAX_PRODUCTS_WITH_IMAGES,
    } satisfies LoaderData;
  }
};

export type ActionData =
  | {
      ok: true;
      id?: string;
      forVariant?: string;
      previews?: Record<string, { url: string; altText?: string | null }>;
      files?: ShopifyFileRow[];
    }
  | { ok: false; message: string };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const graphql = admin.graphql as unknown as AdminGraphql;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const isPro = (
    await billing.check({
      plans: [PRO_PLAN],
      isTest: billingIsTest(),
    })
  ).hasActivePayment;

  if (intent === "listFiles") {
    const query = String(formData.get("query") ?? "");
    return await listShopifyImageFiles(graphql, query);
  }

  if (intent === "resolvePreviews") {
    const raw = String(formData.get("gids") ?? "[]");
    let gids: string[] = [];
    try {
      gids = JSON.parse(raw) as unknown as string[];
      if (!Array.isArray(gids)) throw new Error();
      gids = gids.filter((x): x is string => typeof x === "string");
    } catch {
      return { ok: false as const, message: "Invalid image ids." };
    }
    const previews = await fetchFilePreviews(graphql, gids);
    return { ok: true as const, previews };
  }

  if (intent === "upload") {
    const file = formData.get("file");
    const forVariant = String(formData.get("forVariant") ?? "");
    const productGid = String(formData.get("productId") ?? "");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false as const, message: "Choose an image file to upload." };
    }
    if (!isPro && productGid && forVariant) {
      const pid = normalizeShopifyProductGid(productGid);
      const loaded = await loadProductForVariantImages(graphql, pid);
      const v = loaded?.variants.find((x) => x.id === forVariant);
      if (v && v.fileGids.length >= FREE_MAX_IMAGES_PER_VARIANT) {
        return {
          ok: false as const,
          message: `Free plan allows up to ${FREE_MAX_IMAGES_PER_VARIANT} images per variant. Upgrade to Pro for unlimited.`,
        };
      }
    }
    const result = await uploadAndCreateFile(graphql, file);
    if (!result.ok) {
      return { ok: false as const, message: result.message };
    }
    return { ok: true as const, id: result.id, forVariant };
  }

  if (intent === "save") {
    const variantId = String(formData.get("variantId") ?? "");
    const productGidRaw = String(formData.get("productId") ?? "");
    const fileGidsRaw = String(formData.get("fileGids") ?? "[]");
    let fileGids: string[] = [];
    try {
      const parsed = JSON.parse(fileGidsRaw) as unknown;
      if (!Array.isArray(parsed)) throw new Error();
      fileGids = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      return { ok: false as const, message: "Invalid file list." };
    }
    if (!variantId || !productGidRaw) {
      return { ok: false as const, message: "Missing variant or product." };
    }
    const productGid = normalizeShopifyProductGid(productGidRaw);
    if (!isPro) {
      const configured = await getShopUsage(session.shop);
      const gate = assertFreeTierSaveAllowed({
        productGid,
        fileGidsForThisVariant: fileGids,
        configuredProductIds: configured,
      });
      if (!gate.ok) return gate;
    }
    const result = await saveVariantImagesMetafield(
      graphql,
      variantId,
      fileGids,
    );
    if (!result.ok) return result;
    const fresh = await loadProductForVariantImages(graphql, productGid);
    if (fresh) {
      await syncShopUsageAfterSave({
        shop: session.shop,
        productGid,
        variantFileGids: fresh.variants.map((v) => ({
          variantId: v.id,
          fileGids: v.fileGids,
        })),
      });
    }
    return { ok: true as const };
  }

  if (intent === "duplicate") {
    if (!isPro) {
      return {
        ok: false as const,
        message:
          "Copying variant images to another product is a Pro feature. Upgrade from Plan & billing.",
      };
    }
    const sourceRaw = String(formData.get("sourceProductId") ?? "");
    const targetRaw = String(formData.get("targetProductId") ?? "");
    if (!sourceRaw || !targetRaw) {
      return { ok: false as const, message: "Select a target product." };
    }
    const source = normalizeShopifyProductGid(sourceRaw);
    const target = normalizeShopifyProductGid(targetRaw);
    if (source === target) {
      return { ok: false as const, message: "Choose a different target product." };
    }
    return await duplicateVariantImagesBetweenProducts(graphql, source, target);
  }

  return { ok: false as const, message: "Unknown action." };
};

export default function VariantImagesPage() {
  const {
    shop,
    product,
    productId,
    error: loadError,
    isPro,
    configuredProductCount,
    freeMaxImagesPerVariant,
    freeMaxProducts,
  } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [, setSearchParams] = useSearchParams();
  const saveFetcher = useFetcher<ActionData>();
  const uploadFetcher = useFetcher<ActionData>();
  const previewFetcher = useFetcher<ActionData>();
  const filesFetcher = useFetcher<ActionData>();
  const duplicateFetcher = useFetcher<ActionData>();
  const revalidator = useRevalidator();

  const [variantFiles, setVariantFiles] = useState<Record<string, string[]>>({});
  const [fileBrowseVariantId, setFileBrowseVariantId] = useState<string | null>(
    null,
  );
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [previewExtras, setPreviewExtras] = useState<
    Record<string, { url: string; altText?: string | null }>
  >({});
  const [pendingSaveVariantId, setPendingSaveVariantId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingVariantRef = useRef<string | null>(null);

  const previewLookup = useMemo(() => {
    const m: Record<string, { url: string; altText?: string | null }> = {};
    if (product) {
      for (const p of product.productImages) {
        m[p.id] = { url: p.url, altText: p.altText };
      }
      for (const v of product.variants) {
        Object.assign(m, v.filePreviewByGid);
      }
    }
    Object.assign(m, previewExtras);
    return m;
  }, [product, previewExtras]);

  useEffect(() => {
    setPreviewExtras({});
  }, [product?.id]);

  useEffect(() => {
    if (!product) {
      setVariantFiles({});
      return;
    }
    const next: Record<string, string[]> = {};
    for (const v of product.variants) {
      next[v.id] = [...v.fileGids];
    }
    setVariantFiles(next);
  }, [product?.id]);

  const requestPreviews = useCallback(
    (gids: string[]) => {
      const missing = gids.filter((g) => !previewLookup[g]);
      if (missing.length === 0) return;
      previewFetcher.submit(
        {
          intent: "resolvePreviews",
          gids: JSON.stringify(missing),
        },
        { method: "post" },
      );
    },
    [previewFetcher, previewLookup],
  );

  /** Keeps upload success effect from re-firing when `requestPreviews` identity changes (e.g. after preview resolve). */
  const requestPreviewsRef = useRef(requestPreviews);
  requestPreviewsRef.current = requestPreviews;

  useEffect(() => {
    const d = previewFetcher.data;
    if (!d || previewFetcher.state !== "idle" || !d.ok) return;
    if ("previews" in d && d.previews && Object.keys(d.previews).length > 0) {
      setPreviewExtras((prev) => ({ ...prev, ...d.previews }));
    }
  }, [previewFetcher.data, previewFetcher.state]);

  useEffect(() => {
    const d = uploadFetcher.data;
    if (!d || uploadFetcher.state !== "idle") return;
    if (d.ok && "id" in d && d.id && "forVariant" in d && d.forVariant) {
      const vid = d.forVariant;
      setVariantFiles((prev) => ({
        ...prev,
        [vid]: [...(prev[vid] ?? []), d.id!],
      }));
      shopify.toast.show("Image uploaded to Shopify Files");
      requestPreviewsRef.current([d.id!]);
    } else if (!d.ok) {
      shopify.toast.show(d.message, { isError: true });
    }
  }, [uploadFetcher.data, uploadFetcher.state, shopify]);

  useEffect(() => {
    const d = saveFetcher.data;
    if (!d || saveFetcher.state !== "idle") return;
    setPendingSaveVariantId(null);
    if (d.ok) {
      shopify.toast.show("Variant images saved");
    } else {
      shopify.toast.show(d.message, { isError: true });
    }
  }, [saveFetcher.data, saveFetcher.state, shopify]);

  useEffect(() => {
    const d = filesFetcher.data;
    if (!d || filesFetcher.state !== "idle") return;
    if (!d.ok) {
      shopify.toast.show(d.message, { isError: true });
    }
  }, [filesFetcher.data, filesFetcher.state, shopify]);

  useEffect(() => {
    const d = duplicateFetcher.data;
    if (!d || duplicateFetcher.state !== "idle") return;
    if (d.ok) {
      shopify.toast.show("Variant images copied to the target product.");
      revalidator.revalidate();
    } else {
      shopify.toast.show(d.message, { isError: true });
    }
  }, [duplicateFetcher.data, duplicateFetcher.state, shopify, revalidator]);

  const themeEditorUrl = useMemo(
    () => `https://${shop}/admin/themes/current/editor?template=product`,
    [shop],
  );

  const pickProduct = useCallback(async () => {
    try {
      const result = await shopify.resourcePicker({
        type: "product",
        action: "select",
        multiple: false,
      });
      const row = Array.isArray(result) ? result[0] : null;
      const id =
        row && typeof row === "object" && "id" in row
          ? String((row as { id: string }).id)
          : null;
      if (id) {
        setSearchParams({ productId: id });
      }
    } catch (e) {
      shopify.toast.show(
        e instanceof Error ? e.message : "Product selection cancelled",
        { isError: true },
      );
    }
  }, [shopify, setSearchParams]);

  const duplicateToProduct = useCallback(async () => {
    if (!product?.id) return;
    try {
      const result = await shopify.resourcePicker({
        type: "product",
        action: "select",
        multiple: false,
      });
      const row = Array.isArray(result) ? result[0] : null;
      const id =
        row && typeof row === "object" && "id" in row
          ? String((row as { id: string }).id)
          : null;
      if (id) {
        duplicateFetcher.submit(
          {
            intent: "duplicate",
            sourceProductId: product.id,
            targetProductId: id,
          },
          { method: "post" },
        );
      }
    } catch (e) {
      shopify.toast.show(
        e instanceof Error ? e.message : "Product selection cancelled",
        { isError: true },
      );
    }
  }, [shopify, product?.id, duplicateFetcher]);

  const filesList = useMemo((): ShopifyFileRow[] => {
    const d = filesFetcher.data;
    if (!d || !d.ok || !("files" in d) || !d.files) return [];
    return d.files;
  }, [filesFetcher.data]);

  const openFilesPicker = useCallback(
    (variantId: string) => {
      setFileBrowseVariantId(variantId);
      setFileSearchQuery("");
      filesFetcher.submit(
        { intent: "listFiles", query: "" },
        { method: "post" },
      );
    },
    [filesFetcher],
  );

  const submitFileSearch = useCallback(() => {
    filesFetcher.submit(
      { intent: "listFiles", query: fileSearchQuery },
      { method: "post" },
    );
  }, [filesFetcher, fileSearchQuery]);

  const appendImageGidsToVariant = useCallback(
    (variantId: string, ids: string[]) => {
      if (ids.length === 0) return;
      setVariantFiles((prev) => {
        const cur = [...(prev[variantId] ?? [])];
        const set = new Set(cur);
        ids.forEach((id) => {
          if (!set.has(id)) {
            set.add(id);
            cur.push(id);
          }
        });
        return { ...prev, [variantId]: cur };
      });
      requestPreviews(ids);
    },
    [requestPreviews],
  );

  const removeFile = useCallback((variantId: string, gid: string) => {
    setVariantFiles((prev) => ({
      ...prev,
      [variantId]: (prev[variantId] ?? []).filter((g) => g !== gid),
    }));
  }, []);

  const addFromProduct = useCallback(
    (variantId: string, gid: string) => {
      appendImageGidsToVariant(variantId, [gid]);
      shopify.toast.show("Image added from product");
    },
    [appendImageGidsToVariant, shopify],
  );

  const reorderVariant = useCallback((variantId: string, next: string[]) => {
    setVariantFiles((prev) => ({ ...prev, [variantId]: next }));
  }, []);

  const saveVariant = useCallback(
    (variantId: string) => {
      if (!product?.id) return;
      setPendingSaveVariantId(variantId);
      const fileGids = variantFiles[variantId] ?? [];
      saveFetcher.submit(
        {
          intent: "save",
          variantId,
          productId: product.id,
          fileGids: JSON.stringify(fileGids),
        },
        { method: "post" },
      );
    },
    [saveFetcher, variantFiles, product?.id],
  );

  const triggerUpload = useCallback((variantId: string) => {
    pendingVariantRef.current = variantId;
    fileInputRef.current?.click();
  }, []);

  const onHiddenFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const variantId = pendingVariantRef.current;
      e.target.value = "";
      if (!file || !variantId) return;
      const fd = new FormData();
      fd.set("intent", "upload");
      fd.set("file", file);
      fd.set("forVariant", variantId);
      if (product?.id) fd.set("productId", product.id);
      uploadFetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
    },
    [uploadFetcher, product?.id],
  );

  const saving =
    saveFetcher.state === "submitting" || saveFetcher.state === "loading";
  const uploading =
    uploadFetcher.state === "submitting" || uploadFetcher.state === "loading";
  const resolving =
    previewFetcher.state === "submitting" || previewFetcher.state === "loading";
  const filesLoading =
    filesFetcher.state === "submitting" || filesFetcher.state === "loading";
  const duplicating =
    duplicateFetcher.state === "submitting" ||
    duplicateFetcher.state === "loading";

  return (
    <s-page heading="Variant images">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onHiddenFileChange}
      />

      {!isPro ? (
        <s-banner tone="info" heading="Free plan limits">
          <s-paragraph>
            Up to {freeMaxImagesPerVariant} images per variant and{" "}
            {freeMaxProducts} products with variant images ({configuredProductCount} /{" "}
            {freeMaxProducts} products in use).{" "}
            <s-link href="/app/billing">Upgrade to Pro</s-link> for unlimited images,
            unlimited products, and copy-to-product.
          </s-paragraph>
        </s-banner>
      ) : (
        <s-banner tone="success" heading="Pro">
          <s-paragraph>
            Unlimited images and products. Use &quot;Copy to another product&quot; below
            to duplicate mappings.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Product">
        <s-paragraph>
          Choose a product, then assign images per variant. Values save to{" "}
          <s-text type="strong">custom.variant_images</s-text>.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button onClick={pickProduct}>
            {productId ? "Change product" : "Select product"}
          </s-button>
        </s-stack>
        {product ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #e1e3e5",
              borderRadius: 10,
              padding: 10,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                overflow: "hidden",
                background: "#f6f6f7",
                border: "1px solid #e1e3e5",
                flexShrink: 0,
              }}
            >
              {product.productImages[0]?.url ? (
                <img
                  src={product.productImages[0].url}
                  alt={product.productImages[0].altText ?? product.title}
                  width={56}
                  height={56}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{product.title}</div>
              {product.minVariantPrice ? (
                <div style={{ fontSize: 12, color: "#6d7175" }}>
                  Starts at ${product.minVariantPrice}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              title="Clear selected product"
              style={{
                border: "1px solid #c9cccf",
                background: "#fff",
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 16,
                lineHeight: "30px",
                textAlign: "center",
              }}
            >
              ×
            </button>
          </div>
        ) : null}
      </s-section>

      {product && product.variants.length > 0 ? (
        <s-section heading="Pro: Copy to another product">
          <s-paragraph>
            Copy all variant image lists from this product to another product that has the
            same number of variants (matched in order).
          </s-paragraph>
          {isPro ? (
            <s-button onClick={duplicateToProduct} loading={duplicating}>
              Choose target product…
            </s-button>
          ) : (
            <s-paragraph>
              <s-link href="/app/billing">Subscribe to Pro</s-link> to enable this.
            </s-paragraph>
          )}
        </s-section>
      ) : null}

      {loadError ? (
        <s-banner tone="critical" heading="Could not load product">
          {loadError}
        </s-banner>
      ) : null}

      <s-section heading="Storefront">
        <s-paragraph>
          In Online Store → Customize, add the{" "}
          <s-text type="strong">Variant image gallery</s-text> app block on the
          product template.
        </s-paragraph>
        <s-button href={themeEditorUrl} target="_blank">
          Open theme editor (product template)
        </s-button>
      </s-section>

      {product && product.variants.length > 0 ? (
        <s-section heading="Variants">
          <s-stack direction="block" gap="large">
            <s-paragraph>
              Drag images to set order (first image is primary in storefront).
              You can also use Up/Down buttons.
            </s-paragraph>
            {resolving ? (
              <s-banner tone="info" heading="Loading previews">
                Resolving image thumbnails…
              </s-banner>
            ) : null}
            {product.variants.map((v) => {
              const gids = variantFiles[v.id] ?? [];
              const savingThis = saving && pendingSaveVariantId === v.id;
              return (
                <s-stack key={v.id} direction="block" gap="base">
                  <VariantImageAssignment
                    variantTitle={v.title}
                    orderedGids={gids}
                    previewByGid={previewLookup}
                    productImages={product.productImages}
                    uploading={uploading}
                    browsingFiles={filesLoading && fileBrowseVariantId === v.id}
                    saving={savingThis}
                    onReorder={(next) => reorderVariant(v.id, next)}
                    onRemove={(gid) => removeFile(v.id, gid)}
                    onAddFromProduct={(gid) => addFromProduct(v.id, gid)}
                    onPickFiles={() => openFilesPicker(v.id)}
                    onUpload={() => triggerUpload(v.id)}
                    onSave={() => saveVariant(v.id)}
                  />
                  {fileBrowseVariantId === v.id ? (
                    <ShopifyFilesPanel
                      loading={filesLoading}
                      files={filesList}
                      searchValue={fileSearchQuery}
                      onSearchChange={setFileSearchQuery}
                      onSearchSubmit={submitFileSearch}
                      assignedIds={new Set(gids)}
                      onPickFile={(gid) => {
                        appendImageGidsToVariant(v.id, [gid]);
                        shopify.toast.show("Image added from Files");
                      }}
                      onClose={() => setFileBrowseVariantId(null)}
                    />
                  ) : null}
                </s-stack>
              );
            })}
          </s-stack>
        </s-section>
      ) : productId && !loadError ? (
        <s-banner tone="warning" heading="No variants">
          This product has no variants to configure.
        </s-banner>
      ) : null}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

/** GraphQL function from authenticate.admin(request).admin.graphql */
export type AdminGraphql = (
  query: string,
  options?: unknown,
) => Promise<Response>;

const PRODUCT_QUERY = `#graphql
  query ProductVariantImages($id: ID!) {
    product(id: $id) {
      id
      title
      media(first: 50) {
        nodes {
          ... on MediaImage {
            id
            image {
              url
              altText
            }
          }
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          price
          metafield(namespace: "custom", key: "variant_images") {
            id
            value
          }
        }
      }
    }
  }
`;

const FILES_LIST_QUERY = `#graphql
  query ShopifyFilesList($first: Int!, $query: String) {
    files(first: $first, query: $query) {
      nodes {
        ... on MediaImage {
          id
          image {
            url
            altText
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

const NODES_QUERY = `#graphql
  query VariantImageNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on MediaImage {
        id
        image {
          url
          altText
        }
      }
      ... on GenericFile {
        id
        url
      }
    }
  }
`;

const METAFIELDS_SET = `#graphql
  mutation VariantImagesMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const STAGED_UPLOADS_CREATE = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE = `#graphql
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        ... on MediaImage {
          id
        }
        ... on GenericFile {
          id
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export type VariantRow = {
  id: string;
  title: string;
  fileGids: string[];
  filePreviewByGid: Record<string, { url: string; altText?: string | null }>;
};

/** Images already attached to the product (Media library) — same GIDs work in list.file_reference */
export type ProductImageOption = {
  id: string;
  url: string;
  altText?: string | null;
};

/** Row from Admin `files` query (images only) */
export type ShopifyFileRow = {
  id: string;
  url: string;
  altText?: string | null;
};

/** Build search string for `files(query: …)` — images only */
export function buildFilesSearchQuery(userSearch: string): string {
  const t = userSearch.trim();
  if (!t) return "media_type:IMAGE";
  return `media_type:IMAGE ${t}`;
}

export async function listShopifyImageFiles(
  admin: AdminGraphql,
  userSearch: string,
): Promise<{ ok: true; files: ShopifyFileRow[] } | { ok: false; message: string }> {
  const query = buildFilesSearchQuery(userSearch);
  const res = await admin(FILES_LIST_QUERY, {
    variables: { first: 40, query },
  });
  const json = (await res.json()) as {
    data?: {
      files?: {
        nodes?: (
          | {
              id?: string;
              image?: { url?: string | null; altText?: string | null } | null;
            }
          | null
        )[];
      };
    };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    return {
      ok: false,
      message: json.errors.map((e) => e.message).join("; "),
    };
  }
  const files: ShopifyFileRow[] = [];
  for (const node of json.data?.files?.nodes ?? []) {
    if (!node?.id || !node.image?.url) continue;
    files.push({
      id: node.id,
      url: node.image.url,
      altText: node.image.altText,
    });
  }
  return { ok: true, files };
}

export type ProductPayload = {
  id: string;
  title: string;
  minVariantPrice: string | null;
  productImages: ProductImageOption[];
  variants: VariantRow[];
};

export async function fetchFilePreviews(
  admin: AdminGraphql,
  gids: string[],
): Promise<Record<string, { url: string; altText?: string | null }>> {
  const unique = [...new Set(gids)].filter(Boolean);
  if (unique.length === 0) return {};
  const nodesRes = await admin(NODES_QUERY, {
    variables: { ids: unique },
  });
  const nodesJson = (await nodesRes.json()) as {
    data?: {
      nodes?: (
        | {
            id: string;
            image?: { url: string; altText?: string | null };
            url?: string;
          }
        | null
      )[];
    };
  };
  const map: Record<string, { url: string; altText?: string | null }> = {};
  for (const node of nodesJson.data?.nodes ?? []) {
    if (!node?.id) continue;
    if ("image" in node && node.image?.url) {
      map[node.id] = { url: node.image.url, altText: node.image.altText };
    } else if ("url" in node && typeof node.url === "string") {
      map[node.id] = { url: node.url, altText: null };
    }
  }
  return map;
}

function parseFileGids(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/**
 * Admin link URLs may pass a numeric product id; GraphQL Admin API requires a Product GID.
 */
export function normalizeShopifyProductGid(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep trimmed raw */
  }
  if (!s) return s;
  if (s.startsWith("gid://shopify/Product/")) return s;
  if (/^\d+$/.test(s)) return `gid://shopify/Product/${s}`;
  const legacy = s.match(/^Product\/(\d+)$/i);
  if (legacy) return `gid://shopify/Product/${legacy[1]}`;
  return s;
}

export async function loadProductForVariantImages(
  admin: AdminGraphql,
  productId: string,
): Promise<ProductPayload | null> {
  const id = normalizeShopifyProductGid(productId);
  if (!id) return null;
  const res = await admin(PRODUCT_QUERY, {
    variables: { id },
  });
  const json = (await res.json()) as {
    data?: {
      product?: {
        id: string;
        title: string;
        media?: {
          nodes: (
            | {
                id?: string;
                image?: { url?: string | null; altText?: string | null } | null;
              }
            | null
          )[];
        };
        variants: {
          nodes: {
            id: string;
            title: string;
            price?: string | null;
            metafield?: { value?: string | null } | null;
          }[];
        };
      } | null;
    };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const product = json.data?.product;
  if (!product) return null;

  const productImages: ProductImageOption[] = [];
  const fromProductMedia: Record<string, { url: string; altText?: string | null }> =
    {};
  for (const node of product.media?.nodes ?? []) {
    if (!node?.id || !node.image?.url) continue;
    productImages.push({
      id: node.id,
      url: node.image.url,
      altText: node.image.altText,
    });
    fromProductMedia[node.id] = {
      url: node.image.url,
      altText: node.image.altText,
    };
  }

  const allGids = new Set<string>();
  let minVariantPrice: string | null = null;
  const variants: VariantRow[] = product.variants.nodes.map((v) => {
    const fileGids = parseFileGids(v.metafield?.value);
    fileGids.forEach((g) => allGids.add(g));
    if (v.price != null) {
      const n = Number(v.price);
      if (!Number.isNaN(n)) {
        if (minVariantPrice === null || n < Number(minVariantPrice)) {
          minVariantPrice = String(n);
        }
      }
    }
    return {
      id: v.id,
      title: v.title,
      fileGids,
      filePreviewByGid: {},
    };
  });

  const gidsNeedingFetch = [...allGids].filter((gid) => !fromProductMedia[gid]);
  const fetchedMap =
    gidsNeedingFetch.length > 0
      ? await fetchFilePreviews(admin, gidsNeedingFetch)
      : {};

  const previewMap: Record<string, { url: string; altText?: string | null }> = {
    ...fromProductMedia,
    ...fetchedMap,
  };

  for (const row of variants) {
    const filePreviewByGid: Record<
      string,
      { url: string; altText?: string | null }
    > = {};
    for (const gid of row.fileGids) {
      if (previewMap[gid]) filePreviewByGid[gid] = previewMap[gid];
    }
    row.filePreviewByGid = filePreviewByGid;
  }

  return {
    id: product.id,
    title: product.title,
    minVariantPrice,
    productImages,
    variants,
  };
}

export async function saveVariantImagesMetafield(
  admin: AdminGraphql,
  variantId: string,
  fileGids: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const value = JSON.stringify(fileGids);
  const res = await admin(METAFIELDS_SET, {
    variables: {
      metafields: [
        {
          ownerId: variantId,
          namespace: "custom",
          key: "variant_images",
          type: "list.file_reference",
          value,
        },
      ],
    },
  });
  const json = (await res.json()) as {
    data?: {
      metafieldsSet?: {
        userErrors?: { message: string }[];
      };
    };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    return { ok: false, message: json.errors.map((e) => e.message).join("; ") };
  }
  const errs = json.data?.metafieldsSet?.userErrors ?? [];
  if (errs.length) {
    return {
      ok: false,
      message: errs.map((e) => e.message).join("; "),
    };
  }
  return { ok: true };
}

export async function uploadAndCreateFile(
  admin: AdminGraphql,
  file: File,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const filename = file.name || "upload";
  const mimeType = file.type || "application/octet-stream";

  let stagedRes = await admin(STAGED_UPLOADS_CREATE, {
    variables: {
      input: [
        {
          filename,
          mimeType,
          httpMethod: "PUT",
          resource: "FILE",
        },
      ],
    },
  });
  type StagedJson = {
    data?: {
      stagedUploadsCreate?: {
        stagedTargets?: {
          url: string;
          resourceUrl?: string;
          parameters: { name: string; value: string }[];
        }[];
        userErrors?: { message: string }[];
      };
    };
    errors?: { message: string }[];
  };

  let stagedJson = (await stagedRes.json()) as StagedJson;
  if (stagedJson.errors?.length) {
    return { ok: false, message: stagedJson.errors.map((e) => e.message).join("; ") };
  }
  let staged = stagedJson.data?.stagedUploadsCreate;
  let ue = staged?.userErrors ?? [];
  let target = staged?.stagedTargets?.[0];
  if (ue.length || !target?.url) {
    stagedRes = await admin(STAGED_UPLOADS_CREATE, {
      variables: {
        input: [
          {
            filename,
            mimeType,
            httpMethod: "POST",
            resource: "FILE",
          },
        ],
      },
    });
    stagedJson = (await stagedRes.json()) as StagedJson;
    staged = stagedJson.data?.stagedUploadsCreate;
    ue = staged?.userErrors ?? [];
    if (ue.length) {
      return { ok: false, message: ue.map((e) => e.message).join("; ") };
    }
    target = staged?.stagedTargets?.[0];
  }
  if (!target?.url) {
    return { ok: false, message: "Staged upload did not return a target URL." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let uploadResp = await fetch(target.url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: buffer,
  });
  if (!uploadResp.ok && (target.parameters?.length ?? 0) > 0) {
    const formData = new FormData();
    for (const p of target.parameters ?? []) {
      formData.append(p.name, p.value);
    }
    formData.append("file", new Blob([buffer], { type: mimeType }), filename);
    uploadResp = await fetch(target.url, {
      method: "POST",
      body: formData,
    });
  }
  if (!uploadResp.ok) {
    return {
      ok: false,
      message: `Upload failed: ${uploadResp.status} ${uploadResp.statusText}`,
    };
  }

  const resourceUrl = target.resourceUrl;
  if (!resourceUrl) {
    return { ok: false, message: "Staged upload did not return resourceUrl for fileCreate." };
  }

  const fileCreateRes = await admin(FILE_CREATE, {
    variables: {
      files: [
        {
          originalSource: resourceUrl,
          contentType: "IMAGE",
        },
      ],
    },
  });
  const fileCreateJson = (await fileCreateRes.json()) as {
    data?: {
      fileCreate?: {
        files?: ({ id?: string } | null)[] | null;
        userErrors?: { message: string }[];
      };
    };
    errors?: { message: string }[];
  };
  if (fileCreateJson.errors?.length) {
    return { ok: false, message: fileCreateJson.errors.map((e) => e.message).join("; ") };
  }
  const fc = fileCreateJson.data?.fileCreate;
  const ferrs = fc?.userErrors ?? [];
  if (ferrs.length) {
    return { ok: false, message: ferrs.map((e) => e.message).join("; ") };
  }
  const id = fc?.files?.find((f) => f?.id)?.id;
  if (!id) {
    return { ok: false, message: "fileCreate did not return a file id." };
  }
  return { ok: true, id };
}

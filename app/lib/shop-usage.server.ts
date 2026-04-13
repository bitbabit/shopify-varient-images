import prisma from "../db.server";
import {
  FREE_MAX_IMAGES_PER_VARIANT,
  FREE_MAX_PRODUCTS_WITH_IMAGES,
} from "./plans";

export async function getShopUsage(shop: string): Promise<string[]> {
  const row = await prisma.shopUsage.findUnique({
    where: { shop },
    select: { configuredProductIds: true },
  });
  return row?.configuredProductIds ?? [];
}

/**
 * Free tier: block save if too many images on a variant, or too many distinct products with images.
 */
export function assertFreeTierSaveAllowed(args: {
  productGid: string;
  fileGidsForThisVariant: string[];
  configuredProductIds: string[];
}):
  | { ok: true }
  | { ok: false; message: string } {
  if (args.fileGidsForThisVariant.length > FREE_MAX_IMAGES_PER_VARIANT) {
    return {
      ok: false,
      message: `Free plan allows up to ${FREE_MAX_IMAGES_PER_VARIANT} images per variant. Upgrade to Pro for unlimited.`,
    };
  }
  const ids = args.configuredProductIds;
  const already = ids.includes(args.productGid);
  if (!already && ids.length >= FREE_MAX_PRODUCTS_WITH_IMAGES) {
    return {
      ok: false,
      message: `Free plan covers up to ${FREE_MAX_PRODUCTS_WITH_IMAGES} products with variant images. Upgrade to Pro for unlimited products.`,
    };
  }
  return { ok: true };
}

/**
 * After a successful save, update which products "use" a slot (has any variant with ≥1 image).
 */
export async function syncShopUsageAfterSave(args: {
  shop: string;
  productGid: string;
  variantFileGids: { variantId: string; fileGids: string[] }[];
}): Promise<void> {
  const hasAny = args.variantFileGids.some((v) => v.fileGids.length > 0);
  const existing = await prisma.shopUsage.findUnique({
    where: { shop: args.shop },
  });
  let next = new Set(existing?.configuredProductIds ?? []);
  if (hasAny) {
    next.add(args.productGid);
  } else {
    next.delete(args.productGid);
  }
  await prisma.shopUsage.upsert({
    where: { shop: args.shop },
    create: {
      shop: args.shop,
      configuredProductIds: [...next],
    },
    update: { configuredProductIds: [...next] },
  });
}

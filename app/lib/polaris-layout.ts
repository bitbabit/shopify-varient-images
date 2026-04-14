/**
 * Approximate max inline size for `<s-page inline-size="base">` in embedded Admin.
 * Keeps custom chrome (e.g. AppShellHeader) aligned with page content.
 * @see https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/page
 */
export const POLARIS_PAGE_BASE_MAX_INLINE_STYLE =
  "min(60.5rem, calc(100vw - 42px))" as const;

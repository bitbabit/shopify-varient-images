import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

/**
 * Legacy URL: `/app/billing` → `/app/pricing` (single pricing & subscription page).
 */
export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const next = `/app/pricing${url.search}`;
  return redirect(next);
};

export default function BillingRedirect() {
  return null;
}

export const headers: HeadersFunction = (args) => boundary.headers(args);

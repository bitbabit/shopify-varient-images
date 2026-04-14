import type { HeadersFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { AppShellHeader } from "../components/AppShellHeader";

/** Keep in sync with `name` in shopify.app.toml (Admin listing name is set in Partners / deploy). */
const APP_PAGE_TITLE = "BitBabit:Variant Images";

export const meta: MetaFunction = () => [{ title: APP_PAGE_TITLE }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const docsUrl = new URL("/docs/", url.origin).href;

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", docsUrl };
};

export default function App() {
  const { apiKey, docsUrl } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <AppShellHeader docsUrl={docsUrl} />
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

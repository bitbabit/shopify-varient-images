import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, useActionData } from "react-router";
import { authenticate, PRO_PLAN } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  FREE_MAX_IMAGES_PER_VARIANT,
  FREE_MAX_PRODUCTS_WITH_IMAGES,
  PRO_PLAN_DISPLAY,
} from "../lib/plans";
import { billingIsTest } from "../lib/billing-env.server";
import {
  resolveIsPro,
  shopHasEnvProEntitlement,
  formatBillingRequestError,
} from "../lib/billing-entitlement.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PRO_PLAN],
    isTest: billingIsTest(),
  });
  const hasPro = resolveIsPro(session.shop, hasActivePayment);
  return {
    hasPro,
    proViaEnv: shopHasEnvProEntitlement(session.shop),
    subscriptions: appSubscriptions ?? [],
    isTest: billingIsTest(),
  };
};

export default function BillingPage() {
  const { hasPro, proViaEnv, subscriptions, isTest } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const actionData = useActionData<typeof action>();
  const subscribeError =
    actionData && "subscribeError" in actionData
      ? actionData.subscribeError
      : undefined;

  return (
    <s-page heading="Plan & billing">
      {subscribeError ? (
        <s-banner tone="critical" heading="Could not start subscription">
          {subscribeError}
        </s-banner>
      ) : null}
      <s-section heading={hasPro ? "Pro active" : "Upgrade to Pro"}>
        {hasPro ? (
          <s-paragraph>
            {proViaEnv ? (
              <>
                Pro is enabled for this shop via server configuration (
                <s-text type="strong">PRO_SHOPS</s-text>). Variant images are
                unlimited, and you can use &quot;Copy to another product&quot;
                from the home screen.
              </>
            ) : (
              <>
                You have an active Pro subscription. Variant images are
                unlimited, and you can use &quot;Copy to another product&quot;
                from the home screen.
              </>
            )}
          </s-paragraph>
        ) : (
          <>
            <s-paragraph>
              <strong>Free</strong>: up to {FREE_MAX_IMAGES_PER_VARIANT} images per variant and{" "}
              {FREE_MAX_PRODUCTS_WITH_IMAGES} products with variant images.
              <br />
              <strong>Pro</strong>: ${PRO_PLAN_DISPLAY.priceUsd} USD / {PRO_PLAN_DISPLAY.interval},{" "}
              {PRO_PLAN_DISPLAY.trialDays}-day trial — unlimited products and images per variant, plus
              &quot;Copy to another product&quot;.
            </s-paragraph>
            <s-paragraph>
              {isTest
                ? "Test billing is on (SHOPIFY_BILLING_TEST) — charges are not real."
                : "You will confirm payment in Shopify."}
            </s-paragraph>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="subscribe" />
              <s-button
                type="submit"
                variant="primary"
                loading={fetcher.state !== "idle"}
              >
                Subscribe to Pro
              </s-button>
            </fetcher.Form>
          </>
        )}
      </s-section>
      {subscriptions.length > 0 ? (
        <s-section heading="Subscription details">
          <pre style={{ fontSize: 12, overflow: "auto" }}>
            {JSON.stringify(
              subscriptions.map((s) => ({
                name: s.name,
                status: s.status,
                trialDays: s.trialDays,
              })),
              null,
              2,
            )}
          </pre>
        </s-section>
      ) : null}
    </s-page>
  );
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  if (String(formData.get("intent")) !== "subscribe") {
    return new Response(null, { status: 400 });
  }
  const { hasActivePayment } = await billing.check({
    plans: [PRO_PLAN],
    isTest: billingIsTest(),
  });
  if (resolveIsPro(session.shop, hasActivePayment)) {
    return { subscribeError: null as string | null };
  }
  const url = new URL(request.url);
  const returnUrl = `${url.origin}/app/billing`;
  try {
    return await billing.request({
      plan: PRO_PLAN,
      isTest: billingIsTest(),
      returnUrl,
    });
  } catch (e: unknown) {
    return { subscribeError: formatBillingRequestError(e) };
  }
};

export const headers: HeadersFunction = (args) => boundary.headers(args);

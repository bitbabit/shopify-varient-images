import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  Form,
  useLoaderData,
  useNavigation,
  useActionData,
} from "react-router";
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

export const meta: MetaFunction = () => [
  { title: "Pricing · BitBabit: Variant Images" },
];

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

export default function PricingPage() {
  const { hasPro, proViaEnv, subscriptions, isTest } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const subscribeError =
    actionData && "subscribeError" in actionData
      ? actionData.subscribeError
      : undefined;
  const subscribing =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "subscribe";

  return (
    <s-page heading="Pricing">
      <s-section heading="Plans for every store">
        <s-paragraph>
          Choose <strong>Free</strong> to get started, or upgrade to <strong>Pro</strong> for
          unlimited variant images, unlimited products, and copy-to-product workflows. Billing
          runs through Shopify when your app distribution supports it.
        </s-paragraph>
      </s-section>

      <s-section heading="Compare plans">
        <div style={{ overflowX: "auto", border: "1px solid #e1e3e5", borderRadius: 10 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              background: "#fff",
            }}
          >
            <thead>
              <tr style={{ background: "#f6f6f7", textAlign: "left" }}>
                <th style={{ padding: "12px 14px", fontWeight: 600 }}>Feature</th>
                <th style={{ padding: "12px 14px", fontWeight: 600 }}>Free</th>
                <th style={{ padding: "12px 14px", fontWeight: 600, color: "#008060" }}>Pro</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: "1px solid #e1e3e5" }}>
                <td style={{ padding: "10px 14px" }}>Images per variant</td>
                <td style={{ padding: "10px 14px" }}>Up to {FREE_MAX_IMAGES_PER_VARIANT}</td>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>Unlimited</td>
              </tr>
              <tr style={{ borderTop: "1px solid #e1e3e5" }}>
                <td style={{ padding: "10px 14px" }}>Products with variant images</td>
                <td style={{ padding: "10px 14px" }}>Up to {FREE_MAX_PRODUCTS_WITH_IMAGES}</td>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>Unlimited</td>
              </tr>
              <tr style={{ borderTop: "1px solid #e1e3e5" }}>
                <td style={{ padding: "10px 14px" }}>Copy to another product</td>
                <td style={{ padding: "10px 14px" }}>—</td>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>Included</td>
              </tr>
              <tr style={{ borderTop: "1px solid #e1e3e5" }}>
                <td style={{ padding: "10px 14px" }}>Price</td>
                <td style={{ padding: "10px 14px" }}>$0</td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                  ${PRO_PLAN_DISPLAY.priceUsd} USD / {PRO_PLAN_DISPLAY.interval}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <s-paragraph>
          <s-text type="strong">Pro</s-text> includes a {PRO_PLAN_DISPLAY.trialDays}-day trial where
          supported — confirm in checkout. Listing details may vary in Shopify Partners.
        </s-paragraph>
      </s-section>

      {subscribeError ? (
        <s-banner tone="critical" heading="Could not start subscription">
          {subscribeError}
        </s-banner>
      ) : null}

      <s-section heading={hasPro ? "Your subscription" : "Upgrade to Pro"}>
        {hasPro ? (
          <s-paragraph>
            {proViaEnv ? (
              <>
                Pro is enabled for this shop via server configuration (
                <s-text type="strong">PRO_SHOPS</s-text>). Variant images are unlimited, and you can
                use &quot;Copy to another product&quot; from the home screen.
              </>
            ) : (
              <>
                You have an active Pro subscription. Variant images are unlimited, and you can use
                &quot;Copy to another product&quot; from the home screen.
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
            <Form method="post" reloadDocument>
              <input type="hidden" name="intent" value="subscribe" />
              <s-button type="submit" variant="primary" loading={subscribing}>
                Subscribe to Pro
              </s-button>
            </Form>
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
  const returnUrl = `${url.origin}/app/pricing`;
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

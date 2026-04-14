import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import {
  FREE_MAX_IMAGES_PER_VARIANT,
  FREE_MAX_PRODUCTS_WITH_IMAGES,
  PRO_PLAN_DISPLAY,
} from "../../lib/plans";
import appLogo from "../../assets/favicon/favicon.svg?url";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "BitBabit: Variant Images — Per-variant images for Shopify" },
  {
    name: "description",
    content:
      "Assign unique image galleries to each product variant. Metafield storage, theme app block, and Liquid-ready.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  const docsUrl = new URL("/docs/", url.origin).href;

  return {
    showForm: Boolean(login),
    docsUrl,
    freeMaxImages: FREE_MAX_IMAGES_PER_VARIANT,
    freeMaxProducts: FREE_MAX_PRODUCTS_WITH_IMAGES,
    proPrice: PRO_PLAN_DISPLAY.priceUsd,
    proInterval: PRO_PLAN_DISPLAY.interval,
    proTrialDays: PRO_PLAN_DISPLAY.trialDays,
  };
};

export default function PublicHomePage() {
  const {
    showForm,
    docsUrl,
    freeMaxImages,
    freeMaxProducts,
    proPrice,
    proInterval,
    proTrialDays,
  } = useLoaderData<typeof loader>();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          <img
            src={appLogo}
            alt=""
            width={36}
            height={36}
            className={styles.brandLogo}
          />
          <div>
            <div className={styles.brandTitle}>BitBabit: Variant Images</div>
            <div className={styles.brandSub}>Shopify app</div>
          </div>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a href={docsUrl}>Documentation</a>
          <a href="#pricing">Pricing</a>
          <a className={styles.navCta} href="#login">
            Log in
          </a>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heading}>Different images for every variant</h1>
          <p className={styles.lead}>
            Map Shopify Files and product images to each variant, save to{" "}
            <code>custom.variant_images</code>, and show a hero + thumbnail gallery on your product
            page with the theme app block or custom Liquid.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryBtn} href="#login">
              Log in with shop domain
            </a>
            <a className={styles.secondaryBtn} href={docsUrl}>
              Read the docs
            </a>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="features-heading">
          <h2 id="features-heading" className={styles.sectionTitle}>
            Built for Shopify merchants
          </h2>
          <div className={styles.features}>
            <div className={styles.featureCard}>
              <h3>Per-variant galleries</h3>
              <p>
                Reorder images per variant; the first image is the primary image on the storefront
                when that variant is selected.
              </p>
            </div>
            <div className={styles.featureCard}>
              <h3>Metafields &amp; Files</h3>
              <p>
                Data stays in Shopify. No image binaries stored in the app database — only OAuth
                sessions and usage counters.
              </p>
            </div>
            <div className={styles.featureCard}>
              <h3>Theme app extension</h3>
              <p>
                Add the Variant image gallery block in the theme editor, or integrate with your own
                theme using the same metafield.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="pricing" aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className={styles.sectionTitle}>
            Pricing
          </h2>
          <div className={styles.pricingWrap}>
            <table className={styles.pricingTable}>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Free</th>
                  <th scope="col" className={styles.proCol}>
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Images per variant</td>
                  <td>Up to {freeMaxImages}</td>
                  <td className={styles.proCol}>Unlimited</td>
                </tr>
                <tr>
                  <td>Products with variant images</td>
                  <td>Up to {freeMaxProducts}</td>
                  <td className={styles.proCol}>Unlimited</td>
                </tr>
                <tr>
                  <td>Copy to another product</td>
                  <td>—</td>
                  <td className={styles.proCol}>Included</td>
                </tr>
                <tr>
                  <td>Price</td>
                  <td>$0</td>
                  <td className={styles.proCol}>
                    ${proPrice} USD / {proInterval} ({proTrialDays}-day trial where supported)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Subscriptions are confirmed in the embedded app (<strong>Pricing</strong>) through Shopify
            when your app distribution supports billing.{" "}
            <strong>Merchants:</strong> for daily use, open{" "}
            <strong>Shopify Admin → Apps → BitBabit: Variant Images</strong>.
          </p>
        </section>

        {showForm ? (
          <section className={styles.loginSection} id="login">
            <h2>Install or open the app</h2>
            <p className={styles.loginHint}>
              Enter your <strong>.myshopify.com</strong> domain to sign in with Shopify OAuth. If you
              already use the app, this takes you back to the admin experience.
            </p>
            <Form className={styles.form} method="post" action="/auth/login">
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="shop-domain" className={styles.fieldLabel}>
                    Shop domain
                  </label>
                  <input
                    id="shop-domain"
                    className={styles.input}
                    type="text"
                    name="shop"
                    placeholder="your-store.myshopify.com"
                    autoComplete="on"
                  />
                </div>
                <button className={styles.button} type="submit">
                  Continue
                </button>
              </div>
              <p className={styles.hint}>Example: cool-brand.myshopify.com</p>
            </Form>
          </section>
        ) : (
          <section className={styles.loginSection} id="login">
            <h2>Install or open the app</h2>
            <p className={styles.loginHint}>
              Install this app from the Shopify App Store or your install link, then open it from{" "}
              <strong>Apps</strong> in Shopify Admin.
            </p>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <p>
          BitBabit: Variant Images ·{" "}
          <a href={docsUrl}>Documentation</a>
          {" · "}
          <a href="https://www.shopify.com/partners" target="_blank" rel="noopener noreferrer">
            Shopify Partners
          </a>
        </p>
        <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
          Shopify and related marks are trademarks of Shopify Inc.
        </p>
      </footer>
    </div>
  );
}

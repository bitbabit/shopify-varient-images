import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>BitBabit: Variant Images</h1>
        <p className={styles.text}>
          Assign different images to each product variant and show them on the
          storefront with a theme block — no generic placeholder gallery.
        </p>
        <p className={styles.text} style={{ fontSize: "1rem", paddingBottom: "1rem" }}>
          <strong>Merchants:</strong> open the app from{" "}
          <strong>Shopify Admin → Apps</strong>. This page is only for signing in
          with your shop domain if you were given a direct link.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Variant image lists</strong>. Map Shopify Files or product
            images to each variant; order matters for the primary storefront image.
          </li>
          <li>
            <strong>Metafield storage</strong>. Values live in{" "}
            <code>custom.variant_images</code> on each variant for Liquid and the
            app extension.
          </li>
          <li>
            <strong>Theme integration</strong>. Add the Variant image gallery app
            block in the theme editor, or use your own snippet that reads the same
            metafield.
          </li>
        </ul>
      </div>
    </div>
  );
}

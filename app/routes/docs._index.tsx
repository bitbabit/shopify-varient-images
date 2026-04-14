import { redirect } from "react-router";

/**
 * Vite dev `servePublicMiddleware` only serves exact public files (e.g. `/docs/index.html`).
 * `/docs/` is not in that set, so it falls through to React Router and 404s. Redirect fixes dev;
 * production static serving is unchanged for `/docs/index.html`.
 */
export function loader() {
  throw redirect("/docs/index.html");
}

export default function DocsIndex() {
  return null;
}

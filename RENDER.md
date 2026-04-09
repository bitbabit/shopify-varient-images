# Deploy on Render (free tier) + Neon (free tier Postgres)

This guide targets **[Render](https://render.com/)**’s **free Web Service** and **[Neon](https://neon.tech/)**’s **free serverless Postgres**. Your Shopify app stays a normal Node process (`react-router-serve`); the database holds **OAuth sessions only** — variant images still live in **Shopify metafields** (see [Why PostgreSQL?](#why-postgresql-if-we-use-shopify-metafields) below).

---

## Why PostgreSQL if we use Shopify metafields?

| Stored in **Shopify** (metafields) | Stored in **your Postgres** (this app) |
|-----------------------------------|----------------------------------------|
| `custom.variant_images` per variant — the actual image assignments merchants care about | **Session** rows — OAuth tokens, shop id, etc., so the embedded app stays logged in after install |

The template uses [`@shopify/shopify-app-session-storage-prisma`](https://github.com/Shopify/shopify-app-js/tree/main/packages/apps/session-storage/shopify-app-session-storage-prisma). That **requires** a database for sessions. It does **not** duplicate product/variant image data: that stays in Shopify.

If you removed the DB entirely, you’d need another session strategy (e.g. different storage adapter); the default for this repo is **Prisma + Postgres**.

---

## Prerequisites

- [Render account](https://render.com/) (GitHub login)
- [Neon account](https://neon.tech/) (free tier)
- [Shopify Partners](https://partners.shopify.com/) + CLI (`shopify app config link` already done for this app)

---

## Part A — Neon (Postgres)

1. In [Neon Console](https://console.neon.tech/), **Create project** (pick a region close to you or to Render’s region).
2. Open your project → **Connection details**.
3. Copy the **connection string** for **psql** or **Node.js**. It should look like:  
   `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`
4. Paste it somewhere safe — this becomes **`DATABASE_URL`** on Render.

**Tip:** Use the **direct** connection for a single long‑running Node worker (Render web service). If Neon offers a “pooler” URL and you see connection errors, try the pooler string instead.

---

## Part B — Render Web Service

1. [Render Dashboard](https://dashboard.render.com/) → **New +** → **Web Service**.
2. Connect your **GitHub** repo and select the branch (e.g. `main`).
3. Configure:

   | Field | Suggested value |
   |-------|------------------|
   | **Name** | e.g. `variant-images` |
   | **Region** | Choose one (match Neon region if possible) |
   | **Branch** | `main` (or your deploy branch) |
   | **Root directory** | *(empty — repo root)* |
   | **Runtime** | `Node` |
   | **Build command** | `npm ci && npm run build` |
   | **Start command** | `npx prisma migrate deploy && npm run start` |
   | **Instance type** | **Free** |

4. **Environment** → **Add environment variable**:

   | Key | Value |
   |-----|--------|
   | `DATABASE_URL` | *(paste Neon connection string)* |
   | `SHOPIFY_API_KEY` | Partners → App → **Client ID** |
   | `SHOPIFY_API_SECRET` | Partners → App → **Client secret** |
   | `SHOPIFY_APP_URL` | `https://YOUR-SERVICE.onrender.com` *(after first deploy, set exact URL — no trailing slash)* |
   | `SCOPES` | `read_products,write_products,read_files,write_files` |
   | `NODE_ENV` | `production` |

5. **Create Web Service**. After deploy, Render shows a URL like `https://variant-images.onrender.com`.  
   - If you guessed the URL wrong, **edit** `SHOPIFY_APP_URL` to match exactly and **redeploy** or **Manual Deploy**.

**Free tier note:** Free Render web services **spin down after inactivity** and wake on the next request (cold start ~30–60s). That’s fine for testing; for production merchants, consider a paid instance.

---

## Part C — Point Shopify at Render

1. Set **`SHOPIFY_APP_URL`** = your Render HTTPS URL (exactly).
2. From your laptop, in the repo:

   ```bash
   shopify app deploy
   ```

   When prompted, align **App URL** and **redirect URLs** with `https://YOUR-SERVICE.onrender.com` (and paths your app uses under `/auth`, etc.). Or set them in **Partners → Apps → your app → Configuration**.

3. Install the app on a dev store and complete OAuth.

---

## Part D — `shopify app deploy` (extensions)

Whenever you change `shopify.app.toml` or `extensions/`:

```bash
npm run deploy
```

---

## Local development

Use Neon’s connection string in `.env` as `DATABASE_URL`, **or** local Docker Postgres:

```bash
docker compose up -d
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/variantimg
npx prisma migrate dev
npm run dev
```

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Prisma / SSL errors to Neon | Append `?sslmode=require` if not already in the Neon URL. |
| `migrate deploy` fails on Render | `DATABASE_URL` set on the **Web Service**, DB reachable from internet (Neon is). |
| OAuth redirect errors | `SHOPIFY_APP_URL` equals Render URL; Partners redirect URLs match. |
| App very slow first load | Free Render cold start — normal on free tier. |

---

## References

- [Render: Deploy Node](https://render.com/docs/deploy-node-express-app)  
- [Neon: Connect from Node](https://neon.tech/docs/connect/connect-from-any-app)  
- [Shopify app URLs](https://shopify.dev/docs/apps/tools/cli/configuration)  

---

## Alternative: Railway

See [`RAILWAY.md`](RAILWAY.md) if you prefer Railway’s Postgres plugin instead of Neon.

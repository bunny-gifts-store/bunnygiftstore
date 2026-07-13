# Deployment — Bunny Gift Store (Render API + GitHub Pages frontend)

Architecture:
- **Frontend** (React build) -> **GitHub Pages**, served on `bunnygiftsstore.com`
  (your domain already points to GitHub Pages).
- **Backend** (Node/Express + SQLite) -> **Render**.

The repo is already prepared: `render.yaml` (backend blueprint), the Pages
workflow (`.github/workflows/pages.yml`), and `client/public/CNAME`.

---

## Step 1 — Deploy the backend to Render (free)

One-click:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bunny-gifts-store/bunnygiftstore)

1. Click the button above (or go to <https://render.com>).
2. **Sign up / log in** — easiest is "Sign in with GitHub" (no card needed).
3. Render reads `render.yaml` and shows the `bunnygiftstore-api` service.
4. It asks for one value: **`ADMIN_PASSWORD`** — type a strong admin password
   (you'll use it to log into `/admin`). Everything else is preset.
5. Click **Apply / Deploy** and wait a few minutes for the first build.
6. Copy the service URL at the top, e.g. `https://bunnygiftstore-api.onrender.com`.
7. Verify: open `https://<your-render-url>/api/health` — you should see
   `{"ok":true,...}`.

> Free tier notes: the service **sleeps after ~15 min idle** (first request then
> takes ~50s to wake), and its storage is **ephemeral** (DB + uploads reset on
> restart). Fine for testing. Before taking real orders, upgrade to a paid disk
> — see the commented block in `render.yaml`.

## Step 2 — Point the frontend at the backend

1. In GitHub: repo -> **Settings** -> **Secrets and variables** -> **Actions**
   -> **Variables** tab -> **New repository variable**.
2. Name: `VITE_API_BASE`  ·  Value: your Render URL (no trailing slash), e.g.
   `https://bunnygiftstore-api.onrender.com`.

## Step 3 — Publish the React app to GitHub Pages

1. Repo -> **Settings** -> **Pages** -> **Build and deployment** -> Source =
   **GitHub Actions** (one-time).
2. Repo -> **Actions** -> **Deploy React app to GitHub Pages** -> **Run workflow**
   (on `main`).
3. When it finishes, open <https://bunnygiftsstore.com> — the new app is live.

## Step 4 — Verify

- Storefront loads, login works (enter a mobile number to register).
- Products show; add to cart -> checkout -> QR -> Place the Order succeeds.
- Admin panel at <https://bunnygiftsstore.com/admin> (log in with `admin` /
  your `ADMIN_PASSWORD`). Change the password under Settings.

---

## Notes
- **CORS**: `render.yaml` allows `https://bunnygiftsstore.com` and the `www`
  variant. If you use a different domain, update `CORS_ORIGINS` in the Render
  dashboard.
- **Rollback**: the old static storefront still exists in the repo root; if
  needed, the previous Pages deployment can be restored.
- **Auto-deploy on push (optional)**: the Pages workflow is manual by design.
  To rebuild the frontend automatically on every push to `main`, add
  `push: { branches: [main] }` under `on:` in `.github/workflows/pages.yml`.
- **Custom API subdomain (optional, nicer)**: instead of the `onrender.com` URL,
  you can add a CNAME like `api.bunnygiftsstore.com` -> Render in GoDaddy DNS,
  set it as a custom domain on the Render service, and use that as
  `VITE_API_BASE`.

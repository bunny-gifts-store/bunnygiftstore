# Deployment — Bunny Gift Store (Render API + GitHub Pages frontend)

Architecture:
- **Frontend** (React build) -> **GitHub Pages**, served on `bunnygiftsstore.com`
  (your domain already points to GitHub Pages).
- **Backend** (Node/Express + SQLite) -> **Render**.

The repo is already prepared: `render.yaml` (backend blueprint), the Pages
workflow (`.github/workflows/pages.yml`), and `client/public/CNAME`.

---

## Step 1 — Deploy the backend to Render

1. Go to <https://render.com> and sign up (free) / log in.
2. **New +** -> **Blueprint** -> connect your GitHub and pick
   `bunny-gifts-store/bunnygiftstore`.
3. Render reads `render.yaml` and shows the `bunnygiftstore-api` service.
4. Set the one secret it asks for:
   - `ADMIN_PASSWORD` = a strong admin password of your choice.
   - (`JWT_SECRET` is auto-generated; `CORS_ORIGINS` and DB paths are preset.)
5. **Apply / Create**. Wait for the first deploy to finish (a few minutes).
6. Copy the service URL, e.g. `https://bunnygiftstore-api.onrender.com`.
7. Verify it's live: open `https://<your-render-url>/api/health` — you should
   see `{"ok":true,...}`.

> Persistence: the blueprint mounts a 1 GB disk at `/data` for the SQLite DB +
> uploads. That needs a **paid** Render instance (~$7/mo) but keeps your users
> and orders across restarts. For a free test, remove the `disk:` block (and the
> `DB_PATH`/`UPLOADS_DIR` vars) in `render.yaml` — but data resets on redeploy,
> and free instances sleep after inactivity (first request is slow).

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

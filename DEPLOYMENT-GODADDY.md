# Deployment Guide — Bunny Gift Store (Full-Stack)

The app is now **dynamic**: a React frontend + a Node/Express API + SQLite. That
changes deployment vs. the old static-only site. **Do not deploy until features
are signed off.** Credentials (Git / GoDaddy) are only needed at deploy time.

There are two moving parts:
1. **Frontend** — a static build (`client/dist`). Can live anywhere (GoDaddy
   shared hosting, GitHub Pages, Netlify, or served by the Node server itself).
2. **API + database** — a Node process with a writable SQLite file + `uploads/`
   folder. **This needs a Node-capable host.** Plain GoDaddy shared hosting
   (Apache/PHP) cannot run it.

## Pick the path that matches your GoDaddy plan

### Option A — GoDaddy plan WITH Node (cPanel "Setup Node.js App", or VPS) ✅ simplest
Run everything on GoDaddy as a single Node host.
1. Build the frontend: `cd client && npm run build`.
2. Upload the repo (or at least `server/`, `client/dist`, `images/`) to the host.
3. In cPanel → **Setup Node.js App**: app root = `server/`, startup file =
   `server.js`, run `npm install`, then set env vars:
   `JWT_SECRET`, `ADMIN_PASSWORD`, `CORS_ORIGINS=https://bunnygiftsstore.com`.
4. Start the app. Express serves the storefront, admin panel, API, and uploads
   on one port; map the domain to it.
5. Ensure `server/bunnystore.db` and `server/uploads/` are writable and **outside**
   the public web root so they can't be downloaded.

### Option B — GoDaddy shared hosting (static only) + free Node API host
Keep the domain/frontend on GoDaddy; host the API elsewhere (Render, Railway,
Fly.io all have free tiers).
1. Deploy `server/` to the Node host; note its URL, e.g. `https://bunny-api.onrender.com`.
   Set `JWT_SECRET`, `ADMIN_PASSWORD`, `CORS_ORIGINS=https://bunnygiftsstore.com`.
   Use a persistent disk for `bunnystore.db` + `uploads/` (SQLite needs durable storage).
2. Build the frontend pointing at that API:
   `cd client && VITE_API_BASE=https://bunny-api.onrender.com npm run build`.
3. Upload `client/dist/*` to the GoDaddy web root. Keep the root `.htaccess`
   (forces HTTPS) and a `.htaccess` SPA rewrite so deep links load `index.html`:
   ```apache
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^ index.html [L]
   ```

### Option C — Keep the existing free GitHub Pages static site (interim)
The legacy static storefront (`index.html`, `js/`, `css/`, `pages/`) is still in
the repo and still deploys via `.github/workflows/pages.yml`. It has **no dynamic
admin/login/DB**. Use this only as a stopgap while Option A or B is set up.

## Recommendation
If your GoDaddy plan supports Node (Option A), that's the cleanest — one host,
one deploy, SQLite + uploads local. If it's shared-hosting only, use Option B.
We'll confirm which once you check the plan and share credentials **at deploy time**.

## Security checklist before going live
- [ ] Set a strong `JWT_SECRET` (long random string).
- [ ] Change the admin password from the default (`bunny@admin123`).
- [ ] Set `CORS_ORIGINS` to the real domain(s) only.
- [ ] Serve everything over HTTPS (root `.htaccess` already forces it on Apache).
- [ ] Keep `bunnystore.db` and `uploads/` out of any publicly-listable path.
- [ ] Back up `bunnystore.db` regularly (it holds users + orders).

## Notes
- Custom domain: `CNAME` must contain `bunnygiftsstore.com`.
- The `server/` folder must never be published on a static-only host — only its
  built API belongs on the Node host.

# Bunny Gift Store — Full-Stack Application

A production-ready, dynamic gift storefront with a customer site, mobile-number
login, and a secure admin panel. The original theme/design is preserved
pixel-for-pixel — the storefront was rebuilt in React while reusing the original
`css/style.css` unchanged.

## Tech stack
- **Frontend:** React 18 + Vite + React Router + Bootstrap 5 (existing theme reused)
- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`)
- **Auth:** JWT (customer + admin), bcrypt-hashed admin password

## Project layout
```
client/            React SPA (storefront + admin panel)
  src/
    components/    Navbar, Footer, ProductCard, ProductModal, CartModal, LoginModal, …
    pages/         Home, About, Contact, PhotoFrames, AllGifts, Policy
    admin/         AdminApp, AdminLogin, Dashboard, ProductsAdmin, ProductForm, Categories, Orders, Users, Settings
    context/       Auth, Cart, UI providers
    api.js         Axios API client
    enhancements.css   NEW styles only (theme in /css/style.css stays untouched)
  public/
    css/           Copy of the original theme (style.css)
    images/        Product & decorative images
    legal/         Policy page content (extracted verbatim)

server/            Express API
  src/
    app.js         App wiring, static serving, error handling
    db.js          SQLite schema
    seed.js        Seeds categories + 68 products + default admin
    auth.js        JWT helpers + middleware
    routes/        auth, catalog, orders, admin
  uploads/         Admin-uploaded item images (runtime, gitignored)

index.html, js/, css/, pages/   Legacy static storefront (kept as fallback; superseded by client/)
```

## Running locally (development)

Two terminals:

```bash
# 1) API  (http://localhost:5000)
cd server
npm install
npm run seed        # first time only — creates DB + default admin + products
npm run dev

# 2) Frontend  (http://localhost:5173, proxies /api to :5000)
cd client
npm install
npm run dev
```

- Storefront: http://localhost:5173/
- Admin panel: http://localhost:5173/admin

## Running as a single Node host (production-style)

The Express server can serve the built React app + API on one port:

```bash
cd client && npm install && npm run build   # outputs client/dist
cd ../server && npm install && npm start     # serves API + client/dist on :5000
```

Open http://localhost:5000/ (storefront) and http://localhost:5000/admin.

## Default admin credentials
- Username: `admin`
- Password: `bunny@admin123`  ← **change it** after first login (Admin → Settings),
  or set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `server/.env` before first seed.

## Authentication model
- **Customer (no OTP):** enters mobile number. If new, also enters a name → account
  created and logged in. Returning users enter only the mobile number.
- **Admin:** username + password (bcrypt), JWT with a 12h expiry.

## Product status
- **Out of Stock:** product still shown but cannot be added to cart.
- **Unavailable:** product hidden from the storefront entirely.
- Both toggles apply instantly (admin Products table) and reflect on the customer site.

## Payment
Unchanged — static PhonePe QR (`images/payment-qr.png`) + transaction-ID capture,
then the order is saved to the DB and an order email is opened to the store owner.

## Environment variables (`server/.env`, see `.env.example`)
`PORT`, `JWT_SECRET` (set a strong secret in prod), `ADMIN_USERNAME`,
`ADMIN_PASSWORD`, `CORS_ORIGINS`, `DB_PATH`, `UPLOADS_DIR`.

## Login speed (and why it used to hang)

Slow or stuck logins on the live site have two distinct causes. Both are fixed;
this section exists so the fix isn't accidentally undone.

**1. The free instance sleeps.** Render's free tier spins the API down after
~15 minutes with no traffic, and the next request has to boot a container from
cold — 50s+. That request is usually someone pressing *Login*, so the button sits
on "Signing in…". The fix is `.github/workflows/keepalive.yml`, which pings
`/api/ping` every 10 minutes so the idle timer never expires. **If logins get
slow again, check that workflow first** — GitHub disables scheduled workflows in
repos with no activity for 60 days, which silently brings the problem back.

**2. Boot could block forever.** The schema and its migrations used to run at
*module import time*, i.e. before `app.listen()`. Against Turso every one of
those statements is a network round trip on a synchronous driver, so a slow or
unreachable primary meant the HTTP port never opened at all: the health check got
no response, the API answered nothing, and there was no error anywhere to
diagnose. Now `server.js` opens the port first and calls `initSchema()`
afterwards (via `libsql/promise`, so it can't block the event loop), retrying
with a backoff if the database is down.

The rules that keep this working:

- **Nothing that touches the database may run at import time.** No top-level
  `db.prepare(...)`, no schema work, no pragmas against a remote primary. Prepare
  statements lazily instead (see `activity.js`).
- **`/api/health` and `/api/ping` must never query the database.** A health check
  that needs the database reports "down" during a database outage — exactly when
  you need it to answer. `/api/health` reports the database's state as *data*
  (`db.ready`, `db.error`) instead.
- **Data routes are gated on `dbStatus.ready`** and return a fast `503` when the
  schema isn't up, rather than blocking on a driver call that may never return.

## Surviving a database outage

The store depends on two free services chained together — Render for the API and
Turso for the database — so it stays up only while both do. On 5 Aug 2026 Turso
returned `502 upstream forward failed` for hours and took the whole storefront
down with it.

The API now degrades instead of dying:

| | Database up | Database unreachable |
|---|---|---|
| Browse catalogue | live | **works** — served from the last saved snapshot, flagged `X-Catalog-Stale: true` |
| Login / register | works | fast `503` with an honest message |
| Place an order | works | fast `503` |
| `/api/health`, `/api/ping` | works | works |

**Every successful catalogue read is saved** to `server/cache/catalog.json`
(`catalogCache.js`), and reloaded at boot *before* the database is tried. So a
customer can still browse products during an outage, and the storefront is never
blank.

What it deliberately does **not** do: cache anything a customer could act on
incorrectly. Orders and logins fail outright when the database is down, because
accepting an order that cannot be stored — or authenticating against a stale
copy of credentials — is far worse than an honest error. Degraded mode makes the
store *browsable*, not operational, and [CategorizedCatalog.jsx](client/src/components/CategorizedCatalog.jsx)
tells the shopper exactly that rather than letting them reach checkout first.

The snapshot lives on the same ephemeral disk as everything else, so it survives
a process restart but not a redeploy. The first successful read refills it.

### Diagnosing Turso

```bash
cd server
# put the Render service's two Turso values in server/.env.turso
#   (NOT .env — .env.turso is gitignored and is not loaded by the app,
#    so this cannot disturb local development)
npm run turso:check
```

It makes one real connection and classifies the result — reachable, `502`
unreachable, `401` token rejected, or `404` database gone — so the next action is
unambiguous. It never prints the auth token.

### Diagnosing a slow or failed login

```bash
curl https://bunnygiftstore-api.onrender.com/api/health
```

| What you see | What it means |
|---|---|
| Fast JSON, `db.ready: true` | API is healthy — the problem is elsewhere (client, credentials). |
| Slow (30s+) then JSON | The instance was asleep. Check the keep-alive workflow is enabled. |
| JSON with `db.ready: false` + `db.error` | API is up, the **database** is unreachable. `db.error` names the cause (bad token, host not found, DB deleted/suspended). Check `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` in Render, and that the Turso database still exists. |
| No response at all | The service itself is not running — check the Render dashboard (deploy failed, suspended, or free instance-hours exhausted). |

### Which database am I looking at?

There are **two separate databases**, and this trips people up:

| | Local development | Live site (bunnygiftsstore.com) |
|---|---|---|
| Database | `server/bunnystore.db` (file on your PC) | Turso, hosted remotely |
| Written by | your local `npm run dev` | the Render API |
| Contains | only what you create locally | real customers, real orders |

**Customers who register on the live site are never written to
`server/bunnystore.db`.** Opening that file in DB Browser shows your local test
data only — that is expected, not a bug. Confirm which mode any instance is in
via `/api/health` → `persistence.mode` (`local-sqlite-file` vs `turso-remote`).

To see live **customers** without leaving the browser, log into the admin panel
on the live site and open **Customers** (`/admin/users`) — it lists every
registered customer with their registration date, order count and total spent.

To browse the **whole** live database (orders, products, audit trail) in a SQLite
tool, pull a snapshot of it into a local file:

```bash
cd server
# one-time: put the Render service's two Turso values in server/.env
#   TURSO_DATABASE_URL=libsql://…turso.io
#   TURSO_AUTH_TOKEN=…
npm run db:pull            # -> server/live-snapshot.db
```

Open `server/live-snapshot.db` in DB Browser for SQLite to see every registered
user, order and product from the live site. It is a read-only copy: the script
only SELECTs from production, and editing the snapshot does not affect the live
site. Re-run it any time for a fresh pull (it also doubles as a backup — keep
dated copies). `*.db` is gitignored, so snapshots of real customer data can't be
committed by accident.

### Inspecting the database (local development)

Everything the app does — registered users, products, categories, frame size
options, orders and their full lifecycle, refunds, and every admin operation —
is written to `server/bunnystore.db` and nothing is kept only in server memory.

The API runs SQLite in WAL mode, where committed writes normally sit in a
`bunnystore.db-wal` sidecar until SQLite decides to checkpoint. That would leave
the `.db` file itself lagging behind the running app, so the server folds the log
into the main file after **every** request that changes data (`persist()` in
`src/db.js`, wired centrally in `src/app.js`). The result: `bunnystore.db` is
always a complete, self-contained snapshot you can open, copy or edit at any
moment — including with tools that ignore the `-wal` sidecar.

Verify it at any time:

```bash
cd server
npm run db:check
```

It copies the `.db` file **without** its sidecars — exactly what an external tool
or a backup sees — and compares every table's row count and a content hash
against the live database, then runs an integrity check.

Editing the file directly (while the server runs) works too; the API picks the
change up on its next query.

**Admin audit trail.** Every admin operation is recorded in the `admin_activity`
table (`action`, `entity`, `entityId`, a JSON `details` diff, and who did it).
It's also where a **deleted** product or category survives — the row is gone from
`products`, but its full contents remain in `details`. Readable via
`GET /api/admin/activity` or straight from the table.

**Not in the database, by design:** the shopping cart (browser `localStorage`
until checkout, then snapshotted into `orders.items`) and auth tokens
(`sessionStorage` / `localStorage`).

### Data persistence (production) — Turso
Locally the API uses a plain SQLite file (`server/bunnystore.db`). In production
on an ephemeral host (e.g. Render free tier) that file is wiped on every
restart, which would erase registered users and orders overnight. To persist
data, the API uses **Turso** (a hosted, SQLite-compatible libSQL database) via a
local **embedded replica** — set these two env vars and it switches on
automatically (no code change, reads stay fast & synchronous):

```
TURSO_DATABASE_URL=libsql://<your-db>-<org>.turso.io
TURSO_AUTH_TOKEN=<token>
# optional: TURSO_SYNC_INTERVAL=60   (seconds between background pulls)
```

One-time setup:
```bash
turso auth signup
turso db create bunnygiftstore
turso db show bunnygiftstore --url      # -> TURSO_DATABASE_URL
turso db tokens create bunnygiftstore   # -> TURSO_AUTH_TOKEN
```
The first boot creates the schema and seeds products into Turso; later boots
re-sync from it. Uploaded product images (`server/uploads`) are **not** covered
by this and still need durable storage (paid disk or an object store) to survive
restarts.

For a split deployment (static frontend on one host, API on another), build the
frontend with `VITE_API_BASE=https://your-api-host` so the SPA calls the right API.

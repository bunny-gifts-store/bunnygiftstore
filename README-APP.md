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

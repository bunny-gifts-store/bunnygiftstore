# Bunny Gift Store — Full-Stack Application

A production-ready, dynamic gift storefront with a customer site, mobile-number
login, and a secure admin panel. The original theme/design is preserved
pixel-for-pixel — the storefront was rebuilt in React while reusing the original
`css/style.css` unchanged.

## Tech stack
- **Frontend:** React 18 + Vite + React Router + Bootstrap 5 (existing theme reused)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (via `pg`)
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
    db.js          Postgres pool, schema + migrations, outage recovery
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
*module import time*, i.e. before `app.listen()`. Every one of those statements
is a network round trip to the database, so a slow or unreachable database meant
the HTTP port never opened at all: the health check got no response, the API
answered nothing, and there was no error anywhere to diagnose. Now `server.js`
opens the port first and calls `initSchema()` afterwards, retrying with a backoff
if the database is down.

The rules that keep this working:

- **Nothing that touches the database may run at import time.** No top-level
  queries, no schema work. Build statements lazily instead (see `activity.js`).
- **`/api/health` and `/api/ping` must never query the database.** A health check
  that needs the database reports "down" during a database outage — exactly when
  you need it to answer. `/api/health` reports the database's state as *data*
  (`db.ready`, `db.error`) instead.
- **Data routes are gated on `dbStatus.ready`** and return a fast `503` when the
  schema isn't up, rather than piling up connection attempts that exhaust the
  pool and stop the API answering anything at all.

## Surviving a database outage

The store depends on two services chained together — Render for the API and a
managed Postgres for the database — so it stays up only while both do. On
5 Aug 2026 the database provider was unreachable for hours and took the whole
storefront down with it.

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

**If there is no snapshot either**, the catalogue falls back to the built-in one
in `seed.js` — the same data a fresh database is seeded with. This covers the
case the snapshot cannot: a container that has NEVER reached the database, which
is exactly what happens when a deploy lands during an outage. A real snapshot
always wins, because it includes whatever the admin has changed since.
`/api/health` reports which is in use via `catalogCache.source`
(`snapshot` | `bundled`).

What it deliberately does **not** do: cache anything a customer could act on
incorrectly. Orders and logins fail outright when the database is down, because
accepting an order that cannot be stored — or authenticating against a stale
copy of credentials — is far worse than an honest error. Degraded mode makes the
store *browsable*, not operational, and [CategorizedCatalog.jsx](client/src/components/CategorizedCatalog.jsx)
tells the shopper exactly that rather than letting them reach checkout first.

The snapshot lives on the same ephemeral disk as everything else, so it survives
a process restart but not a redeploy. The first successful read refills it.

### Diagnosing the database

`/api/health` answers this without any tooling — it never touches the database,
so it keeps answering during an outage and reports the state as data:

```bash
curl https://<your-api>/api/health
```

- `db.ready: true` — everything is fine.
- `db.ready: false` with `db.error` — the API is up, the database is not. The
  error names the cause (host unreachable, authentication failed, database does
  not exist). `db.attempts` shows how many times recovery has retried.
- `persistence.durable: false` — `DATABASE_URL` is not set at all.

### Migrating off the old SQLite/Turso database (one time)

The catalogue the app seeds is the *built-in* one. It does **not** include
anything the admin added, and it re-creates anything the admin deleted — so a
fresh Postgres is not a substitute for migrating the real data (registered
customers, their orders, admin-added products and categories).

`npm run migrate` does the whole thing: reads the old database, loads it into the
Postgres `DATABASE_URL` points at, then verifies the row counts and referential
integrity match.

```bash
cd server

# Freshest data — straight from the live Turso database.
# Credentials: Render -> bunnygiftstore-api -> Environment.
npm install --no-save libsql
TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… \
  DATABASE_URL=postgresql://… npm run migrate

# …or from a local snapshot file, if Turso is unreachable:
DATABASE_URL=postgresql://… npm run migrate -- --file live-snapshot.db

# See exactly what would happen, change nothing:
DATABASE_URL=postgresql://… npm run migrate -- --dry-run
```

**Migrate BEFORE the API's first boot against the new database.** The seed only
runs when the products table is empty, so migrating first makes it skip and
leaves the data exactly as it was. Boot first and the seed re-creates every
built-in product — including ones deliberately deleted — and a restore cannot
remove them again. `migrate` **refuses to run** on a database that already has
products for this reason; if you hit that, reset the database and re-run:

```sql
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
```

Ids are preserved, so orders stay attached to the right customers; password
hashes are copied verbatim, so **existing customers log in with their existing
passwords**, and the admin keeps the password they set rather than reverting to
the default.

Once the migration is verified, delete `src/db-import.js` and `src/migrate.js` —
they are the last things in the repo that know about the old database.

### Taking a backup

```bash
cd server
# DATABASE_URL in server/.env (gitignored), or set it for the one run
npm run db:pull                 # -> server/live-snapshot.json
```

Read-only against production: it only issues `SELECT`s. The output is plain JSON
so it stays readable without any tooling, and it holds real customer data
(including password hashes) — it is gitignored and must never be committed.

### Rebuilding the database after a total loss

If the database has to be recreated (a provider failure that never comes back, an
accidental delete), the app rebuilds most of it and one script does the rest.

1. Create a new Postgres database with your provider (Neon / Supabase / Render).
   **It must use UTF-8 encoding** — every managed provider defaults to this. On a
   non-UTF-8 database the `₹` in the photo-frame price labels cannot be stored
   and those 27 products are dropped from the catalogue.
2. Update `DATABASE_URL` in the Render service's Environment tab and save.
   Render restarts automatically.
3. On boot the API creates the whole schema and seeds the 68 built-in products,
   12 categories and a default admin. **That part is automatic.**
4. Restore everything created since — registered customers, their orders,
   admin-added products/categories, and the admin's real password:

```bash
cd server
npm run db:restore -- --dry-run     # report first, change nothing
npm run db:restore
```

The source is `server/live-snapshot.json` by default (`--source` to override).
The target is whatever `DATABASE_URL` points at, so pointing it at a scratch
database is how to rehearse the whole thing safely.

Safe to re-run: every insert is `ON CONFLICT DO NOTHING`, and original ids are
preserved so foreign keys still line up (the id sequences are fast-forwarded
afterwards, so later inserts don't collide with restored rows). The one
deliberate exception is the admin password hash, which is copied over explicitly
— the seed has already inserted a row with that username, so a skipped insert
would otherwise leave the owner locked out with the default password.

**Keep the snapshot fresh** — `npm run db:pull` regenerates it, and it is the
only thing standing between an outage and losing your customers. `*.db` is
gitignored, so real customer data can't be committed by accident.

### Diagnosing a slow or failed login

```bash
curl https://bunnygiftstore-api.onrender.com/api/health
```

| What you see | What it means |
|---|---|
| Fast JSON, `db.ready: true` | API is healthy — the problem is elsewhere (client, credentials). |
| Slow (30s+) then JSON | The instance was asleep. Check the keep-alive workflow is enabled. |
| JSON with `db.ready: false` + `db.error` | API is up, the **database** is unreachable. `db.error` names the cause (host not found, authentication failed, database deleted/suspended). Check `DATABASE_URL` in Render, and that the database still exists with your provider. |
| No response at all | The service itself is not running — check the Render dashboard (deploy failed, suspended, or free instance-hours exhausted). |

### Which database am I looking at?

There are **two separate databases**, and this trips people up:

| | Local development | Live site (bunnygiftsstore.com) |
|---|---|---|
| Database | whatever your local `DATABASE_URL` points at | the production Postgres |
| Written by | your local `npm run dev` | the Render API |
| Contains | only what you create locally | real customers, real orders |

**Customers who register on the live site are never written to your local
database**, and vice versa — that is expected, not a bug. Point `DATABASE_URL` at
a database of your own for development; never at production.

To see live **customers** without leaving the browser, log into the admin panel
on the live site and open **Customers** (`/admin/users`) — it lists every
registered customer with their registration date, order count and total spent.

To inspect the **whole** live database (orders, products, audit trail), pull a
snapshot of it into a local file:

```bash
cd server
# one-time: put the production connection string in server/.env
#   DATABASE_URL=postgresql://user:password@host/database
npm run db:pull            # -> server/live-snapshot.json
```

That JSON holds every registered user, order and product from the live site. It
is a read-only copy: the script only SELECTs from production, and editing the
snapshot does not affect the live site. Re-run it any time for a fresh pull (it
also doubles as a backup — keep dated copies). `live-snapshot.json` is
gitignored, so snapshots of real customer data can't be committed by accident.

### Inspecting the database (local development)

Everything the app does — registered users, products, categories, frame size
options, orders and their full lifecycle, refunds, and every admin operation —
is written to Postgres and nothing is kept only in server memory. Point `psql`
(or any Postgres GUI) at the same `DATABASE_URL` to read or edit it directly; the
API picks up a change on its next query.

```bash
psql "$DATABASE_URL" -c 'SELECT id, code, name, price FROM products ORDER BY id LIMIT 10'
```

Note that the schema uses **quoted camelCase** column names (`"passwordHash"`,
`"categoryId"`, `"createdAt"`), because that is what the API returns to the
client. Postgres folds unquoted identifiers to lower case, so hand-written
queries need the double quotes:

```sql
SELECT id, "totalAmount", "createdAt" FROM orders WHERE "userId" = 1;
```

**Admin audit trail.** Every admin operation is recorded in the `admin_activity`
table (`action`, `entity`, `entityId`, a JSON `details` diff, and who did it).
It's also where a **deleted** product or category survives — the row is gone from
`products`, but its full contents remain in `details`. Readable via
`GET /api/admin/activity` or straight from the table.

**Not in the database, by design:** the shopping cart (browser `localStorage`
until checkout, then snapshotted into `orders.items`) and auth tokens
(`sessionStorage` / `localStorage`).

### Data persistence — PostgreSQL

The API stores everything in **PostgreSQL**, configured with a single env var:

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>
```

This is required. On an ephemeral host (e.g. Render's free tier) anything written
inside the container is wiped on every restart, so the database has to live
outside it or registered users and orders disappear overnight. The server
**refuses to start** in production without `DATABASE_URL`, so a misconfigured
deploy fails loudly at boot rather than quietly losing orders. Set
`ALLOW_NO_DATABASE=1` to override that deliberately (a demo serving only the
bundled catalogue).

Free managed options — any of them works:

| Provider | Where to find the string |
|---|---|
| [Neon](https://neon.tech) | Dashboard → Connection string |
| [Supabase](https://supabase.com) | Project Settings → Database → URI |
| [Render](https://render.com) | New + → Postgres → Internal Database URL |

The database **must use UTF-8 encoding** (every managed provider defaults to it).
On a non-UTF-8 database the `₹` in the photo-frame price labels cannot be stored,
and those 27 products are silently dropped from the catalogue — `/api/health` →
`seed.failedInserts` is what surfaces that.

The first boot creates the schema and seeds the catalogue; later boots find the
data already there. Uploaded product images (`server/uploads`) are **not** covered
by this and still need durable storage — set `CLOUDINARY_URL`, or use an object
store — to survive restarts.

Other database env vars, all optional:

| Var | Effect |
|---|---|
| `PGSSLMODE=disable` | Turn off TLS (a local Postgres). Remote hosts get TLS automatically. |
| `PGPOOL_MAX` | Connection pool size (default 5 — free tiers cap connections hard). |
| `ALLOW_NO_DATABASE=1` | Allow production boot with no `DATABASE_URL`. |
| `PG_HTTP=1` | Talk to Neon over HTTPS instead of TCP — see below. |

#### If your network blocks port 5432

Many corporate networks allow HTTPS but block the Postgres port outright, which
stops `migrate`, `db:pull` and `db:restore` from reaching a hosted database from
a work machine (the symptom is `Connection terminated due to connection
timeout`, while `https://` to the same host works fine).

Neon can serve SQL over port 443. Install its driver once and set `PG_HTTP=1`:

```bash
npm install --no-save @neondatabase/serverless
PG_HTTP=1 npm run db:pull
```

This is for the **local scripts only**. The deployed API uses plain TCP, which
hosting providers do not block — do not set `PG_HTTP` on Render.

**Local development** needs a Postgres too. Either point `DATABASE_URL` at a free
hosted database of your own, or run one locally:

```bash
docker run -d --name bunnypg -p 5432:5432 \
  -e POSTGRES_PASSWORD=bunny -e POSTGRES_DB=bunnystore postgres:16
# server/.env
DATABASE_URL=postgresql://postgres:bunny@localhost:5432/bunnystore
PGSSLMODE=disable
```

For a split deployment (static frontend on one host, API on another), build the
frontend with `VITE_API_BASE=https://your-api-host` so the SPA calls the right API.

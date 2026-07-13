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
    admin/         AdminApp, AdminLogin, Dashboard, ProductsAdmin, ProductForm, Categories, Orders, Settings
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

For a split deployment (static frontend on one host, API on another), build the
frontend with `VITE_API_BASE=https://your-api-host` so the SPA calls the right API.

# Progressive Web App — Bunny Gift Store

The React client (Vite 5 + React 18) is now an installable, offline-capable PWA.
Everything is additive: no existing component, route, style, API call or business
rule was changed. **No new npm packages were added.**

---

## 1. Files created

| File | Purpose |
| --- | --- |
| `client/public/manifest.webmanifest` | Web app manifest (name, icons, display, theme). |
| `client/public/sw.js` | Service worker — caching strategies, offline fallback, update handling. |
| `client/public/offline.html` | Self-contained offline fallback page (no CDN/font dependencies). |
| `client/public/images/pwa-icon-192.png` | 192×192 "any" icon. |
| `client/public/images/pwa-icon-512.png` | 512×512 "any" icon. |
| `client/public/images/pwa-maskable-192.png` | 192×192 maskable icon (80% safe zone, white background). |
| `client/public/images/pwa-maskable-512.png` | 512×512 maskable icon. |
| `client/public/images/apple-touch-icon.png` | 180×180 iOS home-screen icon (opaque). |
| `client/src/pwa/installPrompt.js` | Module-scope store that captures `beforeinstallprompt` / `appinstalled`. |
| `client/src/pwa/usePwaInstall.js` | React hook exposing `canInstall`, `installed`, `install()`. |
| `client/src/pwa/registerServiceWorker.js` | Registration, update detection, `applyUpdate()`. |
| `client/src/pwa/pwa.css` | Styles for the PWA UI only (no existing selector is touched). |
| `client/src/components/InstallAppButton.jsx` | "Install App" button (`nav` and `block` variants). |
| `client/src/components/InstallGuideModal.jsx` | Add-to-Home-Screen steps for iOS/iPadOS. |
| `client/src/components/PwaUpdatePrompt.jsx` | Registers the SW; shows the "new version available" toast. |
| `client/src/components/OfflineNotice.jsx` | Fixed banner shown only while the device is offline. |

### Icons
All icons were generated from the site's existing favicon (`client/public/images/favicon.png`,
48×48) using Catmull-Rom upscaling, so the installed app shows the same BGS logo
as the browser tab. **Because the source is 48×48, the 512×512 icon is slightly
soft.** Replace the five generated PNGs with exports from the original vector /
high-resolution logo when they are available — no code changes are needed, the
filenames stay the same.

## 2. Files modified

| File | Change |
| --- | --- |
| `client/index.html` | Added manifest link, `theme-color`, apple-touch-icon, iOS/Windows meta tags, page description. Nothing removed. |
| `client/src/main.jsx` | Imports `pwa.css` and `pwa/installPrompt.js` (side effect: capture the install event before React mounts). |
| `client/src/App.jsx` | Mounts `<OfflineNotice />` and `<PwaUpdatePrompt />`; `AdminApp` is now `React.lazy` + `<Suspense>` (code splitting). |
| `client/src/components/Navbar.jsx` | Adds the Install App nav item, rendered only when the app is installable. |
| `client/src/components/UserLoginScreen.jsx` | Adds the block-variant install button under the login form (the storefront is gated behind this screen). |
| `client/vite.config.js` | Adds the `stamp-service-worker` build plugin (replaces `__SW_BUILD__` in `dist/sw.js`). |
| `client/public/.htaccess` | `.webmanifest` MIME type, `Service-Worker-Allowed`, per-path cache policy, gzip. SPA + HTTPS rules unchanged. |
| `client/package.json` | Adds `"preview": "vite preview"`. **No dependency changes.** |

---

## 3. Caching strategy

| Request | Strategy | Cache |
| --- | --- | --- |
| Page navigations | Network first → cached shell → `offline.html` | `bgs-shell-<build>` |
| `/assets/*` (Vite content-hashed JS/CSS) | Cache first | `bgs-assets-v1` |
| `/images/*`, `/uploads/*` and any image URL | Cache first (capped at 150 entries) | `bgs-images-v1` |
| `/css/style.css`, `/legal/*.html`, fonts, manifest | Stale-while-revalidate | `bgs-shell-<build>` |
| Bootstrap CDN + Google Fonts | Stale-while-revalidate (capped at 80) | `bgs-cdn-v1` |
| **`/api/*` (any origin)** | **Never intercepted, never cached** | — |
| Anything else | Passed straight through | — |

Only `GET` over `http(s)` is ever intercepted. Non-GET requests (login, register,
checkout, admin writes, uploads) go directly to the network exactly as before.

**Known trade-off:** product images are cache-first, so an image replaced *at the
same URL* keeps showing the old file until the image cache rotates. Uploading a
new file (a new URL) always shows immediately.

## 4. Automatic updates

1. Every `npm run build` stamps a fresh timestamp into `dist/sw.js`, so each
   deployment ships a byte-different worker.
2. The page checks for a new worker on load, on tab refocus, and hourly.
3. When one installs, the toast "A new version of the store is available" appears.
4. **Refresh** posts `SKIP_WAITING` to the waiting worker and reloads once it takes
   control. A stale shell can never survive a release, because the shell cache is
   named after the build.

The very first install never shows the toast — that is a cache fill, not an update.

---

## 5. Commands

```bash
# Install (unchanged — no new packages)
cd client
npm install

# Development (service worker is deliberately NOT registered here)
npm run dev

# Production build
npm run build
# …or with an explicit API URL
VITE_API_BASE=https://bunnygiftstore-api.onrender.com npm run build

# Serve the production build locally to test the PWA
npm run preview        # http://localhost:4173
```

The service worker is registered **only in production builds** (`import.meta.env.PROD`),
so it can never fight Vite's HMR during development. Use `npm run preview` to test it.

---

## 6. Deployment (GoDaddy, unchanged process)

1. `cd client && npm run build`
2. Upload the **entire contents** of `client/dist/` to the GoDaddy web root,
   including the hidden `.htaccess`, plus these new files:
   `sw.js`, `manifest.webmanifest`, `offline.html`, `images/pwa-*.png`,
   `images/apple-touch-icon.png`.
3. `sw.js` must be served from the **site root** (`https://bunnygiftsstore.com/sw.js`)
   — a worker cannot control paths above its own location.
4. HTTPS is already forced by `.htaccess`; service workers require it.
5. No server, Node, or hosting-plan change is needed.

> If your host ignores `.htaccess` MIME rules and serves `.webmanifest` as
> `text/plain`, the manifest is rejected. Verify with step 8.3 below.

---

## 7. Verification checklist

Run in Chrome or Edge against the deployed HTTPS site (or `npm run preview`).

### 7.1 Service worker
1. DevTools → **Application → Service Workers**.
2. `sw.js` is listed, source `/sw.js`, status **activated and is running**.
3. Tick **Update on reload** while developing; untick it to test the update toast.

### 7.2 Manifest & installability
1. DevTools → **Application → Manifest**.
2. Name, short name, `standalone`, start URL `/`, portrait, theme `#1a1a2e`,
   background `#ffffff` are all shown, with four icons and no errors.
3. An install icon appears in the address bar and the **Install App** button
   appears in the header.

### 7.3 Caching
1. DevTools → **Application → Cache Storage**.
2. After one visit you should see `bgs-shell-<timestamp>`, `bgs-assets-v1`,
   `bgs-images-v1` and `bgs-cdn-v1`.
3. Network tab: `/api/...` requests must **never** show "(ServiceWorker)" as the
   size — API data always comes from the network.

### 7.4 Offline mode
1. Load the site normally and browse a couple of pages.
2. DevTools → **Network → Offline** (or turn off Wi-Fi).
3. Reload — the storefront still renders from cache and the red
   "You're offline" banner appears at the top.
4. Open a brand-new tab to a never-visited URL while offline → the themed
   `offline.html` page appears with a **Try again** button; it reloads itself
   automatically once the connection returns.

### 7.5 Update flow
1. Deploy (or rebuild and re-`preview`) so `sw.js` gets a new timestamp.
2. Reload an open tab → the new worker installs in the background and the toast
   appears. Click **Refresh** → the page reloads on the new version.

### 7.6 Lighthouse
DevTools → **Lighthouse** → Mobile → Performance + Best Practices + SEO
(+ "Progressive Web App" where the Lighthouse version still offers it).
Run it against the **production build**, not the dev server.

---

## 8. Installing on each platform

### Android (Chrome / Edge / Samsung Internet)
1. Open `https://bunnygiftsstore.com`.
2. Tap **Install App** in the header (or ⋮ → *Install app* / *Add to Home screen*).
3. Confirm in the native dialog. The BGS icon appears in the app drawer.
4. Launch it — it opens full screen with no browser chrome, and the
   **Install App** button is gone.

### Desktop (Windows / macOS — Chrome or Edge)
1. Open the site.
2. Click **Install App** in the header, or the install icon (⊕/monitor) at the
   right of the address bar.
3. Confirm. The app is added to the Start Menu / Applications and opens in its
   own window.
4. Uninstall from the app's ⋮ menu → *Uninstall Bunny Gift Store*.

### iPhone / iPad (Safari, iOS 16.4+)
iOS never fires `beforeinstallprompt`, so the button opens step-by-step
instructions instead of a native dialog:
1. Tap **Install App** → follow the three steps shown.
2. Share → **Add to Home Screen** → **Add**.
3. Launch from the home screen — it opens standalone using
   `apple-touch-icon.png`.

### Browsers with no install support (e.g. desktop Firefox)
No button is rendered at all — the site behaves exactly as it does today, with
offline caching still active.

---

## 9. Performance notes

- The admin panel is now a separate chunk (~45 kB) that shoppers never download.
- Repeat visits serve JS/CSS/images from Cache Storage — no network round trips.
- Navigation preload is enabled, so the worker's start-up cost is off the
  critical path.
- `.htaccess` sets `immutable` one-year caching for `/assets/*` only (those
  filenames are content-hashed) and a 7-day cache for `/images` and `/css`, so a
  redeploy is always picked up.
- `index.html`, `sw.js`, `manifest.webmanifest` and `offline.html` are
  `no-store` — this is what makes new deployments visible immediately.

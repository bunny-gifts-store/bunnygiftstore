# GoDaddy Deployment Guide

This project is a static storefront for the public site.

## What to deploy
1. Upload the static site files to your web root: `index.html`, `css/`, `js/`, `images/`, `pages/`, and `CNAME` if you are using a custom domain through GitHub Pages.
2. Do not upload the `server/` folder unless you are intentionally hosting the Node API on a separate Node-capable environment.
3. If you use a custom domain, make sure it is `bunnygiftsstore.com`.
4. Keep the root `.htaccess` file in place so HTTP requests are redirected to HTTPS.

## Recommended hosting type
Use GoDaddy shared hosting for the static storefront, or use GoDaddy DNS to point the domain at a static host such as GitHub Pages.

## Steps
1. Confirm the domain in DNS is `bunnygiftsstore.com`.
2. Upload the static files to the site root.
3. If deploying through GitHub Pages, keep the `CNAME` file in the published output.
4. Open the domain and verify the storefront loads.

## Notes
- The root `CNAME` file must contain `bunnygiftsstore.com` exactly.
- The root `.htaccess` forces HTTPS on Apache-based hosting.
- If a security gateway such as Netskope blocks the domain, the site itself may still be deployed correctly and will need allowlisting on that network.

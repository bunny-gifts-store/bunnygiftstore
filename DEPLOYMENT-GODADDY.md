# GoDaddy Deployment Guide

This project now has:
- a static storefront (existing HTML/CSS/Bootstrap UI)
- a SQLite-backed API for real-time order storage
- a React/Vite frontend layer for future dynamic features

## What to deploy
1. Upload the full project root to your GoDaddy hosting account.
2. Run the backend from the `server/` folder with Node.js.
3. Point the frontend to the backend using `window.BUNNY_API_BASE`.

## Recommended hosting type
Use a GoDaddy plan that supports Node.js (Plesk or VPS). Shared hosting may not support native modules such as `better-sqlite3`.

## Steps
1. In GoDaddy, open your hosting plan and access the Node.js / Plesk terminal.
2. Upload the project files to the app root.
3. In the terminal, run:
   cd server
   npm install
   npm start
4. Keep the backend running on port 5000 (or the hosting platform's assigned port).
5. Set the frontend API base URL in your deployed page:
   window.BUNNY_API_BASE = 'https://YOUR-BACKEND-URL';
6. Open your domain to confirm the storefront loads.

## Notes
- The current UI was preserved.
- Order submission is now saved in SQLite via the `/api/orders` endpoint.
- If your GoDaddy plan does not support Node.js, the backend must be hosted elsewhere (for example, Render, Railway, or a VPS), and the domain can still point to the static site.

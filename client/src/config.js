// API base URL.
//   - VITE_API_BASE (build-time env) wins when set.
//   - In dev (vite serve) fall back to '' so the localhost proxy in
//     vite.config.js handles /api and /uploads.
//   - In a production build fall back to the live Render API. The GoDaddy
//     site is static-only, so an empty base would post to bunnygiftsstore.com
//     (no backend) and every login fails with a Network Error.
const PROD_API_BASE = 'https://bunnygiftstore-api.onrender.com';
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD ? PROD_API_BASE : '');

export const OWNER_EMAIL = 'brscustomgifts@gmail.com';
// Store WhatsApp — display form + international digits for wa.me links.
export const STORE_WHATSAPP = '+91-9701-756-904';
export const STORE_WHATSAPP_INTL = '919701756904';

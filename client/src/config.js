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

// A UPI / bank UTR (Unique Transaction Reference) is a 12-digit number — what
// customers read off their PhonePe receipt and what the admin records for a
// refund. Shared by the checkout transaction-ID field and the refund UTR field.
export const UTR_REGEX = /^\d{12}$/;
export const UTR_HELP = 'Enter the 12-digit UTR (Unique Transaction Reference) number.';
export const isValidUtr = (value) => UTR_REGEX.test(String(value || '').trim());
// Store WhatsApp — display form + international digits for wa.me links.
export const STORE_WHATSAPP = '+91-9701-756-904';
export const STORE_WHATSAPP_INTL = '919701756904';

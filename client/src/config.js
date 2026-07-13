// API base URL. Empty string => same origin (dev proxy or single Node host).
// For a split deployment (static frontend + separate API host), set
// VITE_API_BASE at build time, e.g. https://api.bunnygiftsstore.com
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export const OWNER_EMAIL = 'brscustomgifts@gmail.com';

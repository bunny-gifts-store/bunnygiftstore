import { API_BASE } from './config.js';

// Mirrors the original formatPrice() behaviour.
export function formatPrice(value) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `₹${value.toLocaleString('en-IN')}`;
  }
  return value || 'Price on request';
}

// Display price for a product (handles frame-style priceLabel).
export function displayPrice(product) {
  if (product.price != null) return formatPrice(product.price);
  if (product.priceLabel) return product.priceLabel;
  return 'Price on request';
}

// Branded order number from the order's database id, e.g. 1 -> "#BGS001".
// Using the raw id keeps the order number identical across the admin panel and
// the customer's My Orders page (a shared serial couldn't be computed per-user).
export function formatOrderNo(id) {
  return `#BGS${String(id || 0).padStart(3, '0')}`;
}

// Whether a product needs the customer to send a photo (frames, resin, mugs,
// mirrors, pillows, etc.) — used to show the "send your photo" note. Keyword
// based so no DB flag is required; adjust the list as the catalogue grows.
const PHOTO_KEYWORDS = [
  'photo', 'frame', 'resin', 'polaroid', 'pillow', 'cushion', 'mug', 'mirror',
  'pop socket', 'popsocket', 'mobile case', 'phone case', 'portrait', 'collage',
  'canvas', 'poster', 'lamp',
];
export function needsCustomPhoto(product) {
  if (!product) return false;
  const hay = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
  return PHOTO_KEYWORDS.some((k) => hay.includes(k));
}

// Resolve a stored image path to a browser URL.
// - "images/CODE.png"  -> bundled asset served from the app root (/images/..)
// - "uploads/xxx.png"  -> admin upload served by the API host
// - absolute http(s)   -> used as-is
export function resolveImage(image) {
  if (!image) return '/images/placeholder.png';
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith('uploads/')) return `${API_BASE}/${image}`;
  return image.startsWith('/') ? image : `/${image}`;
}

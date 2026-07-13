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

// Build a map of order id -> sequential serial number (1-based, by creation
// order) so orders display as continuous 0001, 0002, … without gaps.
export function buildOrderSerials(orders) {
  const map = {};
  [...orders].sort((a, b) => a.id - b.id).forEach((o, i) => { map[o.id] = i + 1; });
  return map;
}

// Zero-padded order number, e.g. 3 -> "#0003".
export function formatOrderNo(serial) {
  return `#${String(serial || 0).padStart(4, '0')}`;
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

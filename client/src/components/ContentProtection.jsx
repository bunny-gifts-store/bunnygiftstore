import { useEffect } from 'react';

// Ports the original storefront content-protection behaviour.
const SELECTOR =
  '.product-image, .modal-product-image, .qr-payment-image, ' +
  '.product-card, .product-image-wrapper, .modal-product-grid, ' +
  '.product-name, .product-short, .product-description, ' +
  '.modal-description, .modal-product-details, ' +
  '.product-price, .modal-product-price, .modal-product-code';

export default function ContentProtection() {
  useEffect(() => {
    const isProtected = (t) => !!(t && t.closest && t.closest(SELECTOR));

    const onContext = (e) => { if (isProtected(e.target)) e.preventDefault(); };
    const onDrag = (e) => {
      if ((e.target && e.target.tagName === 'IMG') || isProtected(e.target)) e.preventDefault();
    };
    const onCopy = (e) => { if (isProtected(e.target)) e.preventDefault(); };
    const onKey = (e) => {
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'u' || key === 'p')) e.preventDefault();
    };

    document.addEventListener('contextmenu', onContext);
    document.addEventListener('dragstart', onDrag);
    document.addEventListener('copy', onCopy);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('dragstart', onDrag);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}

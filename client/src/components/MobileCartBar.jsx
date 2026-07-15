import { useCart } from '../context/CartContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { formatPrice } from '../utils.js';

// Mobile-only sticky action bar. Appears at the bottom once the cart has items
// so shoppers can jump straight to checkout. Hidden on desktop (CSS) and while
// the cart modal is already open.
export default function MobileCartBar() {
  const { count, total } = useCart();
  const { openCart, cartOpen } = useUI();

  if (count < 1 || cartOpen) return null;

  return (
    <button type="button" className="mobile-cart-bar" onClick={openCart} aria-label={`Go to cart, ${count} items`}>
      <span className="mcb-left">
        <span className="mcb-icon" aria-hidden="true">🛒</span>
        <span className="mcb-count">{count}</span>
        <span className="mcb-text">Go to Cart</span>
      </span>
      <span className="mcb-total">{formatPrice(total)}</span>
    </button>
  );
}

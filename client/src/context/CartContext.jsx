import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

// Preserve the original localStorage key so existing carts survive the upgrade.
const STORAGE_KEY = 'bunnyCart';

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.map((i) => ({ ...i, quantity: i.quantity || 1 })) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id && i.size === product.size);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + product.quantity };
        return next;
      }
      return [...prev, product];
    });
  };

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const setQuantity = (index, qty) => {
    const q = parseInt(qty, 10);
    if (Number.isNaN(q) || q < 1) return;
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, quantity: q } : it)));
  };

  const changeQuantity = (index, delta) =>
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, (it.quantity || 1) + delta) } : it))
    );

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + (i.quantity || 1), 0);
  const total = items.reduce((s, i) => s + (i.pricePerUnit || i.price || 0) * (i.quantity || 1), 0);

  const value = useMemo(
    () => ({ items, addItem, removeItem, setQuantity, changeQuantity, clear, count, total }),
    [items] // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

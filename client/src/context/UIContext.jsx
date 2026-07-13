import { createContext, useContext, useMemo, useState } from 'react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

// Coordinates the shared storefront overlays (cart, login, product detail).
export function UIProvider({ children }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

  const value = useMemo(
    () => ({
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      loginOpen,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      activeProduct,
      openProduct: (p) => setActiveProduct(p),
      closeProduct: () => setActiveProduct(null),
    }),
    [cartOpen, loginOpen, activeProduct]
  );
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

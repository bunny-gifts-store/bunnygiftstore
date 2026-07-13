import { useEffect, useState } from 'react';
import { fetchCategories, fetchProducts, apiError } from '../api.js';

// Loads categories + products once. Products already exclude unavailable items.
export function useCatalog() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cats, prods] = await Promise.all([fetchCategories(), fetchProducts()]);
        if (!alive) return;
        setCategories(cats.filter((c) => c.productCount > 0));
        setProducts(prods);
      } catch (err) {
        if (alive) setError(apiError(err, 'Could not load products.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { categories, products, loading, error };
}

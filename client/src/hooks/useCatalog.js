import { useEffect, useState } from 'react';
import { fetchCatalogSnapshot, apiError } from '../api.js';

// Loads categories + products once. Products already exclude unavailable items.
//
// `stale` is true when the API served its saved snapshot because the database
// was unreachable: the catalogue is still browsable, but prices and stock may
// be out of date and nothing can actually be ordered.
export function useCatalog() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snapshot = await fetchCatalogSnapshot();
        if (!alive) return;
        setCategories(snapshot.categories.filter((c) => c.productCount > 0));
        setProducts(snapshot.products);
        setStale(snapshot.stale);
      } catch (err) {
        if (alive) setError(apiError(err, 'Could not load products.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { categories, products, loading, error, stale };
}

import { useState } from 'react';
import ProductGrid from './ProductGrid.jsx';
import { useCatalog } from '../hooks/useCatalog.js';

// Shared catalog view: category filter chips + category-wise product sections.
// - lockCategory: restrict to a single category slug (hides the filter bar).
export default function CategorizedCatalog({ title, subtitle, lockCategory = null }) {
  const { categories, products, loading, error } = useCatalog();
  const [active, setActive] = useState(lockCategory || 'all');

  const effectiveCategories = lockCategory
    ? categories.filter((c) => c.slug === lockCategory)
    : categories;

  const renderGroups = () => {
    const cats = active === 'all' ? effectiveCategories : effectiveCategories.filter((c) => c.slug === active);
    const blocks = cats
      .map((c) => ({ c, list: products.filter((p) => p.categorySlug === c.slug) }))
      .filter(({ list }) => list.length > 0);

    if (blocks.length === 0) {
      return <p className="text-center text-muted py-4">No products available yet.</p>;
    }
    return blocks.map(({ c, list }) => (
      <div className="category-block" key={c.id} id={`cat-${c.slug}`}>
        <h3 className="category-heading">{c.name}</h3>
        <ProductGrid products={list} />
      </div>
    ));
  };

  return (
    <section className="products-section" id="products">
      <div className="container">
        {title && <h2 className="section-title">{title}</h2>}
        {subtitle && <p className="section-subtitle">{subtitle}</p>}

        {!lockCategory && effectiveCategories.length > 0 && (
          <div className="category-filter" role="tablist" aria-label="Product categories">
            <button className={`category-chip${active === 'all' ? ' active' : ''}`} onClick={() => setActive('all')}>
              All
            </button>
            {effectiveCategories.map((c) => (
              <button
                key={c.id}
                className={`category-chip${active === c.slug ? ' active' : ''}`}
                onClick={() => setActive(c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {loading && <p className="text-center text-muted py-5">Loading products…</p>}
        {error && <p className="text-center text-danger py-5">{error}</p>}
        {!loading && !error && renderGroups()}
      </div>
    </section>
  );
}

import ProductCard from './ProductCard.jsx';

export default function ProductGrid({ products }) {
  if (!products || products.length === 0) {
    return <p className="text-center text-muted py-4">No products available in this collection yet.</p>;
  }
  return (
    <div className="products-grid">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}

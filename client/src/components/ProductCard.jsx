import { useUI } from '../context/UIContext.jsx';
import { displayPrice, resolveImage } from '../utils.js';

export default function ProductCard({ product }) {
  const { openProduct } = useUI();

  const onCardClick = (e) => {
    if (e.target.closest('button')) return;
    openProduct(product);
  };

  return (
    <div className="product-card" data-product-id={product.id} onClick={onCardClick}>
      <div className="product-image-wrapper">
        <img
          src={resolveImage(product.image)}
          alt={product.name}
          className="product-image"
          loading="lazy"
          draggable="false"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
        <span className="product-badge">{product.code}</span>
        {product.outOfStock && <span className="product-status-badge product-status-oos">Out of Stock</span>}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-short">{product.description}</p>
        <div className="product-meta d-flex flex-wrap gap-3 align-items-center justify-content-between">
          <div className="product-price">{displayPrice(product)}</div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => openProduct(product)}
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

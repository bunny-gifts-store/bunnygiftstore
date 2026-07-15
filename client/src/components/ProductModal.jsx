import { useEffect, useMemo, useState } from 'react';
import { useUI } from '../context/UIContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { formatPrice, displayPrice, resolveImage, needsCustomPhoto } from '../utils.js';
import { OWNER_EMAIL, STORE_WHATSAPP, STORE_WHATSAPP_INTL } from '../config.js';

export default function ProductModal() {
  const { activeProduct: product, closeProduct } = useUI();
  const { addItem } = useCart();

  const sizeOptions = product?.sizeOptions || null;
  const widths = useMemo(
    () => (sizeOptions ? Array.from(new Set(sizeOptions.map((o) => o.width))) : []),
    [sizeOptions]
  );

  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [added, setAdded] = useState(false);

  // Initialise size selectors whenever a new frame product opens.
  useEffect(() => {
    setAdded(false);
    if (sizeOptions && widths.length) {
      const firstWidth = widths[0];
      const firstHeight = sizeOptions.find((o) => o.width === firstWidth)?.height || '';
      setWidth(firstWidth);
      setHeight(firstHeight);
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while the modal is open.
  // NOTE: reset to '' (not 'auto') on close — setting body overflow to a value
  // makes <body> a scroll container and breaks the sticky header.
  useEffect(() => {
    if (product) {
      document.body.style.overflow = 'hidden';
      const onKey = (e) => { if (e.key === 'Escape') closeProduct(); };
      document.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
      };
    }
  }, [product, closeProduct]);

  if (!product) return null;

  const heights = sizeOptions
    ? Array.from(new Set(sizeOptions.filter((o) => o.width === width).map((o) => o.height)))
    : [];
  const currentOption = sizeOptions
    ? sizeOptions.find((o) => o.width === width && o.height === height) || sizeOptions[0]
    : null;

  const priceText = currentOption ? formatPrice(currentOption.price) : displayPrice(product);
  const disabled = product.outOfStock;

  const handleAdd = () => {
    if (disabled) return;
    let selectedSize = '';
    let pricePerUnit = product.price;
    if (currentOption) {
      selectedSize = currentOption.label;
      pricePerUnit = currentOption.price;
    }
    addItem({
      id: product.id,
      code: product.code,
      name: product.name,
      pricePerUnit,
      price: pricePerUnit,
      size: selectedSize,
      quantity: 1,
      image: product.image,
    });
    setAdded(true);
    setTimeout(() => closeProduct(), 700);
  };

  return (
    <div
      id="productModal"
      className="product-modal"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target.id === 'productModal') closeProduct(); }}
    >
      <div className="product-modal-content">
        <div className="product-modal-header">
          <h2>Product Details</h2>
          <button className="close-btn" onClick={closeProduct}>&times;</button>
        </div>
        <div className="product-modal-body">
          <div className="modal-product-grid">
            <div>
              <img
                src={resolveImage(product.image)}
                alt={product.name}
                className="modal-product-image"
                loading="lazy"
                draggable="false"
              />
            </div>
            <div className="modal-product-details">
              <div className="modal-product-code">Code: {product.code}</div>
              <h3 className="modal-product-title">{product.name}</h3>
              <p className="modal-product-price">{priceText}</p>
              <p className="modal-description">{product.description}</p>

              {disabled && <p className="text-danger fw-semibold mb-2">Currently out of stock</p>}

              {sizeOptions && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="modalProductWidth" className="form-label">Width</label>
                    <select
                      id="modalProductWidth"
                      className="form-select"
                      value={width}
                      onChange={(e) => {
                        const w = e.target.value;
                        setWidth(w);
                        const h = sizeOptions.find((o) => o.width === w)?.height || '';
                        setHeight(h);
                      }}
                    >
                      {widths.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="modalProductHeight" className="form-label">Height</label>
                    <select
                      id="modalProductHeight"
                      className="form-select"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    >
                      {heights.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {needsCustomPhoto(product) && (
            <div className="photo-note" role="note">
              <div className="photo-note-title">📸 How to customize</div>
              <ol className="photo-note-list">
                <li>
                  After placing your order, send us a screenshot showing your <strong>Order ID</strong> along with your customization image and name.
                </li>
                <li>
                  Send your customization photo and name to us on WhatsApp:{' '}
                  <a href={`https://wa.me/${STORE_WHATSAPP_INTL}`} target="_blank" rel="noopener noreferrer">{STORE_WHATSAPP}</a>.
                </li>
                <li>
                  For better print quality, email your photo in <strong>HD</strong> to{' '}
                  <a href={`mailto:${OWNER_EMAIL}`}>{OWNER_EMAIL}</a>.
                </li>
              </ol>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeProduct}>Close</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={disabled}>
            {added ? 'Added ✓' : disabled ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

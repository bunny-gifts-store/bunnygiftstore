import { useState } from 'react';
import { adminCreateProduct, adminUpdateProduct, adminUploadImage, apiError } from '../api.js';
import { resolveImage } from '../utils.js';

const blank = {
  code: '', name: '', description: '', price: '', priceLabel: '',
  categoryId: '', image: '', outOfStock: false, unavailable: false, sortOrder: 0,
};

export default function ProductForm({ product, categories, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState(() =>
    product
      ? {
          code: product.code || '', name: product.name || '', description: product.description || '',
          price: product.price ?? '', priceLabel: product.priceLabel || '',
          categoryId: product.categoryId || '', image: product.image || '',
          outOfStock: !!product.outOfStock, unavailable: !!product.unavailable,
          sortOrder: product.sortOrder || 0,
        }
      : blank
  );
  // Per-size pricing (photo frames): each row is { width, height, label, price }.
  // Prices are kept as strings while editing so the inputs stay controlled.
  const [sizes, setSizes] = useState(() =>
    Array.isArray(product?.sizeOptions)
      ? product.sizeOptions.map((o) => ({
          width: o.width ?? '', height: o.height ?? '',
          label: o.label ?? '', price: o.price ?? '',
        }))
      : []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addSize = () => setSizes((s) => [...s, { width: '', height: '', label: '', price: '' }]);
  const updateSize = (i, k, v) =>
    setSizes((s) => s.map((o, idx) => (idx === i ? { ...o, [k]: v } : o)));
  const removeSize = (i) => setSizes((s) => s.filter((_, idx) => idx !== i));

  // Rows the customer will actually see: a valid price is required; the label is
  // auto-derived from width×height when left blank (mirrors the server rule).
  const cleanSizes = () =>
    sizes
      .map((o) => {
        const width = String(o.width).trim();
        const height = String(o.height).trim();
        let label = String(o.label).trim();
        if (!label) label = width && height ? `${width}/${height} Inch` : width || height || '';
        return { width, height, label, price: o.price === '' ? NaN : Number(o.price) };
      })
      .filter((o) => Number.isFinite(o.price) && o.price >= 0 && o.label);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { path } = await adminUploadImage(file);
      set('image', path);
    } catch (err) {
      setError(apiError(err, 'Image upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.code.trim() || !form.name.trim()) { setError('Code and name are required.'); return; }
    const sizeOptions = cleanSizes();
    if (form.price === '' && !form.priceLabel.trim() && sizeOptions.length === 0) {
      setError('Enter a price, a price label (like "From ₹500"), or at least one size option.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: form.price === '' ? null : Number(form.price),
        categoryId: form.categoryId || null,
        sortOrder: Number(form.sortOrder) || 0,
        sizeOptions,
      };
      if (isEdit) await adminUpdateProduct(product.id, payload);
      else await adminCreateProduct(payload);
      onSaved();
    } catch (err) {
      setError(apiError(err, 'Could not save the product.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal fade show d-block admin-product-modal" tabIndex="-1" role="dialog"
           onClick={(e) => { if (e.target.classList.contains('modal')) onClose(); }}>
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{isEdit ? `Edit: ${product.name}` : 'Add Product'}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Item Code *</label>
                    <input className="form-control" value={form.code} onChange={(e) => set('code', e.target.value)} />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Item Name *</label>
                    <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                      <option value="">— Uncategorised —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Price (₹)</label>
                    <input type="number" min="0" step="1" className="form-control"
                           value={form.price} onChange={(e) => set('price', e.target.value)}
                           placeholder="e.g. 550" />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Price Label</label>
                    <input className="form-control" value={form.priceLabel}
                           onChange={(e) => set('priceLabel', e.target.value)} placeholder="From ₹500" />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea className="form-control" rows="3" value={form.description}
                              onChange={(e) => set('description', e.target.value)} />
                  </div>

                  <div className="col-md-8">
                    <label className="form-label">Item Image</label>
                    <input type="file" accept="image/*" className="form-control" onChange={handleUpload} disabled={uploading} />
                    <small className="text-muted">{uploading ? 'Uploading…' : 'Upload a product image (PNG or JPG).'}</small>
                  </div>
                  <div className="col-md-4 text-center">
                    {form.image
                      ? <img src={resolveImage(form.image)} alt="preview" className="img-fluid rounded"
                             style={{ maxHeight: 120, objectFit: 'contain' }} />
                      : <div className="text-muted small pt-4">No image</div>}
                  </div>

                  {/* Per-size pricing — used by photo frames and any product sold
                      in multiple sizes. Each size the customer can pick has its
                      own price; leave empty for a single fixed-price product. */}
                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <label className="form-label mb-0">Size Options <span className="text-muted fw-normal">(for photo frames / multi-size products)</span></label>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={addSize}>+ Add Size</button>
                    </div>

                    {sizes.length === 0 ? (
                      <p className="text-muted small mb-0">
                        No size options. The product uses the single price above.
                        Add sizes (e.g. 8/12 Inch, A4) to let customers choose a size with its own price.
                      </p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-1">
                          <thead>
                            <tr>
                              <th style={{ width: '18%' }}>Width</th>
                              <th style={{ width: '18%' }}>Height</th>
                              <th>Label</th>
                              <th style={{ width: '18%' }}>Price (₹)</th>
                              <th style={{ width: 44 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sizes.map((o, i) => (
                              <tr key={i}>
                                <td>
                                  <input className="form-control form-control-sm" value={o.width}
                                         placeholder="8" onChange={(e) => updateSize(i, 'width', e.target.value)} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" value={o.height}
                                         placeholder="12" onChange={(e) => updateSize(i, 'height', e.target.value)} />
                                </td>
                                <td>
                                  <input className="form-control form-control-sm" value={o.label}
                                         placeholder="Auto (e.g. 8/12 Inch)" onChange={(e) => updateSize(i, 'label', e.target.value)} />
                                </td>
                                <td>
                                  <input type="number" min="0" step="1" className="form-control form-control-sm"
                                         value={o.price} placeholder="500"
                                         onChange={(e) => updateSize(i, 'price', e.target.value)} />
                                </td>
                                <td className="text-center">
                                  <button type="button" className="btn btn-sm btn-outline-danger"
                                          title="Remove size" onClick={() => removeSize(i)}>&times;</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <small className="text-muted">
                          Each row needs a price. Leave the label blank to auto-name it from width/height.
                          When sizes are set, the fixed price above is optional (use a Price Label like “From ₹500”).
                        </small>
                      </div>
                    )}
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  );
}

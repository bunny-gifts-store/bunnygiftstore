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
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
    if (form.price === '' && !form.priceLabel.trim()) { setError('Enter a price (or a price label like "From ₹500").'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: form.price === '' ? null : Number(form.price),
        categoryId: form.categoryId || null,
        sortOrder: Number(form.sortOrder) || 0,
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

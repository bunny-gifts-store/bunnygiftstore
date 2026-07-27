import { useEffect, useRef, useState } from 'react';
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

  // In-app camera (take a product photo instantly).
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [fileName, setFileName] = useState('');
  const [imageSource, setImageSource] = useState(''); // 'camera' | 'gallery' | ''
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const galleryInputRef = useRef(null); // "From your Gallery" picker
  const captureInputRef = useRef(null); // native-camera fallback (mobile)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Clear the selected image everywhere: the stored path, the shown file name,
  // and the underlying file inputs (so the same file can be re-picked later).
  const clearImage = () => {
    set('image', '');
    setFileName('');
    setImageSource('');
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (captureInputRef.current) captureInputRef.current.value = '';
  };

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

  const uploadFile = async (file) => {
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

  const handleUpload = (e, source) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImageSource(source);
    uploadFile(file);
  };

  // Stop the live camera stream and release the device.
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
    setCameraError('');
  };

  // Open the in-app camera (rear camera on phones). If the browser can't do
  // in-page capture (unsupported / permission blocked / not a secure context),
  // fall back to the OS camera via a file input with capture="environment".
  const openCamera = async () => {
    setCameraError('');
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      captureInputRef.current?.click();
      return;
    }
    try {
      const stream = await md.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      // Permission denied or no camera — use the native camera picker instead.
      captureInputRef.current?.click();
    }
  };

  // Attach the stream once the <video> is mounted.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play?.().catch(() => {});
    }
  }, [cameraOpen]);

  // Always release the camera if the form unmounts.
  useEffect(() => stopStream, []);

  // Grab the current video frame, turn it into a JPEG file, and upload it.
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraError('Camera is still starting — try again.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) { setCameraError('Could not capture the photo. Please try again.'); return; }
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        closeCamera();
        setFileName('Camera photo');
        setImageSource('camera');
        uploadFile(file);
      },
      'image/jpeg',
      0.9
    );
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

  // Size Options only make sense for photo frames (or a product that already
  // has sizes, so an existing multi-size item can still be edited).
  const selectedCategory = categories.find((c) => String(c.id) === String(form.categoryId));
  const isFrameCategory = /frame/i.test(`${selectedCategory?.name || ''} ${selectedCategory?.slug || ''}`);
  const showSizeOptions = isFrameCategory || sizes.length > 0;

  // Re-take only applies to a photo just taken with the camera; a gallery
  // upload has no "re-take", so the button is hidden for it.
  const showRetake = imageSource === 'camera';

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

                  <div className="col-12">
                    <label className="form-label">Item Image</label>
                    <div className="image-uploader">
                      <div className="image-uploader-controls">
                        <button type="button" className="image-src-btn"
                                onClick={() => galleryInputRef.current?.click()} disabled={uploading}>
                          <span className="isb-icon" aria-hidden="true">🖼️</span> From your Gallery
                        </button>
                        <button type="button" className="image-src-btn"
                                onClick={openCamera} disabled={uploading}>
                          <span className="isb-icon" aria-hidden="true">📷</span> Take Photo
                        </button>
                        {(fileName || uploading) && (
                          <span className="image-file-name" title={fileName}>
                            {uploading ? 'Uploading…' : fileName}
                          </span>
                        )}
                        {/* Hidden inputs: gallery picker + native-camera fallback. */}
                        <input ref={galleryInputRef} type="file" accept="image/*" className="d-none" onChange={(e) => handleUpload(e, 'gallery')} />
                        <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="d-none" onChange={(e) => handleUpload(e, 'camera')} />
                      </div>

                      {form.image ? (
                        <div className="image-preview-card">
                          <img src={resolveImage(form.image)} alt="preview" className="image-preview-img" />
                          <button type="button" className="image-remove-btn" aria-label="Remove image"
                                  title="Remove image" onClick={clearImage}>&times;</button>
                          {showRetake && (
                            <button type="button" className="image-retake-btn" onClick={openCamera} disabled={uploading}>
                              <span aria-hidden="true">📷</span> Re-take Photo
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="image-preview-empty">
                          <span className="ipe-icon" aria-hidden="true">🖼️</span>
                          <span>No image selected</span>
                        </div>
                      )}
                    </div>
                    <small className="text-muted d-block mt-2">
                      Choose from your gallery or take a photo (PNG or JPG).
                    </small>
                    {cameraError && <div className="text-danger small mt-1">{cameraError}</div>}
                  </div>

                  {/* Per-size pricing — shown only for Photo Frames (or a product
                      that already carries sizes). Each size the customer can pick
                      has its own price. */}
                  {showSizeOptions && (
                  <div className="col-12">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <label className="form-label mb-0">Size Options <span className="text-muted fw-normal">(for photo frames / multi-size products)</span></label>
                      <button type="button" className="btn-theme-outline" onClick={addSize}>+ Add Size</button>
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
                  )}

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

      {cameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Take a product photo"
          style={{
            position: 'fixed', inset: 0, zIndex: 1080,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12, background: '#000' }}
          />
          {cameraError && <div className="text-warning small">{cameraError}</div>}
          <div className="d-flex gap-3">
            <button type="button" className="btn btn-light" onClick={closeCamera}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={capturePhoto} disabled={uploading}>
              📸 Capture Photo
            </button>
          </div>
        </div>
      )}
    </>
  );
}

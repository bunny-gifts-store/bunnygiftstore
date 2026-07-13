import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  adminFetchProducts, adminFetchCategories, adminToggleStatus, adminDeleteProduct, apiError,
} from '../api.js';
import { displayPrice, resolveImage } from '../utils.js';
import ProductForm from './ProductForm.jsx';

export default function ProductsAdmin() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined=closed, null=new, obj=edit

  // Status filter is driven by the URL (?filter=oos|unavailable) so the
  // dashboard cards can deep-link into a filtered list.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('filter') || '';
  const setStatusFilter = (v) => setSearchParams(v ? { filter: v } : {});

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([adminFetchProducts(), adminFetchCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter === 'oos' && !p.outOfStock) return false;
      if (statusFilter === 'unavailable' && !p.unavailable) return false;
      if (catFilter && String(p.categoryId) !== catFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    });
  }, [products, search, catFilter, statusFilter]);

  const toggle = async (p, field) => {
    // optimistic update
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, [field]: !x[field] } : x)));
    try {
      await adminToggleStatus(p.id, { [field]: !p[field] });
    } catch (err) {
      setError(apiError(err));
      load(); // revert on failure
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await adminDeleteProduct(p.id);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="mb-0">Products <span className="text-muted fs-6">({products.length})</span></h2>
        <button className="btn btn-primary" onClick={() => setEditing(null)}>+ Add Product</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="admin-card">
        <div className="row g-2 mb-3">
          <div className="col-md-5">
            <input className="form-control" placeholder="Search by name or code…"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="oos">Out of Stock</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        {statusFilter && (
          <div className="mb-3">
            <span className="badge bg-secondary">
              Showing: {statusFilter === 'oos' ? 'Out of Stock' : 'Unavailable'} only
            </span>{' '}
            <button className="btn btn-sm btn-link p-0 align-baseline" onClick={() => setStatusFilter('')}>
              Clear filter
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th></th><th>Code</th><th>Name</th><th>Category</th><th>Price</th>
                  <th>Out of Stock</th><th>Unavailable</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={p.unavailable ? 'table-secondary' : ''}>
                    <td><img className="admin-thumb" src={resolveImage(p.image)} alt="" /></td>
                    <td><code>{p.code}</code></td>
                    <td>{p.name}</td>
                    <td>{p.category || <span className="text-muted">—</span>}</td>
                    <td>{displayPrice(p)}</td>
                    <td>
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox"
                               checked={p.outOfStock} onChange={() => toggle(p, 'outOfStock')} />
                      </div>
                    </td>
                    <td>
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox"
                               checked={p.unavailable} onChange={() => toggle(p, 'unavailable')} />
                      </div>
                    </td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setEditing(p)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No products match your filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== undefined && (
        <ProductForm
          product={editing}
          categories={categories}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(); }}
        />
      )}
    </>
  );
}

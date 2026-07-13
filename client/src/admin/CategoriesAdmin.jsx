import { useEffect, useState } from 'react';
import {
  adminFetchCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory, apiError,
} from '../api.js';

export default function CategoriesAdmin() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    try { setCategories(await adminFetchCategories()); }
    catch (err) { setError(apiError(err)); }
  };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      await adminCreateCategory({ name: name.trim(), sortOrder: categories.length });
      setName('');
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const saveEdit = async (id) => {
    try { await adminUpdateCategory(id, { name: editName.trim() }); setEditId(null); load(); }
    catch (err) { setError(apiError(err)); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try { await adminDeleteCategory(c.id); load(); }
    catch (err) { setError(apiError(err)); }
  };

  return (
    <>
      <h2 className="mb-4">Categories</h2>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="admin-card">
        <form className="row g-2 mb-4" onSubmit={add}>
          <div className="col-sm-8 col-md-6">
            <input className="form-control" placeholder="New category name" value={name}
                   onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-sm-4 col-md-2">
            <button className="btn btn-primary w-100">Add</button>
          </div>
        </form>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    {editId === c.id
                      ? <input className="form-control form-control-sm" value={editName}
                               onChange={(e) => setEditName(e.target.value)} />
                      : c.name}
                  </td>
                  <td><code>{c.slug}</code></td>
                  <td className="text-nowrap text-end">
                    {editId === c.id ? (
                      <>
                        <button className="btn btn-sm btn-primary me-1" onClick={() => saveEdit(c.id)}>Save</button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-outline-secondary me-1"
                                onClick={() => { setEditId(c.id); setEditName(c.name); }}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => remove(c)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {categories.length === 0 && <tr><td colSpan="3" className="text-muted text-center py-3">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

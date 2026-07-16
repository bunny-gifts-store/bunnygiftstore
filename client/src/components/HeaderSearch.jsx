import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchProducts, apiError } from '../api.js';
import { buildSearchIndex, searchIndex, highlightSegments } from '../search.js';
import { useUI } from '../context/UIContext.jsx';
import { displayPrice, resolveImage } from '../utils.js';

// Cap on rendered rows. The panel scrolls, so this is only a guard against a
// very broad query building a huge list of DOM nodes on every keystroke.
const MAX_VISIBLE = 50;

// Emphasise the typed part of a result's name.
function Highlighted({ text, query }) {
  return highlightSegments(text, query).map((seg, i) =>
    seg.hit ? <mark key={i} className="search-hit">{seg.text}</mark> : <span key={i}>{seg.text}</span>
  );
}

// Header search: live fuzzy lookup over the catalogue. Picking a result opens
// the shared ProductModal, the same detail view every product card opens.
export default function HeaderSearch({ onSelect }) {
  const { openProduct } = useUI();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const loadingRef = useRef(false);

  // Fetch the catalogue on first interaction rather than on mount, so the
  // header costs nothing extra on pages the shopper never searches from.
  const ensureCatalog = useCallback(async () => {
    if (products || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      setProducts(await fetchProducts());
    } catch (err) {
      setError(apiError(err, 'Could not load products.'));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [products]);

  const index = useMemo(() => buildSearchIndex(products || []), [products]);
  const matches = useMemo(
    () => (query.trim() ? searchIndex(index, query) : []),
    [index, query]
  );
  // Render a bounded list (a one-letter query matches nearly the whole
  // catalogue) but keep counting off the full set, so the tally stays true.
  const results = useMemo(() => matches.slice(0, MAX_VISIBLE), [matches]);

  // Keep the highlighted row in range as the result list changes.
  useEffect(() => { setActive(0); }, [query]);

  // Close when focus or a click lands outside the search.
  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  // Follow keyboard navigation with the scroll position.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (product) => {
    if (!product) return;
    setOpen(false);
    inputRef.current?.blur();
    openProduct(product);
    onSelect?.();
  };

  const reset = () => {
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (open) setOpen(false);
      else reset();
      return;
    }
    if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return (next + results.length) % results.length;
      });
    }
  };

  const showPanel = open && query.trim().length > 0;
  const listId = 'header-search-results';

  return (
    <div className="header-search" ref={rootRef}>
      <div className="header-search-field">
        <svg className="header-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          className="header-search-input"
          placeholder="Search gifts…"
          aria-label="Search products"
          autoComplete="off"
          spellCheck="false"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[active] ? `search-opt-${results[active].id}` : undefined}
          value={query}
          onFocus={() => { ensureCatalog(); setOpen(true); }}
          onChange={(e) => { ensureCatalog(); setQuery(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />

        {query && (
          <button type="button" className="header-search-clear" onClick={reset} aria-label="Clear search">
            &times;
          </button>
        )}
      </div>

      {showPanel && (
        <div className="header-search-panel">
          {loading && <p className="header-search-note">Loading products…</p>}
          {!loading && error && <p className="header-search-note text-danger">{error}</p>}

          {!loading && !error && results.length === 0 && (
            <p className="header-search-note">
              No products found for “{query.trim()}”.
              <span className="header-search-note-sub">Try a product name, keyword or category.</span>
            </p>
          )}

          {!loading && !error && results.length > 0 && (
            <>
              <ul className="header-search-list" id={listId} role="listbox" ref={listRef}
                  aria-label="Search results">
                {results.map((p, i) => (
                  <li key={p.id} role="option" id={`search-opt-${p.id}`}
                      aria-selected={i === active} data-active={i === active}>
                    <button
                      type="button"
                      className={`header-search-item${i === active ? ' active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(p)}
                    >
                      <img
                        className="header-search-thumb"
                        src={resolveImage(p.image)}
                        alt=""
                        loading="lazy"
                        draggable="false"
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      />
                      <span className="header-search-text">
                        <span className="header-search-name">
                          <Highlighted text={p.name} query={query} />
                        </span>
                        <span className="header-search-cat">{p.category}</span>
                      </span>
                      <span className="header-search-side">
                        <span className="header-search-price">{displayPrice(p)}</span>
                        {p.outOfStock && <span className="header-search-oos">Out of stock</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="header-search-count">
                {matches.length > results.length
                  ? `Showing ${results.length} of ${matches.length} products`
                  : `${matches.length} ${matches.length === 1 ? 'product' : 'products'} found`}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

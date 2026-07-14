import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUI } from '../context/UIContext.jsx';

export default function Navbar() {
  const [open, setOpen] = useState(false);          // mobile collapse
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { count } = useCart();
  const { user, logout } = useAuth();
  const { openCart } = useUI();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  const close = () => { setOpen(false); setUserMenuOpen(false); };

  // Close the user dropdown when clicking outside it.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [userMenuOpen]);

  const goHome = (e) => {
    e.preventDefault();
    close();
    navigate('/');
    setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  return (
    <header>
      <nav className="navbar navbar-expand-lg navbar-dark">
        <div className="container">
          <Link to="/" className="navbar-brand logo" onClick={close}>BunnyGiftStore</Link>
          <button
            className="navbar-toggler"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className={`collapse navbar-collapse${open ? ' show' : ''}`}>
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
              <li className="nav-item">
                <a className="nav-link" href="/#products" onClick={goHome}>Home</a>
              </li>
              <li className="nav-item"><NavLink className="nav-link" to="/about" onClick={close}>About</NavLink></li>
              <li className="nav-item"><NavLink className="nav-link" to="/contact" onClick={close}>Contact</NavLink></li>
              {user && (
                <li className="nav-item"><NavLink className="nav-link" to="/my-orders" onClick={close}>My Orders</NavLink></li>
              )}

              <li className="nav-item ms-lg-3">
                <a
                  className="nav-link cart-link"
                  href="#"
                  onClick={(e) => { e.preventDefault(); openCart(); close(); }}
                >
                  🛒 Cart <span className={`badge bg-danger rounded-pill${count === 0 ? ' d-none' : ''}`}>{count}</span>
                </a>
              </li>

              {user && (
                <li className={`nav-item dropdown ms-lg-3${userMenuOpen ? ' show' : ''}`} ref={userMenuRef}>
                  <a
                    className="nav-link nav-user-toggle"
                    href="#"
                    role="button"
                    aria-expanded={userMenuOpen}
                    onClick={(e) => { e.preventDefault(); setUserMenuOpen((v) => !v); }}
                  >
                    <span className="nav-user-avatar">👤</span>
                    <span className="nav-user-name">{user.username}</span>
                    <span className="nav-user-caret">▾</span>
                  </a>
                  <ul className={`dropdown-menu dropdown-menu-end${userMenuOpen ? ' show' : ''}`}>
                    <li className="dropdown-item-text small text-muted d-flex align-items-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {user.mobile}
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <Link className="dropdown-item d-flex align-items-center gap-2" to="/my-orders" onClick={close}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                        My Orders
                      </Link>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button
                        className="dropdown-item d-flex align-items-center gap-2"
                        onClick={() => { logout(); close(); }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Logout
                      </button>
                    </li>
                  </ul>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}

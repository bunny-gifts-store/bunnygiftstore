import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { UIProvider } from './context/UIContext.jsx';
import App from './App.jsx';
import { warmUpApi } from './api.js';
import './enhancements.css';
import './pwa/pwa.css';
// Side-effect import: captures `beforeinstallprompt`, which browsers can fire
// before React has mounted. Must run as early as possible.
import './pwa/installPrompt.js';

// Start waking the (idle-spun-down) production API immediately, so it's ready
// by the time the user logs in — avoids the long cold-start wait on click.
warmUpApi();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

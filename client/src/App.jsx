import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import CartModal from './components/CartModal.jsx';
import ProductModal from './components/ProductModal.jsx';
import MobileCartBar from './components/MobileCartBar.jsx';
import ContentProtection from './components/ContentProtection.jsx';
import UserLoginScreen from './components/UserLoginScreen.jsx';
import WelcomeOverlay from './components/WelcomeOverlay.jsx';
import PwaUpdatePrompt from './components/PwaUpdatePrompt.jsx';
import OfflineNotice from './components/OfflineNotice.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import PhotoFrames from './pages/PhotoFrames.jsx';
import AllGifts from './pages/AllGifts.jsx';
import MyOrders from './pages/MyOrders.jsx';
import Policy from './pages/Policy.jsx';
// The admin panel is a separate surface that shoppers never open — split it
// into its own chunk so the storefront bundle stays small.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

// Scroll to top on route change (except when navigating to an in-page anchor).
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);
  return null;
}

function StorefrontLayout({ children }) {
  const { user, welcome } = useAuth();

  // Gate: require registration/login before browsing or ordering.
  if (!user) return <UserLoginScreen />;

  return (
    <div className="site-shell">
      <Navbar />
      <div className="site-content">{children}</div>
      <Footer />
      <CartModal />
      <ProductModal />
      <MobileCartBar />
      {/* Straight after sign-in: covers the storefront (which loads behind it)
          until the customer continues to the home page. */}
      {welcome && <WelcomeOverlay />}
    </div>
  );
}

export default function App() {
  return (
    <>
      <ContentProtection />
      <ScrollManager />
      {/* PWA layer — both render null until they have something to say. */}
      <OfflineNotice />
      <PwaUpdatePrompt />
      <Routes>
        {/* Admin panel (separate surface, lazily loaded) */}
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="pwa-route-loading">Loading…</div>}>
              <AdminApp />
            </Suspense>
          }
        />

        {/* Storefront */}
        <Route path="/" element={<StorefrontLayout><Home /></StorefrontLayout>} />
        <Route path="/about" element={<StorefrontLayout><About /></StorefrontLayout>} />
        <Route path="/contact" element={<StorefrontLayout><Contact /></StorefrontLayout>} />
        <Route path="/photo-frames" element={<StorefrontLayout><PhotoFrames /></StorefrontLayout>} />
        <Route path="/all-gifts" element={<StorefrontLayout><AllGifts /></StorefrontLayout>} />
        <Route path="/my-orders" element={<StorefrontLayout><MyOrders /></StorefrontLayout>} />
        <Route path="/privacy-policy" element={<StorefrontLayout><Policy slug="privacy-policy" /></StorefrontLayout>} />
        <Route path="/shipping-policy" element={<StorefrontLayout><Policy slug="shipping-policy" /></StorefrontLayout>} />
        <Route path="/terms" element={<StorefrontLayout><Policy slug="terms" /></StorefrontLayout>} />
        <Route path="/refund-policy" element={<StorefrontLayout><Policy slug="refund-policy" /></StorefrontLayout>} />
        <Route path="*" element={<StorefrontLayout><Home /></StorefrontLayout>} />
      </Routes>
    </>
  );
}

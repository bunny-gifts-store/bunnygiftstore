import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <p>&copy; 2026 Bunny Gift Store. All rights reserved.</p>
      <p className="no-copy-notice">
        All product images, designs and content on this website are copyrighted. Unauthorized copying,
        reproduction or redistribution is strictly prohibited.
      </p>
      <p className="footer-gst small">GSTIN: 36BYOPP7705A1ZB</p>
      <p>🐰 Spreading Joy with Every Gift 🎁</p>
      <p className="footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link> ·{' '}
        <Link to="/shipping-policy">Shipping Policy</Link> ·{' '}
        <Link to="/terms">Terms &amp; Conditions</Link> ·{' '}
        <Link to="/refund-policy">Refund Policy</Link>
      </p>
    </footer>
  );
}

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
        <Link to="/about">About</Link> ·{' '}
        <Link to="/contact">Contact</Link> ·{' '}
        <Link to="/shipping-policy">Shipping Policy</Link> ·{' '}
        <Link to="/terms">Terms &amp; Conditions</Link> ·{' '}
        <Link to="/refund-policy">Refund Policy</Link>
      </p>
      <p className="footer-credit">
        <span className="fc-lead">💻 Developed by <span className="fc-name">Ramesh Nerella</span></span>
        <span className="fc-desc">— for mobile / web applications, websites &amp; personal portfolios</span>
        <a className="fc-phone" href="tel:+917075281024">📞 7075281024</a>
        <a
          className="fc-linkedin"
          href="https://www.linkedin.com/in/ramesh-nerella-a4a3b5247/"
          target="_blank"
          rel="noopener noreferrer"
          title="Connect on LinkedIn"
          aria-label="Connect on LinkedIn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
          </svg>
          <span className="fc-linkedin-text">LinkedIn</span>
        </a>
        <a
          className="fc-portfolio"
          href="https://rameshneralla.github.io/portfolio/"
          target="_blank"
          rel="noopener noreferrer"
          title="View Portfolio"
          aria-label="View Portfolio"
        >
          <span aria-hidden="true">🌐</span>
          <span className="fc-portfolio-text">Portfolio</span>
        </a>
      </p>
    </footer>
  );
}

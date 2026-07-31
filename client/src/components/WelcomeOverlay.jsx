import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// Celebration shown once, straight after a customer registers or logs in, before
// the storefront is revealed. The backdrop is fully opaque so the home page
// stays hidden behind it until the customer continues.

// Colour papers taken from the storefront palette so the celebration reads as
// part of the brand rather than generic confetti.
const CONFETTI_COLORS = [
  '#c77dff', '#dc81a2', '#7b4397', '#ffd166',
  '#78d5d7', '#ff8fab', '#ffffff', '#ffb703',
];

const CONFETTI_COUNT = 64;
const AUTO_DISMISS_MS = 5200;

const rand = (min, max) => min + Math.random() * (max - min);

// Build the burst once per popup.
//
// Every distance is a PERCENTAGE, and each paper's travel is applied to a
// wrapper stretched over the whole popup (inset: 0). Translate percentages
// resolve against the element's own box, so 50% in x is exactly half the
// popup's width and 50% in y half its height — that is what makes the papers
// sweep the popup's full width and height at any size it renders at, while
// still moving with nothing but compositor-friendly transforms.
function buildConfetti(count) {
  return Array.from({ length: count }, (_, i) => {
    // Launch angles spread evenly around the circle (with a little jitter) so
    // the shot opens out like a flower instead of clumping to one side.
    const angle = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
    const burst = rand(26, 52);    // how far out the papers blow open
    const settle = rand(62, 104);  // and then past the edge as they drift away
    const gravity = rand(26, 78);  // pulled downward on the way out
    return {
      '--bx': `${(Math.cos(angle) * burst).toFixed(2)}%`,
      '--by': `${(Math.sin(angle) * burst).toFixed(2)}%`,
      '--fx': `${(Math.cos(angle) * settle).toFixed(2)}%`,
      '--fy': `${(Math.sin(angle) * settle + gravity).toFixed(2)}%`,
      '--w': `${rand(6, 12).toFixed(1)}px`,
      '--h': `${rand(9, 18).toFixed(1)}px`,
      '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      '--radius': i % 4 === 0 ? '50%' : '2px',
      '--dur': `${rand(2.4, 3.9).toFixed(2)}s`,
      '--delay': `${rand(0, 1.9).toFixed(2)}s`,
      '--spin': `${rand(0.5, 1.25).toFixed(2)}s`,
    };
  });
}

export default function WelcomeOverlay() {
  const { welcome, dismissWelcome } = useAuth();
  const ctaRef = useRef(null);

  const pieces = useMemo(() => buildConfetti(CONFETTI_COUNT), []);
  const petals = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);

  const close = useCallback(() => dismissWelcome(), [dismissWelcome]);

  useEffect(() => {
    // Hold the page still, dismiss on Escape, and step aside on its own so the
    // celebration can never become something the customer has to get past.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ctaRef.current?.focus();

    const timer = setTimeout(close, AUTO_DISMISS_MS);
    const onKeyDown = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  if (!welcome) return null;

  const { returning, username } = welcome;
  const heading = returning ? 'Welcome Back To' : 'Welcome To';

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcomeHeading">
      <div className="welcome-card">
        {/* The flower shot: one bloom that blows open behind the logo. */}
        <div className="welcome-bloom" aria-hidden="true">
          {petals.map((deg) => <span key={deg} style={{ '--a': `${deg}deg` }} />)}
        </div>

        <h2 id="welcomeHeading" className="visually-hidden">
          {heading} Bunny Gift Store
        </h2>

        <div className="welcome-content">
          <p className="welcome-kicker" aria-hidden="true">{heading}</p>
          {/* The header's logo, reused verbatim (same class, same gradient). */}
          <p className="logo welcome-logo" aria-hidden="true">BunnyGiftStore</p>
          <p className="welcome-subtitle">
            {returning
              ? 'Enjoy your shopping with beautiful gifts and arts'
              : `Hi ${username || 'there'} — your account is all set. Happy gifting!`}
          </p>
          <button ref={ctaRef} type="button" className="welcome-cta" onClick={close}>
            Start Shopping
          </button>
        </div>

        {/* Colour papers, flying across the popup's full width and height. */}
        <div className="welcome-confetti" aria-hidden="true">
          {pieces.map((style, i) => <i key={i} style={style}><b /></i>)}
        </div>
      </div>
    </div>
  );
}

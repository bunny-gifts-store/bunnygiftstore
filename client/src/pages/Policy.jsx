import { useEffect, useState } from 'react';

// Renders the original legal-page content (extracted verbatim) inside the
// React storefront chrome. Content lives in /public/legal/<slug>.html.
export default function Policy({ slug }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setHtml('');
    setError('');
    fetch(`/legal/${slug}.html`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Not found'))))
      .then((t) => { if (alive) setHtml(t); })
      .catch(() => { if (alive) setError('This page could not be loaded.'); });
    return () => { alive = false; };
  }, [slug]);

  return (
    <main className="container py-5 policy-main">
      {error && <p className="text-danger">{error}</p>}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}

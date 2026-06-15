import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div className="container py-5 text-center">
      <h1 className="mb-3">Bunny Gift Store</h1>
      <p className="text-muted">React shell is connected to the existing static storefront.</p>
      <p className="small text-secondary">Use the existing HTML/CSS/Bootstrap pages for UI. This React entry point is ready for future dynamic components.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

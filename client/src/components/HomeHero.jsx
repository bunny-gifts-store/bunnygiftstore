const rep = (n) => Array.from({ length: n });

export default function HomeHero() {
  const scrollToProducts = () =>
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="hero hero-home">
      <div className="hero-home-stars" aria-hidden="true">
        {rep(30).map((_, i) => <span key={i}></span>)}
      </div>

      <div className="hero-home-lights hero-home-lights-left" aria-hidden="true">
        {rep(12).map((_, i) => <span key={i}></span>)}
      </div>
      <div className="hero-home-lights hero-home-lights-right" aria-hidden="true">
        {rep(12).map((_, i) => <span key={i}></span>)}
      </div>

      <div className="hero-home-bokeh" aria-hidden="true">
        {rep(7).map((_, i) => <span key={i}></span>)}
      </div>

      <div className="hero-home-gifts" aria-hidden="true">
        <img src="/images/BG02.png" alt="" className="hh-gift hh-gift-l1" draggable="false" />
        <img src="/images/TU01.png" alt="" className="hh-gift hh-gift-l2" draggable="false" />
        <img src="/images/BG08.png" alt="" className="hh-gift hh-gift-l3" draggable="false" />
        <img src="/images/CH02.png" alt="" className="hh-gift hh-gift-l4" draggable="false" />
        <img src="/images/BG15.png" alt="" className="hh-gift hh-gift-r1" draggable="false" />
        <img src="/images/BR01.png" alt="" className="hh-gift hh-gift-r2" draggable="false" />
        <img src="/images/BG20.png" alt="" className="hh-gift hh-gift-r3" draggable="false" />
        <img src="/images/KC01.png" alt="" className="hh-gift hh-gift-r4" draggable="false" />
      </div>

      <div className="container">
        <div className="hero-content">
          <h1 className="hero-home-title">🎁 Welcome to Bunny Gift Store 🐰</h1>
          <p className="hero-home-subtitle">Discover the Perfect Gifts for Every Occasion</p>
          <button className="btn-primary hero-home-cta" onClick={scrollToProducts}>Shop Now</button>
        </div>
      </div>
    </section>
  );
}

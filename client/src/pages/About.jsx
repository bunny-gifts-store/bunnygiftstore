const upSlow = ['BG02', 'CH02', 'KC01', 'BG10', 'CO01', 'AP01'];
const downFast = ['BG05', 'BR01', 'KC02', 'BG14', 'LA01', 'CL01'];
const upFast = ['BG08', 'CH03', 'NB01', 'BG17', 'PKC03', 'TU01'];
const downSlow = ['BG12', 'CO02', 'KC03', 'BG20', 'LL01', 'CH04'];

// Each column duplicates its images to create a seamless marquee (as in the original).
const Col = ({ className, codes }) => (
  <div className={`hero-about-col ${className}`}>
    {[...codes, ...codes].map((code, i) => (
      <img key={i} src={`/images/${code}.png`} alt="" draggable="false" />
    ))}
  </div>
);

export default function About() {
  return (
    <>
      <section className="hero hero-about">
        <div className="hero-about-bg" aria-hidden="true">
          <Col className="hero-about-col-up-slow" codes={upSlow} />
          <Col className="hero-about-col-down-fast" codes={downFast} />
          <Col className="hero-about-col-up-fast" codes={upFast} />
          <Col className="hero-about-col-down-slow" codes={downSlow} />
        </div>
        <div className="hero-about-bokeh" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => <span key={i}></span>)}
        </div>
        <div className="hero-content">
          <h1 className="hero-about-title">About Bunny Gift Store</h1>
          <p className="hero-about-subtitle">Your Trusted Partner in Perfect Gifting</p>
        </div>
      </section>

      <section className="about-section">
        <div className="about-content">
          <h2>Our Story 🎀</h2>
          <p>
            At Bunny Gift Store, we believe that every gift tells a story. Founded with a passion for spreading joy
            and happiness, we have been curating the finest gifts for over a decade. Our team works tirelessly to
            bring you the most unique, beautiful, and meaningful gift collections.
          </p>
          <p>
            We understand that choosing the perfect gift can be challenging. That's why we've created a platform where
            quality meets affordability, and every product is carefully selected to ensure it exceeds your expectations.
          </p>
          <p>
            Our commitment is simple: to provide exceptional gifts that create memorable moments and strengthen
            relationships. Whether it's for a birthday, anniversary, festival, or any special occasion, we have
            something perfect for everyone.
          </p>

          <h3 className="section-subheading">Why Choose Us?</h3>

          <div className="features">
            <div className="feature-card">
              <h3>🎯 Curated Selection</h3>
              <p>Each product is carefully selected to ensure quality and uniqueness. We only stock items we believe in.</p>
            </div>
            <div className="feature-card">
              <h3>🚚 Fast Delivery</h3>
              <p>We ensure your gifts reach on time with secure packaging and reliable delivery partners.</p>
            </div>
            <div className="feature-card">
              <h3>💝 Personalization</h3>
              <p>Add a personal touch to your gifts with our customization and gift wrapping services.</p>
            </div>
            <div className="feature-card">
              <h3>✨ Premium Quality</h3>
              <p>Only the finest materials and craftsmanship go into every product we offer.</p>
            </div>
            <div className="feature-card">
              <h3>💬 Customer Support</h3>
              <p>Our dedicated team is here to help you 24/7 with any questions or concerns.</p>
            </div>
            <div className="feature-card">
              <h3>🎉 Affordable Prices</h3>
              <p>Premium quality doesn't have to break the bank. We offer competitive pricing on all items.</p>
            </div>
          </div>

          <h3 className="section-subheading-lg">Our Mission</h3>
          <p>
            To be the most trusted and beloved gift store by providing exceptional products and services that
            help people celebrate life's special moments with their loved ones. We are dedicated to creating
            happiness through thoughtfully curated gifts that speak to the heart.
          </p>

          <h3 className="section-subheading">Our Values</h3>
          <ul className="values-list">
            <li><strong>Quality:</strong> We never compromise on the quality of our products.</li>
            <li><strong>Integrity:</strong> Honesty and transparency in all our dealings.</li>
            <li><strong>Customer Focus:</strong> Your satisfaction is our ultimate goal.</li>
            <li><strong>Innovation:</strong> Constantly evolving to meet your gifting needs.</li>
            <li><strong>Sustainability:</strong> Committed to eco-friendly packaging and practices.</li>
          </ul>

          <div className="text-center mt-5">
            <a href="/#products" className="btn-primary">Explore Our Collection</a>
          </div>
        </div>
      </section>
    </>
  );
}

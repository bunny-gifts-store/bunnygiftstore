const icons = ['envelope', 'phone', 'chat', 'pin', 'heart'];

export default function Contact() {
  return (
    <>
      <section className="hero hero-contact">
        <div className="hero-contact-rings" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => <span key={i}></span>)}
        </div>
        <div className="hero-contact-icons" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={`hcicon hcicon-${icons[i % icons.length]} hcicon-pos-${i + 1}`}></span>
          ))}
        </div>
        <div className="hero-contact-bokeh" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => <span key={i}></span>)}
        </div>
        <div className="hero-content">
          <h1 className="hero-contact-title">Get In Touch With Us</h1>
          <p className="hero-contact-subtitle">We'd Love to Hear From You!</p>
        </div>
      </section>

      <section className="contact-section">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="contact-info">
                <h2>Contact Information</h2>

                <div className="contact-info-item">
                  <div className="contact-icon address-icon">📍</div>
                  <div className="contact-content">
                    <h3>Address</h3>
                    <p>Bunny Gifts Store<br />Behind Gismath Mandi, Pragathi Nagar<br />Kukatpally, JNTU, Hyderabad, Telangana 500090</p>
                    <a
                      href="https://maps.google.com/?q=Bunny+Gifts+Store,+Behind+Gismath+Mandi,+Pragathi+Nagar,+Kukatpally,+JNTU,+Hyderabad,+Telangana+500090"
                      target="_blank" rel="noopener noreferrer" className="maps-link"
                    >
                      Click to view on Google maps →
                    </a>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-icon phone-icon">📞</div>
                  <div className="contact-content">
                    <h3>Phone</h3>
                    <p>+91-9701-756-904</p>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-icon email-icon">📧</div>
                  <div className="contact-content">
                    <h3>Email</h3>
                    <p>brscustomgifts@gmail.com</p>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-icon hours-icon">⏰</div>
                  <div className="contact-content">
                    <h3>Working Hours</h3>
                    <p>Monday - Saturday: 09:00 AM - 09:00 PM<br />Sunday: Closed</p>
                  </div>
                </div>

                <div className="contact-info-item">
                  <div className="contact-icon social-icon-badge">🌐</div>
                  <div className="contact-content">
                    <h3>Social Media</h3>
                    <div className="social-media-icons">
                      <a href="https://www.instagram.com/bunnygiftsstore?igsh=eW5na2lldjlkaWVu&utm_source=qr"
                         target="_blank" rel="noopener noreferrer" title="Instagram" className="social-link">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" fill="none" stroke="currentColor" strokeWidth="2" />
                          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" />
                        </svg>
                      </a>
                      <a href="#" title="Facebook" className="social-link">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="contact-map">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3806.0693852124586!2d78.3645!3d17.3842!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bcb91f5c8c8c8c9%3A0x8c8c8c8c8c8c8c8c!2sBunny%20Gifts%20Store!5e0!3m2!1sen!2sin!4v1234567890"
                  width="100%" height="500" className="contact-map-iframe" loading="lazy"
                  referrerPolicy="no-referrer" title="Bunny Gifts Store location on Google Maps"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

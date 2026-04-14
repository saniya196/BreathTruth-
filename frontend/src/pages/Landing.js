import React from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: '📊', title: 'Community AQI Reports', desc: 'Citizens submit hyperlocal air quality readings, creating a ground-truth data layer beyond sparse government sensors.' },
  { icon: '⚡', title: 'Real vs Official Gap', desc: 'Side-by-side comparison of community data vs CPCB official readings. Anomalies are automatically flagged.' },
  { icon: '🎯', title: 'Community Confidence Score', desc: 'Not just raw data — a scientific confidence score (Low/Moderate/High/Verified) ensures crowdsourced data is trustworthy.' },
  { icon: '🗺️', title: 'Risk Zone Mapping', desc: 'Color-coded map overlays with schools, hospitals, and care homes highlighted in high-pollution zones.' },
  { icon: '🏥', title: 'Health Advisories', desc: 'Dynamic, CPCB-standard health guidelines based on your current area AQI. Know exactly what to do.' },
  { icon: '📢', title: 'Civic Complaint Generator', desc: 'Auto-generate a formal PDF complaint letter backed by 7-day community data. Hold authorities accountable.' },
];

const STATS = [
  { value: '1000+', label: 'Cities Monitored' },
  { value: '50K+', label: 'Reports Submitted' },
  { value: '2.4x', label: 'Avg. Data Divergence' },
  { value: '100%', label: 'Open Data' },
];

export default function Landing() {
  return (
    <div className="landing-page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🌍 Made for Indian Citizens</div>
          <h1 className="hero-title">
            The Air Quality Your Government <span className="hero-accent">Isn't Monitoring</span>
          </h1>
          <p className="hero-desc">
            India's official AQI sensors cover only a fraction of urban areas. BreathTruth fills
            the gap with community-verified data, showing the real pollution levels in your neighbourhood
            — and the tools to demand action.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn-hero-primary">Start Contributing Free</Link>
            <Link to="/public" className="btn-hero-secondary">View Public Dashboard</Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="aqi-demo-card">
            <div className="demo-row">
              <span className="demo-label">Official AQI</span>
              <span className="demo-value demo-official">128</span>
            </div>
            <div className="demo-divider" />
            <div className="demo-row">
              <span className="demo-label">Community AQI</span>
              <span className="demo-value demo-community">312</span>
            </div>
            <div className="demo-anomaly">⚠️ 2.4x gap detected</div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="stats-bar">
        {STATS.map((s, i) => (
          <div key={i} className="stat-item">
            <span className="stat-big">{s.value}</span>
            <span className="stat-tiny">{s.label}</span>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="features-section">
        <h2 className="section-heading">Everything You Need to Breathe Smarter</h2>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="how-section">
        <h2 className="section-heading">How BreathTruth Works</h2>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-num">01</div>
            <h3>Citizens Report</h3>
            <p>Register and submit AQI readings or symptom-based reports from your exact pincode.</p>
          </div>
          <div className="how-arrow">→</div>
          <div className="how-step">
            <div className="how-num">02</div>
            <h3>Data Aggregates</h3>
            <p>Reports are clustered by area and day. A confidence score ensures quality over quantity.</p>
          </div>
          <div className="how-arrow">→</div>
          <div className="how-step">
            <div className="how-num">03</div>
            <h3>Gaps Are Exposed</h3>
            <p>When community data diverges 2x+ from official stations, an anomaly is flagged publicly.</p>
          </div>
          <div className="how-arrow">→</div>
          <div className="how-step">
            <div className="how-num">04</div>
            <h3>Action Is Taken</h3>
            <p>Download a formal complaint PDF with your evidence and send it to municipal authorities.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Your Neighbourhood Deserves Clean Air</h2>
        <p>Join thousands of citizens making invisible pollution visible — and accountable.</p>
        <Link to="/register" className="btn-hero-primary">Create Free Account</Link>
      </section>

      <footer className="landing-footer">
        <p>BreathTruth — Community Air Quality Monitoring Platform</p>
        <p className="footer-sub">Data is crowdsourced and should be used for advocacy, not medical decisions.</p>
      </footer>
    </div>
  );
}

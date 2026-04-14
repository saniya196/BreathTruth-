import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAqiColor, formatAqiLabel, AQI_CATEGORIES } from '../utils/aqiHelpers';

export default function PublicDashboard() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchZones(); }, []);

  const fetchZones = async () => {
    try {
      const { data } = await axios.get('/api/map/zones');
      setZones(data.zones || []);
    } catch {
      setZones([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page public-page">
      <div className="public-header">
        <h1>🌬️ BreathTruth — Live Community AQI</h1>
        <p>Real-time community-reported air quality across India. No login required.</p>
        <a href="/register" className="btn-primary">Join & Contribute →</a>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : zones.length === 0 ? (
        <div className="empty-state">
          <p>No community data yet. <a href="/register">Be the first to report!</a></p>
        </div>
      ) : (
        <div className="public-zones-grid">
          {zones.map((zone, i) => {
            const aqi = zone.communityAqi || zone.officialAqi;
            const color = getAqiColor(aqi);
            return (
              <div key={i} className="zone-card" style={{ borderTop: `4px solid ${color}` }}>
                <div className="zone-header">
                  <span className="zone-name">{zone.locality}</span>
                  <span className="zone-aqi" style={{ color }}>{aqi || '—'}</span>
                </div>
                <div className="zone-category" style={{ color }}>{formatAqiLabel(aqi)}</div>
                <div className="zone-meta">
                  <span>Community: {zone.communityAqi || '—'}</span>
                  <span>Official: {zone.officialAqi || '—'}</span>
                </div>
                {zone.anomalyFlagged && (
                  <div className="zone-anomaly">⚠️ Anomaly — community data diverges from official</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AQI Legend */}
      <div className="public-legend">
        <h3>AQI Scale (India CPCB Standard)</h3>
        <div className="legend-grid">
          {Object.entries(AQI_CATEGORIES).filter(([k]) => k !== 'unknown').map(([key, cat]) => (
            <div key={key} className="legend-card" style={{ borderLeft: `4px solid ${cat.color}` }}>
              <span style={{ color: cat.color, fontWeight: 600 }}>{cat.label}</span>
              <span className="legend-range">{cat.range}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

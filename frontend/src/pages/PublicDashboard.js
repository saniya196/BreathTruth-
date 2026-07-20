import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { getAqiColor, formatAqiLabel, AQI_CATEGORIES } from '../utils/aqiHelpers';

export default function PublicDashboard() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pincodeInput, setPincodeInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    fetchZones();
  }, []);

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

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = pincodeInput.trim();

    if (!/^\d{6}$/.test(trimmed)) {
      setSearchError('Enter a valid 6-digit pincode');
      return;
    }

    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const { data } = await axios.get(`/api/aqi/current/${trimmed}`);
      setSearchResult(data);
    } catch {
      setSearchError('Could not fetch data for this pincode. Try again shortly.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="page public-page">
      <div className="public-header">
        <h1>🌬️ BreathTruth — Live Community AQI</h1>
        <p>Real-time community-reported air quality across India. No login required.</p>
        <Link to="/register" className="btn-primary">Join & Contribute →</Link>
      </div>

      <form onSubmit={handleSearch} className="pincode-search">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter your 6-digit pincode"
          value={pincodeInput}
          onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className="btn-primary" disabled={searching}>
          {searching ? 'Checking…' : 'Check my area'}
        </button>
      </form>

      {searchError && <div className="public-search-error">{searchError}</div>}

      {searchResult && (
        <div
          className="zone-card public-search-result"
          style={{ borderTop: `4px solid ${getAqiColor(searchResult.aqi)}` }}
        >
          <div className="zone-header">
            <span className="zone-name">Pincode {pincodeInput.trim()}</span>
            <span className="zone-aqi" style={{ color: getAqiColor(searchResult.aqi) }}>
              {searchResult.aqi ?? '—'}
            </span>
          </div>
          <div className="zone-category" style={{ color: getAqiColor(searchResult.aqi) }}>
            {formatAqiLabel(searchResult.aqi)}
          </div>
          <p className="public-search-advisory">{searchResult.advisory?.text}</p>
          {searchResult.advisory?.precautions?.length > 0 && (
            <ul className="public-search-precautions">
              {searchResult.advisory.precautions.map((precaution, index) => (
                <li key={index}>{precaution}</li>
              ))}
            </ul>
          )}
          <div className="zone-meta public-search-meta">
            <span>Community: {searchResult.communityAqi ?? '—'}</span>
            <span>Official: {searchResult.officialAqi ?? '—'}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : zones.length === 0 ? (
        <div className="empty-state">
          <p>No community data yet. <Link to="/register">Be the first to report!</Link></p>
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

      <div className="public-legend">
        <h3>AQI Scale (India CPCB Standard)</h3>
        <div className="legend-grid">
          {Object.entries(AQI_CATEGORIES)
            .filter(([k]) => k !== 'unknown')
            .map(([key, cat]) => (
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

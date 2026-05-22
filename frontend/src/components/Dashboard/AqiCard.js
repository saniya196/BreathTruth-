import React from 'react';
import { getAqiColor, getAqiBg, formatAqiLabel, CONFIDENCE_LEVELS } from '../../utils/aqiHelpers';

export function AqiGauge({ aqi, label = 'AQI', size = 'lg' }) {
  const color = getAqiColor(aqi);
  const category = formatAqiLabel(aqi);
  const pct = aqi ? Math.min((aqi / 500) * 100, 100) : 0;

  return (
    <div className={`aqi-gauge aqi-gauge--${size}`} style={{ '--aqi-color': color, '--aqi-pct': `${pct}%` }}>
      <div className="aqi-gauge__ring">
        <svg viewBox="0 0 120 120" className="aqi-gauge__svg">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${pct * 3.14} 314`}
            strokeDashoffset="78.5"
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="aqi-gauge__value">
          <span className="aqi-number">{aqi || '—'}</span>
          <span className="aqi-label">{label}</span>
        </div>
      </div>
      <div className="aqi-category" style={{ color, background: getAqiBg(aqi) }}>
        {category}
      </div>
    </div>
  );
}

export function ConfidenceBadge({ score }) {
  const conf = CONFIDENCE_LEVELS[score] || CONFIDENCE_LEVELS.low;
  return (
    <span className="confidence-badge" style={{ color: conf.color, borderColor: conf.color }}>
      {conf.icon} {conf.label}
    </span>
  );
}

export function AnomalyBanner({ ratio, communityAqi, officialAqi }) {
  if (!ratio || ratio < 1.5) return null;
  return (
    <div className="anomaly-banner">
      <span className="anomaly-icon">⚠️</span>
      <div>
        <strong>Data Anomaly Detected</strong>
        <p>
          Community reports show <strong>{ratio.toFixed(1)}x higher</strong> pollution
          ({communityAqi} AQI) than the nearest official station ({officialAqi} AQI).
          Official monitoring may not reflect ground-level conditions here.
        </p>
      </div>
    </div>
  );
}

export function HealthAdvisory({ advisory, aqi }) {
  if (!advisory || !aqi) return null;
  const color = getAqiColor(aqi);

  return (
    <div className="health-advisory" style={{ borderLeftColor: color }}>
      <div className="advisory-header">
        <span className="advisory-icon">🏥</span>
        <strong>Health Advisory</strong>
      </div>
      <p className="advisory-text">{advisory.text}</p>
      {advisory.precautions?.length > 0 && (
        <ul className="advisory-list">
          {advisory.precautions.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AqiComparisonBar({ communityAqi, officialAqi, nearestStation = null }) {
  const maxVal = Math.max(communityAqi || 0, officialAqi || 0, 100);
  return (
    <div>
      <div className="comparison-bars">
        <div className="bar-row">
          <span className="bar-label">Community</span>
          <div className="bar-track">
            <div
              className="bar-fill bar-fill--community"
              style={{ width: `${((communityAqi || 0) / maxVal) * 100}%`, background: getAqiColor(communityAqi) }}
            />
          </div>
          <span className="bar-value">{communityAqi || '—'}</span>
        </div>
        <div className="bar-row">
          <span className="bar-label">Official</span>
          <div className="bar-track">
            <div
              className="bar-fill bar-fill--official"
              style={{ width: `${((officialAqi || 0) / maxVal) * 100}%`, background: '#94a3b8' }}
            />
          </div>
          <span className="bar-value">{officialAqi || '—'}</span>
        </div>
      </div>
      {nearestStation && (
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          marginTop: '8px',
          padding: '6px 10px',
          background: '#f3f4f6',
          borderRadius: '6px',
          borderLeft: '3px solid #818cf8'
        }}>
          No sensor found in pincode. Showing <strong>{nearestStation.stationName}</strong> (nearest available station) as reference.
        </p>
      )}
    </div>
  );
}

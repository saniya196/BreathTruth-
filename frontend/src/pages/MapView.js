import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getAqiColor, formatAqiLabel, AQI_CATEGORIES } from '../utils/aqiHelpers';

const INSTITUTION_ICONS = {
  school: '🏫',
  hospital: '🏥',
  old_age_home: '🏠',
  creche: '👶'
};

export default function MapView() {
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [showInstitutions, setShowInstitutions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState([17.385, 78.4867]);

  useEffect(() => {
    if (user?.pincode) {
      fetchMapData();
    }
  }, [user]);

  const fetchMapData = async () => {
    try {
      const [zonesResult, instResult] = await Promise.allSettled([
        axios.get('/api/map/zones'),
        axios.get(`/api/map/institutions/${user.pincode}`, {
          params: { locality: user.locality, city: user.city }
        })
      ]);

      if (zonesResult.status === 'fulfilled') {
        setZones(zonesResult.value.data.zones || []);
      }

      if (instResult.status === 'fulfilled') {
        const instData = instResult.value.data || {};
        setInstitutions(instData.institutions || []);
        if (instData?.center?.lat && instData?.center?.lng) {
          setMapCenter([instData.center.lat, instData.center.lng]);
        }
      } else {
        setInstitutions([]);
      }
    } catch (err) {
      console.error('Map data error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page map-page">
      <div className="page-header">
        <h1 className="page-title">Area AQI Map</h1>
        <p className="page-subtitle">Community-reported air quality zones with high-risk institutions</p>
      </div>

      {/* Map Controls */}
      <div className="map-controls">
        <label className="toggle-label">
          <input type="checkbox" checked={showInstitutions} onChange={e => setShowInstitutions(e.target.checked)} />
          Show Schools, Hospitals & Care Homes
        </label>
        <div className="legend">
          {Object.entries(AQI_CATEGORIES).filter(([k]) => k !== 'unknown').map(([key, cat]) => (
            <span key={key} className="legend-item">
              <span className="legend-dot" style={{ background: cat.color }} />
              {cat.label} ({cat.range})
            </span>
          ))}
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="map-container">
        <MapContainer
          key={`map-${mapCenter[0]}-${mapCenter[1]}`}
          center={mapCenter}
          zoom={12}
          style={{ height: '500px', borderRadius: '12px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* AQI Zone circles */}
          {zones.map((zone, i) => {
            const aqi = zone.communityAqi || zone.officialAqi;
            if (!aqi) return null;
            return (
              <CircleMarker
                key={i}
                center={[17.385 + (Math.random() - 0.5) * 0.1, 78.486 + (Math.random() - 0.5) * 0.1]}
                radius={aqi > 300 ? 28 : aqi > 200 ? 22 : aqi > 100 ? 18 : 14}
                fillColor={getAqiColor(aqi)}
                color={getAqiColor(aqi)}
                weight={2}
                opacity={0.8}
                fillOpacity={0.4}
              >
                <Tooltip permanent direction="center" className="aqi-tooltip">
                  <strong>{aqi}</strong>
                </Tooltip>
                <Popup>
                  <div className="map-popup">
                    <strong>{zone.locality}</strong>
                    <p>📊 Community AQI: <span style={{ color: getAqiColor(aqi) }}>{zone.communityAqi || '—'}</span></p>
                    <p>🏛️ Official AQI: {zone.officialAqi || '—'}</p>
                    <p>📋 Status: {formatAqiLabel(aqi)}</p>
                    <p>✅ Confidence: {zone.confidenceScore}</p>
                    {zone.anomalyFlagged && <p>⚠️ Anomaly: Community data diverges from official</p>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* User's pincode marker */}
          <CircleMarker
            center={mapCenter}
            radius={12}
            fillColor="#3b82f6"
            color="#1d4ed8"
            weight={3}
            fillOpacity={0.8}
          >
            <Tooltip permanent>📍 You</Tooltip>
          </CircleMarker>

          {/* Institution markers */}
          {showInstitutions && institutions.map((inst, i) => (
            <CircleMarker
              key={`inst-${i}`}
              center={[inst.lat, inst.lng]}
              radius={8}
              fillColor="#7c3aed"
              color="#5b21b6"
              weight={2}
              fillOpacity={0.9}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{INSTITUTION_ICONS[inst.type]} {inst.name}</strong>
                  <p>Type: {inst.type.replace('_', ' ')}</p>
                  <p>Address: {inst.address}</p>
                  <p className="popup-warning">⚠️ Vulnerable population — monitor AQI closely</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Institutions list */}
      {showInstitutions && institutions.length > 0 && (
        <div className="card institutions-card">
          <h3 className="card-title">High-Risk Institutions in Your Area</h3>
          <div className="institution-list">
            {institutions.map((inst, i) => (
              <div key={i} className="institution-row">
                <span className="inst-icon">{INSTITUTION_ICONS[inst.type]}</span>
                <div>
                  <strong>{inst.name}</strong>
                  <p>{inst.address}</p>
                </div>
                <span className="inst-type">{inst.type.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

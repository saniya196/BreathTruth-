import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getAqiColor, formatAqiLabel, AQI_CATEGORIES } from '../utils/aqiHelpers';

const INSTITUTION_ICONS = {
  school: '🏫',
  hospital: '🏥',
  college: '🎓',
  old_age_home: '🏠',
  creche: '👶'
};

const POI_COLORS = {
  school: '#3b82f6',
  hospital: '#ef4444',
  college: '#22c55e',
  old_age_home: '#f97316'
};

function hashString(value) {
  return String(value || '').split('').reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }, 0);
}

function getZoneMarkerCenter(zone, index, mapCenter) {
  if (zone?.lat && zone?.lng) return [zone.lat, zone.lng];

  const seed = hashString(`${zone?.pincode || ''}|${zone?.locality || ''}|${zone?.city || ''}|${index}`);
  const latOffset = ((seed & 0xff) / 255 - 0.5) * 0.08;
  const lngOffset = (((seed >> 8) & 0xff) / 255 - 0.5) * 0.08;
  return [mapCenter[0] + latOffset, mapCenter[1] + lngOffset];
}

async function geocodeCity(city) {
  if (!city) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},+India&format=json&limit=1`
    );
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const { lat, lon } = data[0];
      return [Number(lat), Number(lon)];
    }
  } catch {
    // Ignore city geocode failures and keep the current fallback center.
  }

  return null;
}

async function geocodePincode(pincode) {
  if (!pincode) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pincode)}&country=India&format=json&limit=1`
    );
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const { lat, lon } = data[0];
      return [Number(lat), Number(lon)];
    }
  } catch {
    // Ignore pincode geocode failures and fall back to city/default center.
  }

  return null;
}

async function fetchProfileLocation() {
  try {
    const { data } = await axios.get('/api/auth/me');
    return data?.user || null;
  } catch {
    return null;
  }
}

function normalizePoiType(tags = {}) {
  if (tags.amenity === 'school') return 'school';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'college') return 'college';
  if (tags.amenity === 'nursing_home') return 'old_age_home';
  if (tags.social_facility === 'assisted_living' || tags.social_facility === 'nursing_home') return 'old_age_home';
  return 'school';
}

export default function MapView() {
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [showInstitutions, setShowInstitutions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [mapCenter, setMapCenter] = useState([17.385, 78.4867]);

  const fetchMapData = async (center) => {
    setError('');
    try {
      // Fetch zones first (server-side cached data)
      try {
        const zonesResp = await axios.get('/api/map/zones', {
          params: { pincode: user.pincode, locality: user.locality, city: user.city }
        });
        setZones(zonesResp.data.zones || []);
      } catch (zErr) {
        // Non-fatal: continue to POI fetch/fallback
        console.warn('Zones fetch failed:', zErr?.message || zErr);
      }

      const lat = Number(center?.[0]);
      const lng = Number(center?.[1]);

      // Debug: ensure coordinates are valid before hitting Overpass
      console.log('Fetching POIs around:', lat, lng);

      // Guard clause — don't run Overpass if coordinates are invalid
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.error('Invalid coordinates, skipping POI fetch');
        const fallback = await axios.get(`/api/map/institutions/${user.pincode}`, {
          params: { locality: user.locality, city: user.city }
        });
        const fallbackInstitutions = fallback.data?.institutions || [];
        setInstitutions(fallbackInstitutions);
        if (fallbackInstitutions.length === 0) {
          setError('No nearby institutions were found for this area yet.');
        }
      } else {
        try {
          const { data } = await axios.get(`/api/map/institutions/${user.pincode}`, {
            params: { locality: user.locality, city: user.city }
          });

          const backendInstitutions = data?.institutions || [];
          const poiData = backendInstitutions
            .map((institution, index) => ({
              id: institution.id || `${institution.name || 'inst'}-${index}`,
              type: institution.type || 'school',
              name: institution.name || 'Unnamed place',
              address: institution.address || institution.name || 'Location details unavailable',
              lat: Number(institution.lat),
              lng: Number(institution.lng)
            }))
            .filter((institution) => Number.isFinite(institution.lat) && Number.isFinite(institution.lng));

          setInstitutions(poiData);

          if (poiData.length === 0) {
            setError('No nearby institutions were found for this area yet.');
          }
        } catch (fetchErr) {
          console.error('Institution fetch failed:', fetchErr);
          const fallback = await axios.get(`/api/map/institutions/${user.pincode}`, {
            params: { locality: user.locality, city: user.city }
          });
          const fallbackInstitutions = fallback.data?.institutions || [];
          setInstitutions(fallbackInstitutions);
          if (fallbackInstitutions.length === 0) {
            setError('Unable to fetch nearby institutions right now.');
          }
        }
      }
    } catch (err) {
      console.error('Map data error:', err);
      setError(err.response?.data?.message || 'Unable to load map data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const resolveLocation = async () => {
      let center = null;

      // Prefer the registered pincode so map results always match the user's profile area.
      if (user?.pincode) {
        const pincodeCenter = await geocodePincode(user.pincode);
        if (pincodeCenter) {
          center = pincodeCenter;
          setMapCenter(center);
          setLocationNote(`Using your registered pincode: ${user.pincode}.`);
        }
      }

      if (!center) {
        const profile = await fetchProfileLocation();
        const cityName = [profile?.city, profile?.state].filter(Boolean).join(', ') || user?.city || user?.locality;

        if (cityName) {
          const geocoded = await geocodeCity(cityName);
          if (geocoded) {
            center = geocoded;
            setMapCenter(center);
            setLocationNote(`Using your registered city: ${cityName}.`);
          }
        }
      }

      if (!center) {
        center = mapCenter;
        setLocationNote('Using the default map center because pincode geocoding was unavailable.');
      }

      await fetchMapData(center);
    };

    if (user) {
      resolveLocation();
    }
  }, [user]);

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="page map-page">
      <div className="page-header">
        <h1 className="page-title">Area AQI Map</h1>
        <p className="page-subtitle">Your location: {user?.locality}, {user?.city} — Pincode {user?.pincode}</p>
        {locationNote && <p className="muted-text" style={{ marginTop: 8 }}>{locationNote}</p>}
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

      {error && (
        <div className="card" style={{ marginBottom: '16px', borderLeft: '4px solid #f59e0b' }}>
          <strong>Map note:</strong> {error}
        </div>
      )}

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
            const aqi = zone.communityAqi ?? zone.officialAqi;
            if (!aqi) return null;
            return (
              <CircleMarker
                key={i}
                center={getZoneMarkerCenter(zone, i, mapCenter)}
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

          {/* 5 km search radius */}
          <Circle
            center={mapCenter}
            radius={5000}
            pathOptions={{
              color: '#2563eb',
              fillColor: '#60a5fa',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '8 8'
            }}
          />

          {/* Institution markers */}
          {showInstitutions && institutions.map((inst, i) => (
            <CircleMarker
              key={`inst-${i}`}
              center={[inst.lat, inst.lng]}
              radius={8}
              fillColor={POI_COLORS[inst.type] || '#7c3aed'}
              color={POI_COLORS[inst.type] || '#5b21b6'}
              weight={2}
              fillOpacity={0.9}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{INSTITUTION_ICONS[inst.type] || '📍'} {inst.name}</strong>
                  <p>Type: {(inst.type || 'unknown').replace('_', ' ')}</p>
                  <p>Address: {inst.address || inst.name || 'Location details unavailable'}</p>
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
                <span className="inst-icon">{INSTITUTION_ICONS[inst.type] || '📍'}</span>
                <div>
                  <strong>{inst.name}</strong>
                  <p>{inst.address || inst.name || 'Location details unavailable'}</p>
                </div>
                <span className="inst-type">{(inst.type || 'unknown').replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInstitutions && !loading && institutions.length === 0 && (
        <div className="card institutions-card">
          <h3 className="card-title">High-Risk Institutions in Your Area</h3>
          <p className="muted-text">No institutions were returned for this area. Try another pincode or locality.</p>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
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
  if (tags.social_facility === 'assisted_living') return 'old_age_home';
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
      const query = `
    [out:json][timeout:25];
    (
      node["amenity"="school"](around:5000,${center[0]},${center[1]});
      node["amenity"="hospital"](around:5000,${center[0]},${center[1]});
      node["amenity"="college"](around:5000,${center[0]},${center[1]});
      node["social_facility"="assisted_living"](around:5000,${center[0]},${center[1]});
    );
    out body;
  `;

      const [zonesResult, instResult] = await Promise.allSettled([
        axios.get('/api/map/zones', {
          params: { pincode: user.pincode, locality: user.locality, city: user.city }
        }),
        fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query
        })
      ]);

      if (zonesResult.status === 'fulfilled') {
        setZones(zonesResult.value.data.zones || []);
      }

      if (instResult.status === 'fulfilled') {
        const overpassData = await instResult.value.json();
        const elements = Array.isArray(overpassData?.elements) ? overpassData.elements : [];
        const poiData = elements
          .map((element) => {
            const lat = element.lat ?? element.center?.lat;
            const lng = element.lon ?? element.center?.lon;
            if (lat == null || lng == null) return null;

            const tags = element.tags || {};
            const type = normalizePoiType(tags);
            return {
              id: element.id,
              type,
              name: tags.name || 'Unnamed place',
              address: tags['addr:full'] || tags['addr:street'] || tags['addr:city'] || 'Address not available',
              lat: Number(lat),
              lng: Number(lng)
            };
          })
          .filter(Boolean);

        setInstitutions(poiData);
        if (poiData.length === 0) {
          const fallback = await axios.get(`/api/map/institutions/${user.pincode}`, {
            params: { locality: user.locality, city: user.city }
          });
          const fallbackInstitutions = fallback.data?.institutions || [];
          setInstitutions(fallbackInstitutions);
          if (fallbackInstitutions.length === 0) {
            setError('No nearby institutions were found for this area yet.');
          }
        }
      } else {
        const fallback = await axios.get(`/api/map/institutions/${user.pincode}`, {
          params: { locality: user.locality, city: user.city }
        });
        const fallbackInstitutions = fallback.data?.institutions || [];
        setInstitutions(fallbackInstitutions);
        if (fallbackInstitutions.length === 0) {
          setError('Unable to fetch nearby institutions right now.');
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

      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 300000
            });
          });

          const { latitude, longitude, accuracy } = position.coords;
          center = [latitude, longitude];
          setMapCenter(center);
          setLocationNote(`Using your current location (accuracy ~${Math.round(accuracy)}m).`);
        } catch {
          center = null;
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
        setLocationNote('Using the default map center because browser location and city geocoding were unavailable.');
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
                  <p>Address: {inst.address || 'Address not available'}</p>
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
                  <p>{inst.address || 'Address not available'}</p>
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

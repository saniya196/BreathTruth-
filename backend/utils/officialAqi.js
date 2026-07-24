const axios = require('axios');

const WAQI_TOKEN = process.env.WAQI_TOKEN || 'demo';
const geocodeCache = new Map();

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

async function geocodeQuery(query) {
  const normalized = normalizeText(query);
  if (!normalized) return null;
  if (geocodeCache.has(normalized)) return geocodeCache.get(normalized);

  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        format: 'jsonv2',
        q: query,
        limit: 1,
        countrycodes: 'in'
      },
      headers: {
        'User-Agent': 'BreathTruth/1.0 (waqi-official-aqi)'
      },
      timeout: 12000
    });

    if (Array.isArray(data) && data.length > 0) {
      const hit = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      geocodeCache.set(normalized, hit);
      return hit;
    }
  } catch {
    // ignore and let callers try the next query
  }

  geocodeCache.set(normalized, null);
  return null;
}

async function resolveAreaCoordinates(location = {}) {
  const { pincode, locality, city } = location;

  // Structured postal code lookup is far more reliable than free-text search
  // for Indian pincodes, especially smaller towns — try this first.
  if (pincode) {
    try {
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { postalcode: pincode, country: 'India', format: 'jsonv2', limit: 1 },
        headers: { 'User-Agent': 'BreathTruth/1.0 (waqi-official-aqi)' },
        timeout: 12000
      });
      if (Array.isArray(data) && data.length > 0) {
        const hit = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        console.log('DEBUG structured geocode hit:', hit); // temporary
        return hit;
      }
    } catch (err) {
      console.log('DEBUG structured geocode failed:', err.message); // temporary
    }
  }

  const queries = [
    `${pincode || ''} ${locality || ''} ${city || ''} India`.trim(),
    `${locality || ''} ${city || ''} India`.trim(),
    `${pincode || ''} ${city || ''} India`.trim(),
    `${city || ''} India`.trim(),
    `${locality || ''} India`.trim(),
    `${pincode || ''} India`.trim()
  ].filter(Boolean);

  for (const query of queries) {
    const coords = await geocodeQuery(query);
    if (coords) return coords;
  }

  return null;
}

function buildWaqiResult(feedData, targetCoordinates = null) {
  const station = feedData?.city?.name || 'Nearest station';
  const aqi = Number(feedData?.aqi);
  const geo = Array.isArray(feedData?.city?.geo) ? feedData.city.geo : null;
  const stationLat = geo?.[0] != null ? Number(geo[0]) : targetCoordinates?.lat ?? null;
  const stationLon = geo?.[1] != null ? Number(geo[1]) : targetCoordinates?.lng ?? null;

  return {
    aqi: Number.isFinite(aqi) ? aqi : null,
    source: 'WAQI',
    station,
    stations: [
      {
        station,
        aqi: Number.isFinite(aqi) ? aqi : null,
        pollutants: [
          { pollutant: 'pm25', value: feedData?.iaqi?.pm25?.v ?? null },
          { pollutant: 'pm10', value: feedData?.iaqi?.pm10?.v ?? null },
          { pollutant: 'no2', value: feedData?.iaqi?.no2?.v ?? null },
          { pollutant: 'so2', value: feedData?.iaqi?.so2?.v ?? null },
          { pollutant: 'co', value: feedData?.iaqi?.co?.v ?? null },
          { pollutant: 'o3', value: feedData?.iaqi?.o3?.v ?? null }
        ].filter(item => item.value != null),
        coords: stationLat != null && stationLon != null ? { lat: stationLat, lng: stationLon } : null
      }
    ],
    nearestStation: {
      station,
      aqi: Number.isFinite(aqi) ? aqi : null,
      coords: stationLat != null && stationLon != null ? { lat: stationLat, lng: stationLon } : null
    },
    targetCoordinates
  };
}

async function fetchWaqiAqi(location = {}, fallbackCity = null) {
  const target = await resolveAreaCoordinates(location);
  const cityName = location.city || fallbackCity || location.locality || location.pincode || '';
  const geocodeCity = target || (await resolveAreaCoordinates({ city: cityName }));

  if (!geocodeCity) return null;

  const url = `https://api.waqi.info/feed/geo:${geocodeCity.lat};${geocodeCity.lng}/?token=${WAQI_TOKEN}`;
  const { data } = await axios.get(url, { timeout: 12000 });
  console.log('DEBUG WAQI raw response:', JSON.stringify(data)); // temporary

  if (data?.status !== 'ok' || !data?.data) return null;
  return buildWaqiResult(data.data, geocodeCity);
}

async function fetchOfficialAqi(city, targetLocation = null) {
  if (!city && !targetLocation) return null;
  return fetchWaqiAqi({ city }, targetLocation);
}

async function fetchNearestOfficialAqi(location = {}, fallbackCity = null) {
  const target = await resolveAreaCoordinates(location);
  const city = location.city || fallbackCity || null;

  if (!target && !city) return null;
  return fetchWaqiAqi({ ...location, city }, target);
}

async function fetchOfficialAqiWithFallback(locationOrCity, fallbackCity = null) {
  const location = typeof locationOrCity === 'string'
    ? { city: locationOrCity }
    : (locationOrCity || {});

  const primary = await fetchNearestOfficialAqi(location, fallbackCity);
  if (primary) return primary;

  const normalizedFallback = normalizeText(fallbackCity);
  if (!normalizedFallback || normalizeText(location.city) === normalizedFallback) return null;

  return fetchNearestOfficialAqi({ ...location, city: fallbackCity }, fallbackCity);
}

module.exports = { fetchOfficialAqi, fetchOfficialAqiWithFallback, fetchNearestOfficialAqi };

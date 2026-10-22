const axios = require('axios');

// No silent 'demo' fallback: the demo key only serves a tiny set of stations, which
// makes the official card show N/A in production with no visible error.
// Read lazily so the value is correct regardless of require/dotenv order.
const getWaqiToken = () => process.env.WAQI_TOKEN || null;
// When several attempts fail (primary lookup, then city fallback), report the most
// actionable reason rather than whichever happened first: a config/service problem
// (bad token, WAQI down) outranks a data problem (geocoding, offline station).
const REASON_PRIORITY = {
  missing_token: 5, waqi_rejected: 4, waqi_timeout: 3, waqi_unreachable: 3,
  station_has_no_aqi: 2, geocode_failed: 1, no_location: 0
};
const fail = (diag, reason) => {
  if (diag && (!diag.reason || (REASON_PRIORITY[reason] ?? -1) > (REASON_PRIORITY[diag.reason] ?? -1))) {
    diag.reason = reason;
  }
  return null;
};
// WAQI sends aqi as a number, or "-" for offline stations. Number(null) and Number('')
// are 0, which would turn "no data" into a fake AQI of 0, so parse explicitly.
const parseAqi = (value) => {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
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
  } catch (err) {
    console.warn('[officialAqi] geocode failed:', err.message);
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
        return hit;
      }
    } catch (err) {
      console.warn('[officialAqi] structured geocode failed:', err.message);
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
  const aqi = parseAqi(feedData?.aqi);
  const geo = Array.isArray(feedData?.city?.geo) ? feedData.city.geo : null;
  const stationLat = geo?.[0] != null ? Number(geo[0]) : targetCoordinates?.lat ?? null;
  const stationLon = geo?.[1] != null ? Number(geo[1]) : targetCoordinates?.lng ?? null;

  return {
    aqi,
    source: 'WAQI',
    station,
    stations: [
      {
        station,
        aqi,
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
      aqi,
      coords: stationLat != null && stationLon != null ? { lat: stationLat, lng: stationLon } : null
    },
    targetCoordinates
  };
}

async function fetchWaqiAqi(location = {}, fallbackCity = null, diag = null) {
  const token = getWaqiToken();
  if (!token) {
    console.error('[officialAqi] WAQI_TOKEN is not set in this environment');
    return fail(diag, 'missing_token');
  }

  const target = await resolveAreaCoordinates(location);
  const cityName = location.city || fallbackCity || location.locality || location.pincode || '';
  const geocodeCity = target || (await resolveAreaCoordinates({ city: cityName }));

  if (!geocodeCity) return fail(diag, 'geocode_failed');

  let data;
  try {
    ({ data } = await axios.get('https://api.waqi.info/feed/geo:' + geocodeCity.lat + ';' + geocodeCity.lng + '/', {
      params: { token },
      timeout: 12000
    }));
  } catch (err) {
    console.error('[officialAqi] WAQI request failed:', err.code || err.message);
    return fail(diag, err.code === 'ECONNABORTED' ? 'waqi_timeout' : 'waqi_unreachable');
  }

  if (data?.status !== 'ok' || !data?.data) {
    // WAQI reports bad/over-quota keys as { status: 'error', data: '<message>' }
    console.error('[officialAqi] WAQI returned status=%s message=%s', data?.status, typeof data?.data === 'string' ? data.data : data?.data?.message);
    return fail(diag, 'waqi_rejected');
  }

  const result = buildWaqiResult(data.data, geocodeCity);
  if (result.aqi == null) return fail(diag, 'station_has_no_aqi'); // WAQI sends aqi: "-" when a station is offline
  return result;
}

async function fetchOfficialAqi(city, targetLocation = null, diag = null) {
  if (!city && !targetLocation) return null;
  return fetchWaqiAqi({ city }, targetLocation, diag);
}

async function fetchNearestOfficialAqi(location = {}, fallbackCity = null, diag = null) {
  const target = await resolveAreaCoordinates(location);
  const city = location.city || fallbackCity || null;

  if (!target && !city) {
    // We had something to look up (e.g. a pincode) but could not resolve it, which is a
    // geocoding failure; 'no_location' is only for requests that carried no location at all.
    const hadInput = Boolean(location.pincode || location.locality || location.city);
    return fail(diag, hadInput ? 'geocode_failed' : 'no_location');
  }
  return fetchWaqiAqi({ ...location, city }, target, diag);
}

async function fetchOfficialAqiWithFallback(locationOrCity, fallbackCity = null, diag = null) {
  const location = typeof locationOrCity === 'string'
    ? { city: locationOrCity }
    : (locationOrCity || {});

  const primary = await fetchNearestOfficialAqi(location, fallbackCity, diag);
  if (primary) return primary;

  const normalizedFallback = normalizeText(fallbackCity);
  if (!normalizedFallback || normalizeText(location.city) === normalizedFallback) return null;

  const secondary = await fetchNearestOfficialAqi({ ...location, city: fallbackCity }, fallbackCity, diag);
  if (secondary && diag) delete diag.reason; // a later attempt succeeded; drop the stale failure reason
  return secondary;
}

module.exports = { fetchOfficialAqi, fetchOfficialAqiWithFallback, fetchNearestOfficialAqi };

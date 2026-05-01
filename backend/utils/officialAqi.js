const axios = require('axios');

const CPCB_API_URL = process.env.CPCB_API_URL || 'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';
const CPCB_API_KEY = process.env.CPCB_API_KEY;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractAqi(record = {}) {
  const candidates = [record.aqi, record.AQI, record.aqi_value, record.aqiValue, record.current_aqi];
  for (const candidate of candidates) {
    const numeric = toNumber(candidate);
    if (numeric !== null) return numeric;
  }
  return null;
}

function normalizeCity(city) {
  return String(city || '').trim().toLowerCase();
}

function buildStations(records, city) {
  const cityNorm = normalizeCity(city);
  const stations = records
    .map((record) => {
      const recordCity = normalizeCity(record.city || record.city_name || record.City);
      return {
        station: record.station || record.station_name || record.stn_name || record.city || city,
        aqi: extractAqi(record),
        recordCity
      };
    })
    .filter((entry) => entry.aqi !== null)
    .filter((entry) => !cityNorm || entry.recordCity === cityNorm);

  if (stations.length === 0) return null;

  const aqi = Math.round(stations.reduce((sum, entry) => sum + entry.aqi, 0) / stations.length);
  return {
    aqi,
    source: 'CPCB',
    station: stations[0].station,
    stations: stations.map(({ station, aqi }) => ({ station, aqi }))
  };
}

async function fetchCpcbAqi(city) {
  if (!city) return null;

  if (!CPCB_API_KEY) {
    console.warn('CPCB_API_KEY missing. Official AQI cannot be fetched.');
    return null;
  }

  const attempts = [
    { 'api-key': CPCB_API_KEY, format: 'json', limit: 100, 'filters[city]': city },
    { 'api-key': CPCB_API_KEY, format: 'json', limit: 100, filters: `[city=${city}]` },
    { 'api-key': CPCB_API_KEY, format: 'json', limit: 100, city }
  ];

  for (const params of attempts) {
    try {
      const { data } = await axios.get(CPCB_API_URL, { params, timeout: 9000 });
      const records = Array.isArray(data?.records) ? data.records : [];
      const parsed = buildStations(records, city);
      if (parsed) return parsed;
    } catch (err) {
      if (err.response?.status && err.response.status < 500) continue;
      throw err;
    }
  }

  // Fallback: fetch unfiltered and filter locally by city.
  try {
    const { data } = await axios.get(CPCB_API_URL, {
      params: { 'api-key': CPCB_API_KEY, format: 'json', limit: 500 },
      timeout: 9000
    });
    const records = Array.isArray(data?.records) ? data.records : [];
    return buildStations(records, city);
  } catch (err) {
    if (err.response?.status && err.response.status < 500) return null;
    throw err;
  }
}

async function fetchOfficialAqi(city) {
  try {
    const cpcb = await fetchCpcbAqi(city);
    if (cpcb) return cpcb;
  } catch (err) {
    console.warn('CPCB fetch failed:', err.message);
  }

  return null;
}

module.exports = { fetchOfficialAqi };
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

async function fetchCpcbAqi(city) {
  if (!city) return null;

  const { data } = await axios.get(CPCB_API_URL, {
    params: {
      'api-key': CPCB_API_KEY,
      format: 'json',
      filters: `[city=${city}]`,
      limit: 10
    },
    timeout: 8000
  });

  const records = Array.isArray(data?.records) ? data.records : [];
  const stations = records
    .map((record) => ({
      station: record.station || record.station_name || record.stn_name || record.city || city,
      aqi: extractAqi(record)
    }))
    .filter((entry) => entry.aqi !== null);

  if (stations.length === 0) return null;

  const aqi = Math.round(stations.reduce((sum, entry) => sum + entry.aqi, 0) / stations.length);
  return {
    aqi,
    source: 'CPCB',
    station: stations[0].station,
    stations: stations.map(({ station, aqi }) => ({ station, aqi }))
  };
}

async function fetchWaqiFallback(city) {
  if (!city) return null;

  const { data } = await axios.get(`https://api.waqi.info/feed/${encodeURIComponent(city)}/`, {
    params: { token: 'demo' },
    timeout: 8000
  });

  if (data?.status !== 'ok') return null;

  const aqi = toNumber(data?.data?.aqi);
  if (aqi === null) return null;

  return {
    aqi,
    source: 'WAQI demo',
    station: data?.data?.city?.name || city,
    stations: [{ station: data?.data?.city?.name || city, aqi }]
  };
}

async function fetchOfficialAqi(city) {
  try {
    const cpcb = await fetchCpcbAqi(city);
    if (cpcb) return cpcb;
  } catch (err) {
    console.warn('CPCB fetch failed, trying public fallback:', err.message);
  }

  try {
    const fallback = await fetchWaqiFallback(city);
    if (fallback) return fallback;
  } catch (err) {
    console.warn('Public AQI fallback failed:', err.message);
  }

  return null;
}

module.exports = { fetchOfficialAqi };
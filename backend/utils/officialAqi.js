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

// AQI computation helpers: use CPCB-style breakpoints to compute AQI from pollutant concentration
function computeAqiFromPollutant(pollutant, concentration) {
  const key = String(pollutant || '').toLowerCase();
  const c = Number(concentration);
  if (!Number.isFinite(c)) return null;

  const breakpoints = {
    'pm2.5': [
      { c_lo: 0, c_hi: 30, i_lo: 0, i_hi: 50 },
      { c_lo: 31, c_hi: 60, i_lo: 51, i_hi: 100 },
      { c_lo: 61, c_hi: 90, i_lo: 101, i_hi: 200 },
      { c_lo: 91, c_hi: 120, i_lo: 201, i_hi: 300 },
      { c_lo: 121, c_hi: 250, i_lo: 301, i_hi: 400 },
      { c_lo: 251, c_hi: 500, i_lo: 401, i_hi: 500 }
    ],
    'pm10': [
      { c_lo: 0, c_hi: 50, i_lo: 0, i_hi: 50 },
      { c_lo: 51, c_hi: 100, i_lo: 51, i_hi: 100 },
      { c_lo: 101, c_hi: 250, i_lo: 101, i_hi: 200 },
      { c_lo: 251, c_hi: 350, i_lo: 201, i_hi: 300 },
      { c_lo: 351, c_hi: 430, i_lo: 301, i_hi: 400 },
      { c_lo: 431, c_hi: 1000, i_lo: 401, i_hi: 500 }
    ],
    'no2': [
      { c_lo: 0, c_hi: 40, i_lo: 0, i_hi: 50 },
      { c_lo: 41, c_hi: 80, i_lo: 51, i_hi: 100 },
      { c_lo: 81, c_hi: 180, i_lo: 101, i_hi: 200 },
      { c_lo: 181, c_hi: 280, i_lo: 201, i_hi: 300 },
      { c_lo: 281, c_hi: 400, i_lo: 301, i_hi: 400 },
      { c_lo: 401, c_hi: 1000, i_lo: 401, i_hi: 500 }
    ],
    'so2': [
      { c_lo: 0, c_hi: 40, i_lo: 0, i_hi: 50 },
      { c_lo: 41, c_hi: 80, i_lo: 51, i_hi: 100 },
      { c_lo: 81, c_hi: 380, i_lo: 101, i_hi: 200 },
      { c_lo: 381, c_hi: 800, i_lo: 201, i_hi: 300 },
      { c_lo: 801, c_hi: 1600, i_lo: 301, i_hi: 400 },
      { c_lo: 1601, c_hi: 10000, i_lo: 401, i_hi: 500 }
    ],
    'co': [
      { c_lo: 0, c_hi: 1, i_lo: 0, i_hi: 50 },
      { c_lo: 1.1, c_hi: 2, i_lo: 51, i_hi: 100 },
      { c_lo: 2.1, c_hi: 10, i_lo: 101, i_hi: 200 },
      { c_lo: 10.1, c_hi: 17, i_lo: 201, i_hi: 300 },
      { c_lo: 17.1, c_hi: 34, i_lo: 301, i_hi: 400 },
      { c_lo: 34.1, c_hi: 1000, i_lo: 401, i_hi: 500 }
    ],
    'o3': [
      { c_lo: 0, c_hi: 50, i_lo: 0, i_hi: 50 },
      { c_lo: 51, c_hi: 100, i_lo: 51, i_hi: 100 },
      { c_lo: 101, c_hi: 168, i_lo: 101, i_hi: 200 },
      { c_lo: 169, c_hi: 208, i_lo: 201, i_hi: 300 },
      { c_lo: 209, c_hi: 748, i_lo: 301, i_hi: 400 },
      { c_lo: 749, c_hi: 10000, i_lo: 401, i_hi: 500 }
    ]
  };
  // alias
  breakpoints['pm25'] = breakpoints['pm2.5'];

  // Normalize pollutant key variations
  let p = key.replace(/\s|\./g, '');
  if (p === 'pm25') p = 'pm2.5';

  const table = breakpoints[p];
  if (!table) return null;

  for (const bp of table) {
    if (c >= bp.c_lo && c <= bp.c_hi) {
      // linear interpolation
      const { c_lo, c_hi, i_lo, i_hi } = bp;
      const aqi = ((i_hi - i_lo) / (c_hi - c_lo)) * (c - c_lo) + i_lo;
      return Math.round(aqi);
    }
  }

  return null;
}

function normalizeCity(city) {
  return String(city || '').trim().toLowerCase();
}

function buildStations(records, city) {
  const cityNorm = normalizeCity(city);
  // Group records by station and compute per-station AQI (max pollutant AQI)
  const stationMap = new Map();

  for (const record of records) {
    const recordCity = normalizeCity(record.city || record.city_name || record.City);
    if (cityNorm && recordCity !== cityNorm) continue;

    const stationName = record.station || record.station_name || record.stn_name || record.city || city || 'unknown';
    const pollutantRaw = (record.pollutant || record.pollutant_id || record.pollutantId || '').toString().trim();
    const pollutant = pollutantRaw || '';
    const avg = toNumber(record.avg_value || record.aqi_value || record.aqiValue || record.current_aqi || record.avgValue || record.avg);
    let pollutantAqi = extractAqi(record);
    let computed = false;
    if (pollutantAqi === null && pollutant && avg !== null) {
      const computedA = computeAqiFromPollutant(pollutant, avg);
      if (computedA !== null) {
        pollutantAqi = computedA;
        computed = true;
      }
    }

    if (pollutantAqi === null) continue;

    if (!stationMap.has(stationName)) stationMap.set(stationName, []);
    stationMap.get(stationName).push({ pollutant: pollutant || 'unknown', concentration: avg, aqi: pollutantAqi, computed });
  }

  const stations = [];
  for (const [station, pollutants] of stationMap.entries()) {
    if (!pollutants || pollutants.length === 0) continue;
    const stationAqi = pollutants.reduce((max, p) => Math.max(max, p.aqi || 0), 0);
    stations.push({ station, aqi: stationAqi, pollutants });
  }

  if (stations.length === 0) return null;

  const overallAqi = Math.round(stations.reduce((sum, s) => sum + s.aqi, 0) / stations.length);
  return {
    aqi: overallAqi,
    source: 'CPCB',
    station: stations[0].station,
    stations: stations.map(({ station, aqi, pollutants }) => ({ station, aqi, pollutants }))
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
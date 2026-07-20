// Shared geocoding helpers — used by both the map (institutions/zones) and
// report submission (coordinate-mismatch flagging), so there's one
// implementation hitting Nominatim instead of two that can drift apart.
const { nominatimGet } = require('./nominatim');
const AqiAggregate = require('../models/AqiAggregate');

const geocodeCache = new Map();

async function geocodeArea({ pincode, locality, city }) {
  const cacheKey = `${pincode || ''}|${locality || ''}|${city || ''}`.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const queries = [
    `${pincode || ''} ${locality || ''} ${city || ''} India`.trim(),
    `${locality || ''} ${city || ''} India`.trim(),
    `${pincode || ''} ${city || ''} India`.trim(),
    `${city || ''} India`.trim(),
    `${locality || ''} India`.trim(),
    `${pincode || ''} India`.trim()
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const { data } = await nominatimGet('https://nominatim.openstreetmap.org/search', {
        params: { format: 'jsonv2', q: query, limit: 1, countrycodes: 'in' },
        headers: { 'User-Agent': 'BreathTruth/1.0 (community-aqi-map)' },
        timeout: 12000
      });
      if (Array.isArray(data) && data.length > 0) {
        const hit = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        geocodeCache.set(cacheKey, hit);
        return hit;
      }
    } catch (err) {
      console.debug('geocodeArea query failed:', query, err.message || err);
    }
  }

  if (pincode) {
    try {
      const latest = await AqiAggregate.findOne({ pincode }).sort({ date: -1 }).select('locality city');
      if (latest?.locality || latest?.city) {
        const fallbackQueries = [
          `${pincode || ''} ${latest.locality || ''} ${latest.city || ''} India`.trim(),
          `${latest.locality || ''} ${latest.city || ''} India`.trim(),
          `${latest.city || ''} India`.trim()
        ].filter(Boolean);

        for (const query of fallbackQueries) {
          try {
            const { data } = await nominatimGet('https://nominatim.openstreetmap.org/search', {
              params: { format: 'jsonv2', q: query, limit: 1, countrycodes: 'in' },
              headers: { 'User-Agent': 'BreathTruth/1.0 (community-aqi-map)' },
              timeout: 12000
            });
            if (Array.isArray(data) && data.length > 0) {
              const hit = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
              geocodeCache.set(cacheKey, hit);
              return hit;
            }
          } catch (err) {
            console.debug('geocodeArea fallback query failed:', query, err.message || err);
          }
        }
      }
    } catch (err) {
      console.debug('geocodeArea stored-location lookup failed:', err.message || err);
    }
  }

  return null;
}

async function geocodeByPincode(pincode) {
  if (!pincode) return null;
  const cacheKey = `pc|${pincode}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  try {
    const { data } = await nominatimGet('https://nominatim.openstreetmap.org/search', {
      params: { postalcode: pincode, country: 'India', format: 'json', limit: 1 },
      headers: { 'User-Agent': 'BreathTruth/1.0 (community-aqi-map)' },
      timeout: 12000
    });
    if (Array.isArray(data) && data.length > 0) {
      const hit = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      geocodeCache.set(cacheKey, hit);
      return hit;
    }
  } catch (err) {
    console.debug('geocodeByPincode failed:', err.message || err);
  }

  return null;
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { geocodeArea, geocodeByPincode, haversineDistanceMeters };

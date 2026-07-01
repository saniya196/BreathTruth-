// routes/map.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const AqiAggregate = require('../models/AqiAggregate');
const { nominatimGet } = require('../utils/nominatim');

const INSTITUTION_RADIUS_METERS = 3000;
const MAX_INSTITUTIONS = 150;
const geocodeCache = new Map();
const addressCache = new Map();
const overpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

// Nominatim throttling/retry logic now lives in utils/nominatim.js and is
// shared with utils/aggregator.js (used there to geocode aggregates for the
// map heatmap). Keeping one shared throttle here instead of two separate
// ones ensures the real combined request rate against Nominatim's public
// servers stays under their ~1 req/sec policy regardless of which part of
// the app triggers a lookup.

async function fetchOverpassData(overpassQuery) {
  const attempts = [
    {
      data: `data=${encodeURIComponent(overpassQuery)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    {
      data: overpassQuery,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
    },
  ];

  let lastError = null;
  for (const endpoint of overpassEndpoints) {
    for (const attempt of attempts) {
      try {
        const { data } = await axios.post(endpoint, attempt.data, {
          headers: {
            ...attempt.headers,
            Accept: 'application/json',
            'User-Agent': 'BreathTruth/1.0 (community-aqi-map)'
          },
          timeout: 20000
        });
        return data;
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError;
}

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
        params: {
          format: 'jsonv2',
          q: query,
          limit: 1,
          countrycodes: 'in'
        },
        headers: {
          'User-Agent': 'BreathTruth/1.0 (community-aqi-map)'
        },
        timeout: 12000
      });

      if (Array.isArray(data) && data.length > 0) {
        const hit = {
          lat: Number(data[0].lat),
          lng: Number(data[0].lon)
        };
        geocodeCache.set(cacheKey, hit);
        return hit;
      }
    } catch (err) {
      console.debug('geocodeArea query failed:', query, err.message || err);
      // Try next query variant.
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
              params: {
                format: 'jsonv2',
                q: query,
                limit: 1,
                countrycodes: 'in'
              },
              headers: {
                'User-Agent': 'BreathTruth/1.0 (community-aqi-map)'
              },
              timeout: 12000
            });

            if (Array.isArray(data) && data.length > 0) {
              const hit = {
                lat: Number(data[0].lat),
                lng: Number(data[0].lon)
              };
              geocodeCache.set(cacheKey, hit);
              return hit;
            }
          } catch (err) {
            console.debug('geocodeArea fallback query failed:', query, err.message || err);
            // Try next stored-location fallback query.
          }
        }
      }
    } catch (err) {
      console.debug('geocodeArea stored-location lookup failed:', err.message || err);
      // Ignore lookup failures and return null below.
    }
  }

  return null;
}

// Fallback: try postalcode-style geocoding (some hosts respond better to this)
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
    // Ignore and return null below
    console.debug('geocodeByPincode failed:', err.message || err);
  }

  return null;
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceLabel(meters) {
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

function normalizeInstitutionType(tags = {}) {
  const amenity = tags.amenity;
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') return 'hospital';
  if (amenity === 'school' || amenity === 'kindergarten') return 'school';
  if (amenity === 'college' || amenity === 'university') return 'college';
  if (amenity === 'nursing_home' || amenity === 'social_facility') return 'old_age_home';
  return 'school';
}

function formatInstitutionAddress(tags = {}) {
  const fullAddress = tags['addr:full'];
  if (fullAddress) return fullAddress;

  const streetLine = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:locality'],
    tags['addr:suburb']
  ].filter(Boolean).join(' ');

  const cityLine = [
    tags['addr:city'],
    tags['addr:district'],
    tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean).join(', ');

  const parts = [streetLine, cityLine].filter(Boolean);
  if (parts.length > 0) return parts.join(' • ');

  const localityFallback = [tags['addr:suburb'], tags['addr:city'], tags['addr:district']].filter(Boolean).join(', ');
  if (localityFallback) return `Near ${localityFallback}`;

  return tags.name || 'Address not available';
}

async function reverseGeocodeAddress(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (addressCache.has(cacheKey)) return addressCache.get(cacheKey);

  try {
    const { data } = await nominatimGet('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'jsonv2',
        lat,
        lon: lng,
        zoom: 18,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'BreathTruth/1.0 (community-aqi-map)'
      },
      timeout: 12000
    });

    const address = data?.address || {};
    const parts = [
      data?.name,
      address.house_number,
      address.road,
      address.suburb,
      address.neighbourhood,
      address.city || address.town || address.village,
      address.district,
      address.state,
      address.postcode
    ].filter(Boolean);

    const resolved = parts.length > 0 ? parts.join(', ') : data?.display_name || null;
    addressCache.set(cacheKey, resolved);
    return resolved;
  } catch (err) {
    console.debug('reverseGeocodeAddress failed:', err.message || err);
    addressCache.set(cacheKey, null);
    return null;
  }
}

async function fetchInstitutionsNear(center) {
  const query = `
    [out:json][timeout:25];
    (
      nwr(around:${INSTITUTION_RADIUS_METERS},${center.lat},${center.lng})[amenity~"school|college|kindergarten|hospital|clinic|doctors|nursing_home|social_facility"];
    );
    out center tags;
  `;
  let data;
  try {
    data = await fetchOverpassData(query);
  } catch (err) {
    console.error('Overpass fetch failed for institutions:', err?.message || err);
    data = { elements: [] };
  }

  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const institutions = elements
    .map(async (el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) return null;

      const tags = el.tags || {};
      const tagAddress = formatInstitutionAddress(tags);
      const resolvedAddress = tagAddress !== 'Address not available'
        ? tagAddress
        : (await reverseGeocodeAddress(Number(lat), Number(lng))) || tagAddress;

      const distanceMeters = haversineDistanceMeters(center.lat, center.lng, Number(lat), Number(lng));

      return {
        type: normalizeInstitutionType(tags),
        name: tags.name || 'Unnamed Institution',
        address: resolvedAddress,
        lat: Number(lat),
        lng: Number(lng),
        distanceMeters: Math.round(distanceMeters),
        distanceLabel: formatDistanceLabel(distanceMeters)
      };
    })
    .filter(Boolean);

  const resolved = (await Promise.all(institutions)).filter(Boolean);
  resolved.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return resolved.slice(0, MAX_INSTITUTIONS);
}

// Get all areas with today's AQI for the map overlay
router.get('/zones', async (req, res) => {
  try {
    const { pincode, locality = '', city = '' } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filter = { date: { $gte: today } };
    if (pincode) filter.pincode = pincode;
    else if (locality) filter.locality = new RegExp(`^${locality}$`, 'i');
    else if (city) filter.city = new RegExp(`^${city}$`, 'i');

    const zones = await AqiAggregate.find(filter)
      .select('pincode locality city lat lng communityAqi officialAqi confidenceScore anomalyFlagged')
      .sort({ communityAqi: -1, officialAqi: -1 });
    res.json({ zones });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// High-risk institutions near a pincode/locality using live OSM data.
router.get('/institutions/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    const { locality = '', city = '' } = req.query;

    const center = await geocodeArea({ pincode, locality, city });
      let resolvedCenter = center;
      if (!resolvedCenter && pincode) {
        // Try postal-code geocode fallback (some environments respond better to postalcode param)
        resolvedCenter = await geocodeByPincode(pincode);
      }

      if (!resolvedCenter) {
        return res.json({
          message: 'Could not locate this area for institution lookup yet. Try a more specific locality or city.',
          institutions: []
        });
      }

    const institutions = await fetchInstitutionsNear(resolvedCenter);
    if (institutions.length === 0) {
      return res.json({
        message: 'No nearby institutions were found for this area yet.',
        institutions,
        center: resolvedCenter
      });
    }

    return res.json({ institutions, center: resolvedCenter });
  } catch (err) {
    console.error('Map institutions lookup failed:', err.message);
    return res.json({
      message: 'Unable to fetch nearby institutions right now. Please try again shortly.',
      error: err.message,
      institutions: []
    });
  }
});

module.exports = router;
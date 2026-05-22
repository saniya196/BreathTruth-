// routes/map.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const AqiAggregate = require('../models/AqiAggregate');

const INSTITUTION_RADIUS_METERS = 5000;
const MAX_INSTITUTIONS = 50;
const geocodeCache = new Map();
const addressCache = new Map();

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
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
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
    } catch {
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
            const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
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
          } catch {
            // Try next stored-location fallback query.
          }
        }
      }
    } catch {
      // Ignore lookup failures and return null below.
    }
  }

  return null;
}

function normalizeInstitutionType(tags = {}) {
  const amenity = tags.amenity;
  if (amenity === 'hospital' || amenity === 'clinic' || amenity === 'doctors') return 'hospital';
  if (amenity === 'school' || amenity === 'college' || amenity === 'kindergarten') return 'school';
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
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
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
  } catch {
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

  const { data } = await axios.post('https://overpass-api.de/api/interpreter', query, {
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent': 'BreathTruth/1.0 (community-aqi-map)'
    },
    timeout: 20000
  });

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

      return {
        type: normalizeInstitutionType(tags),
        name: tags.name || 'Unnamed Institution',
        address: resolvedAddress,
        lat: Number(lat),
        lng: Number(lng)
      };
    })
    .filter(Boolean);

  return (await Promise.all(institutions)).filter(Boolean).slice(0, MAX_INSTITUTIONS);
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
      .select('pincode locality city communityAqi officialAqi confidenceScore anomalyFlagged')
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
    if (!center) {
      return res.json({
        message: 'Could not locate this area for institution lookup yet. Try a more specific locality or city.',
        institutions: []
      });
    }

    const institutions = await fetchInstitutionsNear(center);
    if (institutions.length === 0) {
      return res.json({
        message: 'No nearby institutions were found for this area yet.',
        institutions,
        center
      });
    }

    return res.json({ institutions, center });
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

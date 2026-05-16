// routes/map.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const AqiAggregate = require('../models/AqiAggregate');

const INSTITUTION_RADIUS_METERS = 4000;
const MAX_INSTITUTIONS = 50;
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
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city']
  ].filter(Boolean).join(', ') || tags.name || 'Address not available';
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
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) return null;

      const tags = el.tags || {};
      return {
        type: normalizeInstitutionType(tags),
        name: tags.name || 'Unnamed Institution',
        address: formatInstitutionAddress(tags),
        lat: Number(lat),
        lng: Number(lng)
      };
    })
    .filter(Boolean)
    .slice(0, MAX_INSTITUTIONS);

  return institutions;
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

// scripts/backfillAggregateCoords.js
//
// One-time backfill: geocodes lat/lng for existing AqiAggregate documents
// that don't have coordinates yet (i.e. everything created before the
// heatmap feature was added). Going forward, recalculateAggregate() in
// utils/aggregator.js handles this automatically for new/updated aggregates
// — this script is only needed once, to backfill old data.
//
// Run from the backend folder with:
//   node scripts/backfillAggregateCoords.js
//
// Safe to re-run: it only processes documents where lat/lng is still null,
// so anything already backfilled (or newly created with coordinates) is
// skipped automatically.

require('dotenv').config();
const mongoose = require('mongoose');
const AqiAggregate = require('../models/AqiAggregate');
const { nominatimGet } = require('../utils/nominatim');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/breathtruth';

async function geocodePincode(pincode, locality, city) {
  const queries = [
    `${pincode} ${locality || ''} ${city || ''} India`.trim(),
    `${locality || ''} ${city || ''} India`.trim(),
    `${pincode} India`.trim()
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const { data } = await nominatimGet('https://nominatim.openstreetmap.org/search', {
        params: { format: 'jsonv2', q: query, limit: 1, countrycodes: 'in' },
        headers: { 'User-Agent': 'BreathTruth/1.0 (community-aqi-map)' },
        timeout: 12000
      });

      if (Array.isArray(data) && data.length > 0) {
        return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      }
    } catch (err) {
      console.warn(`  query failed ("${query}"):`, err.message || err);
    }
  }
  return null;
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected.\n');

  // Find aggregates missing coordinates, grouped by distinct pincode so we
  // only geocode each pincode ONCE even if it has many daily aggregates.
  const missing = await AqiAggregate.find({
    $or: [{ lat: null }, { lng: null }, { lat: { $exists: false } }, { lng: { $exists: false } }]
  }).select('pincode locality city');

  if (missing.length === 0) {
    console.log('Nothing to backfill — all aggregates already have coordinates.');
    await mongoose.disconnect();
    return;
  }

  const uniquePincodes = new Map(); // pincode -> { locality, city }
  for (const agg of missing) {
    if (!uniquePincodes.has(agg.pincode)) {
      uniquePincodes.set(agg.pincode, { locality: agg.locality, city: agg.city });
    }
  }

  console.log(`Found ${missing.length} aggregate(s) across ${uniquePincodes.size} distinct pincode(s) missing coordinates.\n`);

  let geocoded = 0;
  let failed = 0;

  for (const [pincode, { locality, city }] of uniquePincodes) {
    console.log(`Geocoding ${pincode} (${locality}, ${city})...`);
    const coords = await geocodePincode(pincode, locality, city);

    if (!coords) {
      console.warn(`  ✗ Could not geocode ${pincode} — skipping (will retry next backfill run).`);
      failed++;
      continue;
    }

    const result = await AqiAggregate.updateMany(
      { pincode, $or: [{ lat: null }, { lng: null }] },
      { $set: { lat: coords.lat, lng: coords.lng } }
    );

    console.log(`  ✓ ${pincode} -> (${coords.lat}, ${coords.lng}) — updated ${result.modifiedCount} document(s).`);
    geocoded++;
  }

  console.log(`\nDone. Geocoded ${geocoded} pincode(s), failed ${failed}.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Backfill script crashed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
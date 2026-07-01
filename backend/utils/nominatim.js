// utils/nominatim.js
//
// Shared Nominatim request helper used by both routes/map.js (institutions
// lookup) and utils/aggregator.js (geocoding aggregates for the heatmap).
//
// IMPORTANT: this throttle is process-wide. If map.js and aggregator.js each
// kept their own separate throttle, the two would run independently and
// could end up sending requests roughly twice as fast combined as either
// one alone — defeating the point of throttling. Sharing one instance here
// keeps the real request rate against Nominatim's public servers under
// control no matter which part of the app is calling it.

const axios = require('axios');

let lastNominatimCallAt = 0;
const NOMINATIM_MIN_GAP_MS = 1100; // a little over 1s to stay under ~1 req/sec

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleNominatim() {
  const now = Date.now();
  const elapsed = now - lastNominatimCallAt;
  if (elapsed < NOMINATIM_MIN_GAP_MS) {
    await sleep(NOMINATIM_MIN_GAP_MS - elapsed);
  }
  lastNominatimCallAt = Date.now();
}

async function nominatimGet(url, config, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttleNominatim();
    try {
      return await axios.get(url, config);
    } catch (err) {
      const status = err?.response?.status;
      const isRateLimited = status === 429;
      const isLastAttempt = attempt === retries;

      if (!isRateLimited || isLastAttempt) {
        throw err;
      }

      const backoffMs = 1500 * Math.pow(2, attempt) + Math.random() * 300;
      console.warn(`Nominatim 429 — retrying in ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(backoffMs);
    }
  }
}

module.exports = { nominatimGet };
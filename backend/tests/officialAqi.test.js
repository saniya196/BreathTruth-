// Run with: npm test --workspace backend   (Node 18+, no extra dependencies)
// External services (axios) and the Mongo model are stubbed. These tests verify
// our logic, NOT the real WAQI/Nominatim services.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let waqiMode = 'ok';          // ok | zero | null | dash | rejected | timeout
let nominatimHits = () => [{ lat: '17.38', lon: '78.48' }];
let waqiCalls = 0;
let aggregateDoc = null;      // what AqiAggregate.findOne resolves to

const fakeAxios = {
  get: async (url, opts = {}) => {
    if (url.includes('nominatim')) return { data: nominatimHits(opts.params || {}) };
    waqiCalls++;
    if (waqiMode === 'timeout') { const e = new Error('timeout'); e.code = 'ECONNABORTED'; throw e; }
    if (waqiMode === 'rejected') return { data: { status: 'error', data: 'Invalid key' } };
    const aqi = { ok: 78, zero: 0, null: null, dash: '-' }[waqiMode];
    return { data: { status: 'ok', data: { aqi, city: { name: 'Test Station', geo: [17.4, 78.4] }, iaqi: {} } } };
  }
};
const fakeModel = {
  findOne: () => { const p = Promise.resolve(aggregateDoc); p.sort = () => Promise.resolve(aggregateDoc); return p; },
  findByIdAndUpdate: async () => ({})
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'axios') return fakeAxios;
  if (request.endsWith('models/AqiAggregate')) return fakeModel;
  return origLoad.call(this, request, ...rest);
};
const { fetchOfficialAqiWithFallback } = require('../utils/officialAqi');
const { getCurrentAqi, getCategory, getAdvisory } = require('../controllers/aqiController');

let n = 0; const pin = () => String(500000 + ++n); // unique pincode per test (geocode cache is module-level)
const setup = (mode, token = 'test-token') => {
  waqiMode = mode; waqiCalls = 0; aggregateDoc = null;
  nominatimHits = () => [{ lat: '17.38', lon: '78.48' }];
  if (token) process.env.WAQI_TOKEN = token; else delete process.env.WAQI_TOKEN;
};
const callCurrent = async (pincode) => {
  let body; await getCurrentAqi({ params: { pincode } }, { json: b => { body = b; }, status() { return this; } });
  return body;
};

test('success returns the WAQI value', async () => {
  setup('ok'); const diag = {};
  const r = await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag);
  assert.equal(r.aqi, 78); assert.equal(diag.reason, undefined);
});

test('AQI of 0 is a valid reading, not missing', async () => {
  setup('zero');
  const r = await fetchOfficialAqiWithFallback({ pincode: pin() }, null, {});
  assert.equal(r.aqi, 0);
  const body = await callCurrent(pin());
  assert.equal(body.officialAqi, 0); assert.equal(body.officialStatus, 'ok');
  assert.equal(body.aqi, 0); assert.equal(body.category, 'good');
});

test('null or "-" from WAQI is unavailable and never becomes 0', async () => {
  for (const mode of ['null', 'dash']) {
    setup(mode); const diag = {};
    assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
    assert.equal(diag.reason, 'station_has_no_aqi');
  }
});

test('missing token, rejected key and timeout give distinct reasons', async () => {
  const cases = [['ok', null, 'missing_token'], ['rejected', 'x', 'waqi_rejected'], ['timeout', 'x', 'waqi_timeout']];
  for (const [mode, token, reason] of cases) {
    setup(mode, token); const diag = {};
    assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
    assert.equal(diag.reason, reason);
  }
});

test('geocode failure is reported as geocode_failed', async () => {
  setup('ok'); nominatimHits = () => []; const diag = {};
  assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
  assert.equal(diag.reason, 'geocode_failed');
});

test('fallback attempt: a service error outranks the earlier geocode failure', async () => {
  setup('rejected');
  nominatimHits = (p) => (p.postalcode || /Hyderabad/.test(p.q || '') === false) ? [] : [{ lat: '17.38', lon: '78.48' }];
  const diag = {};
  const r = await fetchOfficialAqiWithFallback({ pincode: pin() }, 'Hyderabad', diag);
  assert.equal(r, null); assert.equal(diag.reason, 'waqi_rejected');
});

test('fallback attempt: success clears the stale reason', async () => {
  setup('ok');
  nominatimHits = (p) => (p.postalcode || /Hyderabad/.test(p.q || '') === false) ? [] : [{ lat: '17.38', lon: '78.48' }];
  const diag = {};
  const r = await fetchOfficialAqiWithFallback({ pincode: pin() }, 'Hyderabad', diag);
  assert.equal(r.aqi, 78); assert.equal(diag.reason, undefined);
});

test('current AQI endpoint: stored official 0 is not refetched', async () => {
  setup('ok');
  aggregateDoc = { _id: 1, pincode: pin(), officialAqi: 0, communityAqi: 0, officialStation: 'S', confidenceScore: 'low', anomalyFlagged: false };
  const body = await callCurrent(pin());
  assert.equal(waqiCalls, 0); assert.equal(body.officialAqi, 0); assert.equal(body.aqi, 0);
});

test('current AQI endpoint: unavailable response carries officialReason', async () => {
  setup('rejected');
  aggregateDoc = { _id: 1, pincode: pin(), officialAqi: null, communityAqi: 90, confidenceScore: 'low', anomalyFlagged: false };
  const body = await callCurrent(pin());
  assert.equal(body.officialAqi, null); assert.equal(body.officialStatus, 'unavailable');
  assert.equal(body.officialReason, 'waqi_rejected'); assert.equal(body.aqi, 90);
  setup('timeout'); // no community data at all
  const body2 = await callCurrent(pin());
  assert.equal(body2.officialStatus, 'unavailable'); assert.equal(body2.officialReason, 'waqi_timeout');
});

test('category and advisory treat 0 as Good, null as unknown', () => {
  assert.equal(getCategory(0), 'good'); assert.equal(getCategory(null), 'unknown');
  assert.match(getAdvisory(0).text, /Good/); assert.match(getAdvisory(null).text, /No data/);
});

test('request with no location at all reports no_location', async () => {
  setup('ok'); const diag = {};
  assert.equal(await fetchOfficialAqiWithFallback({}, null, diag), null);
  assert.equal(diag.reason, 'no_location');
});

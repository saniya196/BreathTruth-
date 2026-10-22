// Run with: npm test --workspace backend   (Node 18+, no extra dependencies)
// External services (axios) and the Mongo model are stubbed. These tests verify
// our logic, NOT the real WAQI/Nominatim services.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let waqiMode = 'ok';          // ok | zero | null | dash | rejected | timeout | distant | missing_coords | invalid_coords | no_station_metadata
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
    const geo = waqiMode === 'distant'
      ? [28.6, 77.2]
      : waqiMode === 'missing_coords'
        ? undefined
        : waqiMode === 'invalid_coords'
          ? [91, 181]
          : [17.4, 78.4];
    const city = waqiMode === 'no_station_metadata' ? undefined : { name: 'Test Station', geo };
    return { data: { status: 'ok', data: { aqi, city, iaqi: {} } } };
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

test('Hyderabad PIN accepts a station only when its verified coordinates are nearby', async () => {
  setup('ok');
  const result = await fetchOfficialAqiWithFallback({ pincode: '500075' }, null, {});
  assert.equal(result.aqi, 78);
  assert.deepEqual(result.nearestStation.coords, { lat: 17.4, lng: 78.4 });
});

test('distant station is unavailable instead of being presented as local', async () => {
  setup('distant'); const diag = {};
  assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
  assert.equal(diag.reason, 'station_too_far');
});

test('station without coordinates is unavailable', async () => {
  setup('missing_coords'); const diag = {};
  assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
  assert.equal(diag.reason, 'station_missing_coordinates');
});

test('invalid station coordinates are unavailable', async () => {
  setup('invalid_coords'); const diag = {};
  assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
  assert.equal(diag.reason, 'station_missing_coordinates');
});

test('AQI with no station metadata is unavailable', async () => {
  setup('no_station_metadata'); const diag = {};
  assert.equal(await fetchOfficialAqiWithFallback({ pincode: pin() }, null, diag), null);
  assert.equal(diag.reason, 'station_missing_coordinates');
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
  aggregateDoc = {
    _id: 1,
    pincode: pin(),
    officialAqi: 0,
    communityAqi: 0,
    officialStation: 'S',
    officialStationValidated: true,
    officialStationLat: 17.4,
    officialStationLng: 78.4,
    confidenceScore: 'low',
    anomalyFlagged: false
  };
  const body = await callCurrent(pin());
  assert.equal(waqiCalls, 0); assert.equal(body.officialAqi, 0); assert.equal(body.aqi, 0);
});

test('current AQI endpoint: stale Delhi station is not returned for Hyderabad PIN', async () => {
  setup('distant');
  aggregateDoc = {
    _id: 1,
    pincode: '500075',
    officialAqi: 210,
    officialStation: 'Dr. Karni Singh Shooting Range, Delhi, Delhi, India',
    communityAqi: 90,
    city: 'Hyderabad',
    locality: 'Gandipet',
    confidenceScore: 'low',
    anomalyFlagged: false
  };
  const body = await callCurrent('500075');
  assert.equal(body.officialAqi, null);
  assert.equal(body.officialStation, null);
  assert.equal(body.officialStatus, 'unavailable');
  assert.equal(body.officialReason, 'station_too_far');
  assert.equal(body.aqi, 90);
});

test('current AQI endpoint: legacy aggregate accepts a validated nearby station', async () => {
  setup('ok');
  aggregateDoc = {
    _id: 1,
    pincode: pin(),
    officialAqi: 210,
    officialStation: 'Old station',
    communityAqi: 90,
    city: 'Hyderabad',
    locality: 'Gandipet',
    confidenceScore: 'low',
    anomalyFlagged: false
  };
  const body = await callCurrent(aggregateDoc.pincode);
  assert.equal(body.officialAqi, 78);
  assert.equal(body.officialStation, 'Test Station');
  assert.equal(body.officialStatus, 'ok');
  assert.equal(body.aqi, 90);
});

test('current AQI endpoint: provider failure hides stale official data', async () => {
  setup('rejected');
  aggregateDoc = {
    _id: 1,
    pincode: pin(),
    officialAqi: 210,
    officialStation: 'Old station',
    communityAqi: 90,
    city: 'Hyderabad',
    locality: 'Gandipet',
    confidenceScore: 'low',
    anomalyFlagged: false
  };
  const body = await callCurrent(aggregateDoc.pincode);
  assert.equal(body.officialAqi, null);
  assert.equal(body.officialStation, null);
  assert.equal(body.officialStatus, 'unavailable');
  assert.equal(body.officialReason, 'waqi_rejected');
  assert.equal(body.aqi, 90);
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

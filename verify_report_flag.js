const Module = require('module');
const originalLoad = Module._load;

const stubs = {
  '../models/Report': {
    create: async (doc) => doc,
    findOne: async () => null,
    countDocuments: async () => 0,
    distinct: async () => []
  },
  '../models/AqiAggregate': {
    find: () => ({ sort: () => ({}) }),
    findOne: () => ({ sort: () => null })
  },
  '../models/User': {
    findByIdAndUpdate: async () => null
  },
  '../utils/aggregator': {
    recalculateAggregate: async () => null
  },
  '../utils/officialAqi': {
    fetchOfficialAqiWithFallback: async () => null
  },
  '../utils/geocode': {
    geocodeByPincode: async (pincode) => (pincode === '560001' ? { lat: 12.97, lng: 77.59 } : null),
    haversineDistanceMeters: (lat1, lng1, lat2, lng2) => {
      const toRad = (deg) => (deg * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
  }
};

Module._load = function(request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) {
    return stubs[request];
  }
  return originalLoad.apply(this, arguments);
};

const controller = require('./backend/controllers/reportsController');
Module._load = originalLoad;

async function runCase(label, coordinates) {
  const req = {
    body: {
      aqiEstimate: 120,
      symptoms: [],
      pollutionSource: 'traffic',
      description: 'test',
      coordinates
    },
    user: {
      _id: 'user1',
      pincode: '560001',
      locality: 'Test Locality',
      city: 'Test City'
    }
  };

  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  await controller.submitReport(req, res);
  console.log(`${label}:${JSON.stringify({ statusCode: res.statusCode, flagged: res.payload.report.flagged, flagReason: res.payload.report.flagReason || null })}`);
}

(async () => {
  await runCase('near', { lat: 12.971, lng: 77.593 });
  await runCase('far', { lat: 28.6139, lng: 77.209 });
})();

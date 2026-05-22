require('dotenv').config();
const axios = require('axios');

async function main() {
  try {
    const geocode = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        format: 'jsonv2',
        q: '500075 Narsingi Hyderabad India',
        limit: 1,
        countrycodes: 'in'
      },
      headers: { 'User-Agent': 'BreathTruth/1.0 (debug)' },
      timeout: 30000
    });
    console.log('GEOCODE', JSON.stringify(geocode.data, null, 2));

    const res = await axios.get('http://localhost:5000/api/map/institutions/500075', {
      params: { locality: 'Narsingi', city: 'Hyderabad' },
      timeout: 30000
    });
    console.log('INSTITUTIONS', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('ERROR', err.response?.status || '', err.response?.data || err.message);
    process.exitCode = 1;
  }
}

main();

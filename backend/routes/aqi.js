const express = require('express');
const router = express.Router();
const { getOfficialAqi, getComparison, getCurrentAqi } = require('../controllers/aqiController');
const { protect } = require('../middleware/auth');
const axios = require('axios');

// Pincode geocode cache (avoids hammering Nominatim rate limit)
const geocodeCache = new Map();

async function geocodePincode(pincode) {
	if (geocodeCache.has(pincode)) return geocodeCache.get(pincode);

	const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
		params: { postalcode: pincode, country: 'India', format: 'json', limit: 1 },
		headers: { 'User-Agent': 'BreathTruth/1.0 (community-aqi-project)' }
	});

	if (!data.length) throw new Error(`Pincode ${pincode} not found`);

	const result = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
	geocodeCache.set(pincode, result);
	return result;
}

router.get('/official', getOfficialAqi);
router.get('/current/:pincode', getCurrentAqi);
router.get('/comparison/:pincode', protect, getComparison);

// Used when comparison graph has no local sensor for that pincode.
router.get('/nearest/:pincode', async (req, res) => {
	try {
		const { pincode } = req.params;
		const { lat, lon } = await geocodePincode(pincode);

		const waqiToken = process.env.WAQI_TOKEN || process.env.CPCB_API_KEY || 'demo';
		const url = `https://api.waqi.info/feed/geo:${lat};${lon}/?token=${waqiToken}`;
		const { data } = await axios.get(url);

		if (data.status !== 'ok') {
			return res.status(404).json({ error: 'No nearby station found' });
		}

		const station = data.data;
		res.json({
			isNearest: true,
			stationName: station.city?.name || 'Nearest station',
			aqi: station.aqi,
			pm25: station.iaqi?.pm25?.v ?? null,
			pm10: station.iaqi?.pm10?.v ?? null,
			dominentPol: station.dominentpol,
			stationLat: station.city?.geo?.[0] ?? lat,
			stationLon: station.city?.geo?.[1] ?? lon,
			queryLat: lat,
			queryLon: lon,
		});
	} catch (err) {
		console.error('[nearest]', err.message);
		res.status(500).json({ error: err.message });
	}
});

// Returns schools, hospitals, colleges, old-age homes near that pincode.
router.get('/institutions/:pincode', async (req, res) => {
	try {
		const { pincode } = req.params;
		const { lat, lon } = await geocodePincode(pincode);

		const d = 0.035;
		const [s, n, w, e] = [lat - d, lat + d, lon - d, lon + d];

		const overpassQuery = `
[out:json][timeout:20];
(
	node["amenity"="school"](${s},${w},${n},${e});
	node["amenity"="hospital"](${s},${w},${n},${e});
	node["amenity"="college"](${s},${w},${n},${e});
	node["amenity"="nursing_home"](${s},${w},${n},${e});
	node["amenity"="social_facility"]["social_facility"="nursing_home"](${s},${w},${n},${e});
	way["amenity"="school"](${s},${w},${n},${e});
	way["amenity"="hospital"](${s},${w},${n},${e});
	way["amenity"="college"](${s},${w},${n},${e});
);
out center;
		`.trim();

		const { data } = await axios.post(
			'https://overpass-api.de/api/interpreter',
			`data=${encodeURIComponent(overpassQuery)}`,
			{ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
		);

		const typeMap = {
			school: 'school',
			hospital: 'hospital',
			college: 'college',
			nursing_home: 'old-age home',
			social_facility: 'old-age home',
		};

		const institutions = (data.elements || [])
			.map(el => ({
				id: el.id,
				type: typeMap[el.tags?.amenity] || el.tags?.amenity,
				name: el.tags?.name || el.tags?.['name:en'] || 'Unnamed',
				lat: el.lat ?? el.center?.lat,
				lon: el.lon ?? el.center?.lon,
			}))
			.filter(i => i.lat && i.lon);

		res.json({ institutions, centerLat: lat, centerLon: lon });
	} catch (err) {
		console.error('[institutions]', err.message);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getOfficialAqi, getComparison, getCurrentAqi } = require('../controllers/aqiController');
const { protect } = require('../middleware/auth');
const axios = require('axios');

// Pincode geocode cache (avoids hammering Nominatim rate limit)
const geocodeCache = new Map();
const addressCache = new Map();
const overpassEndpoints = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://lz4.overpass-api.de/api/interpreter',
];

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

	let lastError;
	for (const endpoint of overpassEndpoints) {
		for (const attempt of attempts) {
			try {
				const { data } = await axios.post(endpoint, attempt.data, {
					headers: {
						...attempt.headers,
						Accept: 'application/json',
						'User-Agent': 'BreathTruth/1.0 (community-aqi-project)',
					},
				});
				return data;
			} catch (error) {
				lastError = error;
			}
		}
	}

	throw lastError;
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

async function reverseGeocodeAddress(lat, lon) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

	const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
	if (addressCache.has(cacheKey)) return addressCache.get(cacheKey);

	try {
		const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
			params: {
				format: 'jsonv2',
				lat,
				lon,
				zoom: 18,
				addressdetails: 1
			},
			headers: {
				'User-Agent': 'BreathTruth/1.0 (community-aqi-project)'
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

router.get('/official', getOfficialAqi);
router.get('/current/:pincode', getCurrentAqi);
router.get('/comparison/:pincode', protect, getComparison);

// Used when comparison graph has no local sensor for that pincode.
router.get('/nearest/:pincode', async (req, res) => {
	try {
		const { pincode } = req.params;
		const { lat, lon } = await geocodePincode(pincode);

		const waqiToken = process.env.WAQI_TOKEN || 'demo';
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

		const d = 0.05; // ~5 km bounding box around the pincode center
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

		const data = await fetchOverpassData(overpassQuery);

		const typeMap = {
			school: 'school',
			hospital: 'hospital',
			college: 'college',
			nursing_home: 'old-age home',
			social_facility: 'old-age home',
		};

		const institutions = await Promise.all((data.elements || [])
			.map(async el => {
				const latEl = el.lat ?? el.center?.lat;
				const lonEl = el.lon ?? el.center?.lon;
				if (latEl == null || lonEl == null) return null;

				const tags = el.tags || {};
				const tagAddress = formatInstitutionAddress(tags);
				const address = tagAddress !== 'Address not available'
					? tagAddress
					: (await reverseGeocodeAddress(Number(latEl), Number(lonEl))) || tagAddress;

				return {
					id: el.id,
					type: typeMap[tags.amenity] || tags.amenity,
					name: tags.name || tags['name:en'] || 'Unnamed',
					address,
					lat: Number(latEl),
					lon: Number(lonEl),
				};
			}))
			.then(items => items.filter(Boolean));

		res.json({ institutions, centerLat: lat, centerLon: lon });
	} catch (err) {
		console.error('[institutions]', err.message);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;

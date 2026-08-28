const fs = require('fs');
const path = require('path');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OUT_FILE = path.join(__dirname, '..', 'facilities.vellore.seed.json');
const CENTER = { lat: 12.9165, lng: 79.1325 };
const RADIUS = 15000;
const NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

if (!GOOGLE_MAPS_API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in process.env');
  process.exitCode = 1;
  process.exit(1);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const slugify = input => String(input).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function inferType(place) {
  const text = `${place.name || ''} ${(place.types || []).join(' ')}`.toLowerCase();
  if (text.includes('district') && text.includes('hospital')) return 'District Hospital';
  if (text.includes('phc') || text.includes('primary health')) return 'PHC';
  if (text.includes('chc') || text.includes('community health')) return 'CHC';
  if (text.includes('clinic')) return 'Clinic';
  if (text.includes('specialty') || text.includes('super specialty')) return 'Hospital';
  return 'Hospital';
}

function inferCategory(type, govt) {
  if (type === 'PHC' || type === 'CHC') return govt ? 'Public / Primary Care' : 'Private Clinic';
  if (type === 'District Hospital') return govt ? 'Public District Hospital' : 'Hospital';
  return govt ? 'Public Hospital' : 'Private Hospital';
}

function inferGovt(place) {
  const text = `${place.name || ''} ${place.vicinity || ''} ${place.formatted_address || ''}`.toLowerCase();
  return text.includes('government') || /\bgh\b/.test(text) || /\bphc\b/.test(text) || /\bchc\b/.test(text);
}

function inferDescription(place, details) {
  const status = details.business_status || place.business_status || 'UNKNOWN';
  const address = details.formatted_address || place.vicinity || 'Address unavailable';
  return `Google Places entry for ${place.name}. Status: ${status}. Address: ${address}. Service capability unverified - needs manual review.`;
}

async function nearbySearchPage(pageToken) {
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    location: `${CENTER.lat},${CENTER.lng}`,
    radius: String(RADIUS),
    type: 'hospital'
  });
  if (pageToken) params.set('pagetoken', pageToken);
  const response = await fetch(`${NEARBY_URL}?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || `Nearby Search failed: ${data.status || response.status}`);
  }
  return data;
}

async function placeDetails(placeId) {
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    place_id: placeId,
    fields: 'formatted_phone_number,formatted_address,business_status,opening_hours,types,name,place_id'
  });
  const response = await fetch(`${DETAILS_URL}?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || `Place Details failed: ${data.status || response.status}`);
  }
  return data.result || {};
}

async function main() {
  const byId = new Map();
  let pageToken = null;
  let page = 0;
  let apiErrors = 0;

  while (true) {
    const search = await nearbySearchPage(pageToken);
    const results = Array.isArray(search.results) ? search.results : [];
    page += 1;

    for (const place of results) {
      try {
        const details = await placeDetails(place.place_id);
        const name = details.name || place.name || 'Unknown Hospital';
        const openingHours = details.opening_hours || place.opening_hours || {};
        const openNow = Boolean(openingHours.open_now);
        const description = inferDescription(place, details);
        const facility = {
          id: slugify(place.place_id),
          type: inferType(place),
          name,
          lat: place.geometry?.location?.lat ?? CENTER.lat,
          lng: place.geometry?.location?.lng ?? CENTER.lng,
          govt: inferGovt({ ...place, ...details }),
          isGovt: inferGovt({ ...place, ...details }),
          category: inferCategory(inferType(place), inferGovt({ ...place, ...details })),
          address: details.formatted_address || place.vicinity || '',
          specialties: [],
          doctorStatus: 'Service capability needs manual review',
          cost: inferGovt({ ...place, ...details }) ? 'Government / Subsidized' : 'Private',
          services: {
            oxygen: false,
            icu: false,
            cathLab: false,
            antiVenom: false,
            nicu: false,
            ctScan: false,
            bloodBank: false,
            emergency247: String(details.business_status || place.business_status || '').toUpperCase() === 'OPERATIONAL' && openNow
          },
          phone: details.formatted_phone_number || '',
          description
        };
        byId.set(facility.id, facility);
      } catch (error) {
        apiErrors += 1;
        console.error(`Place details error for ${place.place_id}: ${error.message}`);
      }
      await sleep(120);
    }

    pageToken = search.next_page_token;
    if (!pageToken) break;
    await sleep(2200);
    if (page >= 3) break;
  }

  const output = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Fetched ${output.length} Vellore hospitals with ${apiErrors} API errors`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

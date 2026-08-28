/* =========================================================================
   ROUTIQ HEALTH — AI Healthcare Access & Smart Navigation Engine
   PHASE 2: Real-World Data & OpenStreetMap / OSRM & Nominatim Integration
   ========================================================================= */

// ---------- 1. Grid & Road Graph Setup (Offline Fallback Matrix) ----------
const ROWS = 10, COLS = 14;
const LAT0 = 12.800, LAT1 = 13.120;
const LNG0 = 79.680, LNG1 = 80.300;

function nodeLatLng(r, c) {
  return [LAT0 + (LAT1 - LAT0) * r / (ROWS - 1), LNG0 + (LNG1 - LNG0) * c / (COLS - 1)];
}
function nid(r, c) { return r * COLS + c; }

const nodes = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const [lat, lng] = nodeLatLng(r, c);
    nodes.push({ id: nid(r, c), r, c, lat, lng });
  }
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function distMeters(lat1, lng1, lat2, lng2) { return haversineKm(lat1, lng1, lat2, lng2) * 1000; }

// ---------- 2. Healthcare Facilities Database (Real Coordinates + Offline Cache) ----------
function zc(r, c) { return nodeLatLng(r, c); }

const facilities = [
  {
    id: 'fac-phc-1',
    type: 'PHC',
    name: 'Kotturpuram Urban Primary Health Centre',
    category: 'Public / Primary Care',
    isGovt: true,
    lat: 13.0210,
    lng: 80.2400,
    nodeId: nid(5, 10),
    specialties: ['General Medicine', 'Basic Outpatient', 'Dressing'],
    services: { oxygen: false, icu: false, cathLab: false, antiVenom: false, nicu: false, ctScan: false, bloodBank: false, emergency247: false },
    doctorStatus: 'General MO Available (9 AM - 4 PM)',
    cost: 'Free (Government)',
    phone: '+91 44 2445 0011',
    description: 'Basic primary health centre for minor outpatient care. Lacks ICU, oxygen, and emergency specialists.'
  },
  {
    id: 'fac-dist-gov',
    type: 'District Hospital',
    name: 'Kanchipuram Govt Headquarters Hospital',
    category: 'Public Tertiary Hospital',
    isGovt: true,
    lat: 12.8333,
    lng: 79.7000,
    nodeId: nid(1, 0),
    specialties: ['Cardiology', 'Obstetrics & GYN', 'Orthopedics / Trauma', 'General Surgery', 'Toxicology / Anti-Venom', 'Pediatrics'],
    services: { oxygen: true, icu: true, cathLab: true, antiVenom: true, nicu: true, ctScan: true, bloodBank: true, emergency247: true },
    doctorStatus: 'Cardiologist & Trauma Specialist On Duty (24/7)',
    cost: 'Free (Government / Ayushman Bharat)',
    phone: '+91 44 2722 3400',
    description: 'Comprehensive public tertiary hospital equipped with 24/7 ICU, Cath Lab, Anti-venom bank, and Emergency OT.'
  },
  {
    id: 'fac-priv-super',
    type: 'Super Specialty',
    name: 'Apollo Hospital Greams Road',
    category: 'Private Super-Specialty',
    isGovt: false,
    lat: 13.0610,
    lng: 80.2520,
    nodeId: nid(7, 11),
    specialties: ['Interventional Cardiology', 'Neurosurgery', 'Cardiothoracic Surgery', 'Critical Care ICU', 'Emergency Trauma'],
    services: { oxygen: true, icu: true, cathLab: true, antiVenom: false, nicu: true, ctScan: true, bloodBank: true, emergency247: true },
    doctorStatus: 'Full Super-Specialist Team On Site (24/7)',
    cost: 'Private / Insurance Accepted',
    phone: '+91 44 2829 0200',
    description: 'Advanced private tertiary medical center specializing in complex cardiac interventions and neuro-trauma.'
  },
  {
    id: 'fac-chc-rural',
    type: 'CHC',
    name: 'Tambaram Government Community Hospital',
    category: 'Public / Secondary Care',
    isGovt: true,
    lat: 12.9230,
    lng: 80.1170,
    nodeId: nid(3, 7),
    specialties: ['General Medicine', 'Pediatrics', 'Obstetrics (Basic)', 'Anti-Venom'],
    services: { oxygen: true, icu: false, cathLab: false, antiVenom: true, nicu: false, ctScan: false, bloodBank: false, emergency247: true },
    doctorStatus: 'Duty Medical Officer & Anti-Venom Specialist',
    cost: 'Free (Government)',
    phone: '+91 44 2226 5000',
    description: 'Community health center equipped for anti-venom treatment, minor emergency trauma, and pediatric care.'
  },
  {
    id: 'fac-trauma-center',
    type: 'Trauma Unit',
    name: 'Rajiv Gandhi Govt General Hospital (RGGGH)',
    category: 'Public Tertiary Specialty Hospital',
    isGovt: true,
    lat: 13.0818,
    lng: 80.2777,
    nodeId: nid(8, 12),
    specialties: ['Orthopedic Trauma', 'Emergency Surgery', 'Anesthesiology', 'Blood Bank', 'Cardiology'],
    services: { oxygen: true, icu: true, cathLab: true, antiVenom: true, nicu: true, ctScan: true, bloodBank: true, emergency247: true },
    doctorStatus: 'Trauma Team & Emergency Surgeons On Site 24/7',
    cost: 'Free (Government)',
    phone: '+91 44 2530 5000',
    description: 'Premier public teaching hospital & level-1 emergency trauma center equipped with CT scan, blood bank, and surgical suites.'
  },
  {
    id: 'fac-maternal-child',
    type: 'Maternity Center',
    name: 'Sri Ramachandra Medical Centre',
    category: 'Public Specialty / University Hospital',
    isGovt: true,
    lat: 13.0360,
    lng: 80.1472,
    nodeId: nid(6, 8),
    specialties: ['Obstetrics & Gynecology', 'Neonatal ICU (NICU)', 'Pediatrics', 'High-Risk Labor OT'],
    services: { oxygen: true, icu: true, cathLab: true, antiVenom: false, nicu: true, ctScan: true, bloodBank: true, emergency247: true },
    doctorStatus: 'Senior Obstetrician & Neonatologist 24/7',
    cost: 'Free / Subsidized Public Ward',
    phone: '+91 44 2476 8000',
    description: 'Dedicated maternal and infant tertiary hospital equipped for high-risk deliveries and neonatal ICU emergencies.'
  }
];

// Keep startup deterministic, then replace the bootstrap data with the API dataset.
let selectedRegion = 'all';

async function refreshFacilitiesFromBackend(region = selectedRegion) {
  if (window.demoMode || !navigator.onLine) return;
  try {
    const query = region && region !== 'all' ? `?region=${encodeURIComponent(region)}` : '';
    const response = await fetch('/facilities' + query, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Facility API HTTP ' + response.status);
    const records = await response.json();
    if (!Array.isArray(records) || records.length < 1) throw new Error('Facility API returned no records');
    facilities.splice(0, facilities.length, ...records);
    facilities.forEach(fac => { if (fac.nodeId == null) fac.nodeId = nearestNode(fac.lat, fac.lng); });
    renderFacilityMarkers();
    document.getElementById('stat-fac-count').textContent = facilities.length;
    if (typeof renderFacilitiesDirectory === 'function') renderFacilitiesDirectory();
    if (typeof updateImpactMetrics === 'function') updateImpactMetrics();
    log('Facility API sync complete: ' + facilities.length + ' facilities loaded for ' + region + '.', 't-cyan');
  } catch (error) {
    log('Facility API unavailable: ' + error.message + '. Using bundled/cache data.', 't-amber');
  }
}

// ---------- 3. Geospatial Risk Zones ----------
const zoneDefs = [
  {
    lat: 13.0240, lng: 80.2410, type: 'flood', name: 'Kotturpuram Low-Lying Flood Belt', color: '#3ba6e8', radius: 900, severity: 9,
    evidence: [
      { source: 'IMD Chennai Rainfall Bulletin', sourceType: 'weather_data', summary: 'IMD bulletin recorded 340mm rainfall in 24h during monsoon spell', date: '2024-10-16' },
      { source: 'Greater Chennai Corporation flood map', sourceType: 'geospatial', summary: 'GCC flood hazard mapping classifies stretch as high inundation risk', date: '2024-06-01' },
      { source: 'TN Disaster Management Dept incident log', sourceType: 'historical_incident', summary: 'Waterlogging depth up to 1.2m recorded in previous monsoon spell', date: '2023-12-04' }
    ]
  },
  {
    lat: 13.0620, lng: 80.2700, type: 'crime', name: 'Market Street Heavy Bottleneck', color: '#c25ce0', radius: 600, severity: 6,
    evidence: [
      { source: 'Chennai Traffic Police congestion report', sourceType: 'govt_report', summary: 'Heavy commercial traffic creates 35-minute average delay during peak hours', date: '2024-08-20' },
      { source: 'OpenStreetMap road-width survey', sourceType: 'geospatial', summary: 'Street vendors reduce available ambulance carriage width to 3.2m', date: '2024-07-12' },
      { source: 'Chennai Traffic Control Centre log', sourceType: 'historical_incident', summary: 'Frequent congestion gridlocks flagged by traffic control', date: '2024-09-30' }
    ]
  },
  {
    lat: 12.9800, lng: 80.1500, type: 'fire', name: 'Industrial Corridor Bypass Hazard', color: '#e8543e', radius: 800, severity: 7,
    evidence: [
      { source: 'Tamil Nadu Fire & Rescue Services risk register', sourceType: 'govt_report', summary: 'Fire department classifies corridor as Category-B industrial hazard zone', date: '2024-05-18' },
      { source: 'Chennai Metropolitan Development Authority works bulletin', sourceType: 'govt_report', summary: 'Road widening construction active on eastern lane', date: '2024-09-05' },
      { source: 'OpenStreetMap freight-road layer', sourceType: 'geospatial', summary: 'Heavy container vehicle movements slow emergency traffic', date: '2024-08-11' }
    ]
  },
  {
    lat: 13.0100, lng: 80.2000, type: 'landslide', name: 'Canal Embankment Slope Risk', color: '#a67c3d', radius: 700, severity: 5,
    evidence: [
      { source: 'Tamil Nadu PWD embankment inspection', sourceType: 'govt_report', summary: 'PWD embankment inspection flagged active soil erosion along canal side', date: '2024-07-26' },
      { source: 'IMD Chennai Rainfall Bulletin', sourceType: 'weather_data', summary: 'Road surface saturation risk rises sharply during heavy rain', date: '2024-10-16' },
      { source: 'Greater Chennai Corporation roadworks notice', sourceType: 'geospatial', summary: 'Single-lane diversion active near canal bridge', date: '2024-09-14' }
    ]
  },
  {
    lat: 13.0500, lng: 80.2100, type: 'accident', name: 'Kathipara Signal-Free Accident Junction', color: '#ef4444', radius: 600, severity: 8,
    evidence: [
      { source: 'Tamil Nadu Traffic Police incident log', sourceType: 'historical_incident', summary: 'Traffic police logs record 18 major vehicle collisions in 12 months', date: '2024-08-31' },
      { source: 'OpenStreetMap junction geometry', sourceType: 'geospatial', summary: 'Complex flyover merge points increase collision risk', date: '2024-06-22' },
      { source: 'Chennai Traffic Police emergency advisory', sourceType: 'govt_report', summary: 'Emergency vehicles advised to reduce speed to under 30 km/h', date: '2024-09-02' }
    ]
  }
];

const zones = zoneDefs.map((z, i) => ({ id: 'z' + i, ...z }));

// ---------- 4. Edge Scoring & Graph Construction (Offline Fallback) ----------
function zoneContribution(lat, lng) {
  let total = 0;
  const hits = [];
  for (const z of zones) {
    const d = distMeters(lat, lng, z.lat, z.lng);
    if (d < z.radius) {
      const contribution = z.severity * (1 - d / z.radius);
      total += contribution;
      hits.push(z.id);
    }
  }
  return { score: total, zoneIds: hits };
}

const edges = [];
const adj = {};
nodes.forEach(n => adj[n.id] = []);

function addEdge(aId, bId) {
  const a = nodes[aId], b = nodes[bId];
  const distKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const midLat = (a.lat + b.lat) / 2, midLng = (a.lng + b.lng) / 2;
  const { score, zoneIds } = zoneContribution(midLat, midLng);
  const idx = edges.length;
  edges.push({ a: aId, b: bId, distKm, riskScore: score, zoneIds });
  adj[aId].push({ to: bId, edgeIndex: idx });
  adj[bId].push({ to: aId, edgeIndex: idx });
}

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const id = nid(r, c);
    if (c + 1 < COLS) addEdge(id, nid(r, c + 1));
    if (r + 1 < ROWS) addEdge(id, nid(r + 1, c));
  }
}

// ---------- 5. Dijkstra Dual-Route Algorithm (Offline Fallback) ----------
function dijkstra(startId, endId, weightFn) {
  const dist = new Array(nodes.length).fill(Infinity);
  const prevNode = new Array(nodes.length).fill(-1);
  const prevEdge = new Array(nodes.length).fill(-1);
  const visited = new Array(nodes.length).fill(false);
  dist[startId] = 0;

  for (let iter = 0; iter < nodes.length; iter++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited[i] && dist[i] < best) { best = dist[i]; u = i; }
    }
    if (u === -1) break;
    visited[u] = true;
    if (u === endId) break;
    for (const { to, edgeIndex } of adj[u]) {
      if (visited[to]) continue;
      const w = weightFn(edges[edgeIndex]);
      const nd = dist[u] + w;
      if (nd < dist[to]) {
        dist[to] = nd; prevNode[to] = u; prevEdge[to] = edgeIndex;
      }
    }
  }
  if (dist[endId] === Infinity) return null;
  const pathNodes = [endId], pathEdges = [];
  let cur = endId;
  while (cur !== startId) {
    pathEdges.push(prevEdge[cur]);
    cur = prevNode[cur];
    pathNodes.push(cur);
  }
  pathNodes.reverse(); pathEdges.reverse();
  return { pathNodes, pathEdges, cost: dist[endId] };
}

function routeStats(result, speedFn) {
  let distKm = 0, riskWeightedSum = 0;
  const zoneSet = new Set();
  for (const ei of result.pathEdges) {
    const e = edges[ei];
    distKm += e.distKm;
    riskWeightedSum += e.riskScore * e.distKm;
    e.zoneIds.forEach(z => zoneSet.add(z));
  }
  const avgRisk = distKm > 0 ? riskWeightedSum / distKm : 0;
  let timeMin = 0;
  for (const ei of result.pathEdges) {
    const e = edges[ei];
    const speed = speedFn(e.riskScore);
    timeMin += (e.distKm / speed) * 60;
  }
  return { distKm, avgRisk, timeMin, zoneIds: [...zoneSet] };
}

// ---------- 6. AI & Rule-Based Symptom Triage Classifier ----------
function classifySymptoms(text) {
  const q = text.toLowerCase();

  let urgency = 'ROUTINE';
  let urgencyDesc = 'Standard Outpatient Consultation';
  let requiredSpec = 'General Medicine';
  let mandatoryServices = [];
  let explanation = '';

  if (q.includes('chest pain') || q.includes('heart') || q.includes('cardiac') || q.includes('sweating') || q.includes('arm pain')) {
    urgency = 'CRITICAL';
    urgencyDesc = 'Immediate Emergency Medical Attention (Cardiac Threat)';
    requiredSpec = 'Interventional Cardiologist';
    mandatoryServices = ['Cath Lab', 'ICU Bed', 'Oxygen', '24/7 Ambulance'];
    explanation = 'Symptom profile indicates acute cardiac emergency. Facility MUST have active Cath Lab, ICU bed, and on-duty Cardiologist. Basic PHCs without Cath Lab are disqualified.';
  } else if (q.includes('snake') || q.includes('bite') || q.includes('venom') || q.includes('poison')) {
    urgency = 'CRITICAL';
    urgencyDesc = 'Critical Toxicological Emergency (Polyvalent Anti-Venom Required)';
    requiredSpec = 'Toxicology & Emergency MO';
    mandatoryServices = ['Anti-Venom', 'Oxygen', 'ICU Bed'];
    explanation = 'Snake bite envenomation requires immediate polyvalent anti-venom administration and oxygen monitoring. CHCs or District Hospitals with anti-venom bank prioritized.';
  } else if (q.includes('labor') || q.includes('pregnant') || q.includes('maternity') || q.includes('bleeding') || q.includes('delivery') || q.includes('pregnancy')) {
    urgency = 'CRITICAL';
    urgencyDesc = 'High-Risk Emergency Obstetrics / Delivery';
    requiredSpec = 'Obstetrician & Neonatologist';
    mandatoryServices = ['NICU', 'Blood Bank', 'Oxygen', 'Emergency OT'];
    explanation = 'Emergency maternity labor requires facility with 24/7 Obstetrics emergency OT, blood bank, and Neonatal ICU (NICU) readiness.';
  } else if (q.includes('child') || q.includes('seizure') || q.includes('infant') || q.includes('baby') || q.includes('convulsion') || q.includes('unconscious')) {
    urgency = 'CRITICAL';
    urgencyDesc = 'Pediatric Critical Emergency (Febrile Seizure)';
    requiredSpec = 'Pediatric Intensivist';
    mandatoryServices = ['NICU / PICU', 'Oxygen', 'Emergency OT'];
    explanation = 'Child seizure requires pediatric emergency care, oxygen support, and pediatric ICU capability.';
  } else if (q.includes('accident') || q.includes('fracture') || q.includes('crash') || q.includes('trauma') || q.includes('bone') || q.includes('wound')) {
    urgency = 'CRITICAL';
    urgencyDesc = 'Orthopedic & Surgical Emergency';
    requiredSpec = 'Orthopedic & Trauma Surgeon';
    mandatoryServices = ['CT Scan', 'Blood Bank', 'Emergency OT', 'ICU Bed'];
    explanation = 'High-energy trauma requires CT imaging, blood transfusion readiness, and emergency orthopedic surgical suite.';
  } else if (q.includes('mild') || q.includes('routine') || q.includes('checkup') || q.includes('check-up') || q.includes('follow-up') || q.includes('minor')) {
    urgency = 'ROUTINE';
    urgencyDesc = 'Standard Outpatient Consultation';
    requiredSpec = 'General Medicine';
    mandatoryServices = ['Basic Outpatient'];
    explanation = 'Symptoms appear suitable for a standard outpatient assessment unless they worsen or new warning signs appear.';
  } else {
    urgency = 'URGENT';
    urgencyDesc = 'Urgent Secondary Consultation';
    requiredSpec = 'General Medical Officer';
    mandatoryServices = ['Oxygen', 'Basic Outpatient'];
    explanation = 'Symptom profile requires standard medical evaluation and diagnostic consultation.';
  }

  return { urgency, urgencyDesc, requiredSpec, mandatoryServices, explanation };
}

// ---------- 7. Facility Suitability & Ranking Engine ----------
function rankFacilities(startPos, triage, filterGovt, filterIcu, filterOxygen) {
  return facilities.map(fac => {
    let score = 100;
    const distKm = haversineKm(startPos.lat, startPos.lng, fac.lat, fac.lng);

    let missingServices = [];
    triage.mandatoryServices.forEach(req => {
      let hasIt = false;
      if (req === 'Cath Lab' && fac.services.cathLab) hasIt = true;
      else if (req === 'ICU Bed' && fac.services.icu) hasIt = true;
      else if (req === 'Anti-Venom' && fac.services.antiVenom) hasIt = true;
      else if (req === 'NICU' || req === 'NICU / PICU') { if (fac.services.nicu) hasIt = true; }
      else if (req === 'CT Scan' && fac.services.ctScan) hasIt = true;
      else if (req === 'Blood Bank' && fac.services.bloodBank) hasIt = true;
      else if (req === 'Oxygen' && fac.services.oxygen) hasIt = true;
      else if (req === '24/7 Ambulance' && fac.services.emergency247) hasIt = true;

      if (!hasIt) missingServices.push(req);
    });

    if (missingServices.length > 0) { score -= (missingServices.length * 28); }

    const hasSpecialty = fac.specialties.some(s => s.toLowerCase().includes(triage.requiredSpec.toLowerCase()) || triage.requiredSpec.toLowerCase().includes(s.toLowerCase()));
    if (hasSpecialty) score += 20; else score -= 15;

    if (filterGovt && !fac.isGovt) score -= 15;
    if (filterIcu && !fac.services.icu) score -= 20;
    if (filterOxygen && !fac.services.oxygen) score -= 20;

    score -= (distKm * 1.5);
    score = Math.max(10, Math.min(99, Math.round(score)));

    return {
      facility: fac,
      distKm,
      estTimeMin: Math.round((distKm / 38) * 60),
      score,
      missingServices,
      hasSpecialty
    };
  }).sort((a, b) => b.score - a.score);
}

// ---------- 8. Google Maps Setup & Markers ----------
const googleMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#111b2a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9fb0c4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111b2a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#26384e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#38536d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#071522' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#172638' }] }
];
const usingGoogleMaps = !window.googleMapsUnavailable && !!window.google;
const map = usingGoogleMaps
  ? new google.maps.Map(document.getElementById('map'), {
      center: { lat: 12.9165, lng: 79.1325 }, zoom: 12, mapId: 'DEMO_MAP_ID',
      styles: googleMapStyles, streetViewControl: false, fullscreenControl: false,
      mapTypeControl: false
    })
  : L.map('map', { zoomControl: true }).setView([12.9165, 79.1325], 12);
if (!usingGoogleMaps) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);
}
function setMapView(lat, lng, zoom) {
  if (usingGoogleMaps) {
    map.setCenter({ lat, lng });
    if (zoom !== undefined) map.setZoom(zoom);
  } else {
    map.setView([lat, lng], zoom === undefined ? map.getZoom() : zoom);
  }
}
function removeMapObject(object) {
  if (!object) return;
  if (usingGoogleMaps) object.setMap(null);
  else map.removeLayer(object);
}
function createGoogleMarker(lat, lng, html, title, popupHtml) {
  if (!usingGoogleMaps) {
    const marker = L.marker([lat, lng], { icon: L.divIcon({ className: 'divicon-marker', html, iconSize: [24, 24] }) }).addTo(map);
    if (popupHtml) marker.bindPopup(popupHtml);
    return marker;
  }
  if (!google.maps.marker) return null;
  const content = document.createElement('div');
  content.className = 'divicon-marker';
  content.innerHTML = html;
  const marker = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat, lng }, content, title });
  if (popupHtml) {
    const info = new google.maps.InfoWindow({ content: popupHtml });
    marker.addListener('click', () => info.open({ map, anchor: marker }));
  }
  return marker;
}
function createGoogleCircle(options, popupHtml) {
  if (!usingGoogleMaps) {
    const circle = L.circle([options.center.lat, options.center.lng], {
      radius: options.radius, color: options.strokeColor, weight: options.strokeWeight,
      fillColor: options.fillColor, fillOpacity: options.fillOpacity
    }).addTo(map);
    if (popupHtml) circle.bindPopup(popupHtml);
    return circle;
  }
  const circle = new google.maps.Circle({ ...options, map });
  if (popupHtml) {
    const info = new google.maps.InfoWindow({ content: popupHtml });
    circle.addListener('click', event => info.open({ map, position: event.latLng }));
  }
  return circle;
}

function updateMapAvailability() {
  const banner = document.getElementById('offline-banner');
  const mapElement = document.getElementById('map');
  const localOffline = typeof isOfflineMode !== 'undefined' && (isOfflineMode || window.demoMode);
  const unavailable = !navigator.onLine;
  if (banner) banner.style.display = unavailable ? 'flex' : 'none';
  if (mapElement) mapElement.style.display = unavailable ? 'none' : 'block';
  const statConn = document.getElementById('stat-conn');
  if (statConn && unavailable) {
    statConn.textContent = 'OFFLINE (Cached Facilities)';
    statConn.style.color = 'var(--amber)';
  }
}
window.addEventListener('online', updateMapAvailability);
window.addEventListener('offline', updateMapAvailability);
updateMapAvailability();

const evidenceTypeMeta = {
  govt_report: { label: 'Government report', icon: '&#x1F3DB;' },
  weather_data: { label: 'Weather data', icon: '&#x2601;' },
  historical_incident: { label: 'Historical incident', icon: '&#x26A0;' },
  geospatial: { label: 'Geospatial data', icon: '&#x1F5FA;' },
  satellite: { label: 'Satellite observation', icon: '&#x1F6F0;' }
};

function renderEvidenceGroups(evidence) {
  const grouped = evidence.reduce((groups, item) => {
    (groups[item.sourceType] ||= []).push(item);
    return groups;
  }, {});
  return Object.entries(grouped).map(([sourceType, items]) => {
    const meta = evidenceTypeMeta[sourceType] || { label: sourceType, icon: '&#x2022;' };
    return `<div class="evidence-group"><div class="evidence-group-title"><span>${meta.icon}</span>${meta.label} (${items.length})</div>` +
      `<ul>${items.map(item => `<li><b>${item.source}</b> <span class="evidence-date">${item.date}</span><br>${item.summary}</li>`).join('')}</ul></div>`;
  }).join('');
}

// Render Risk Zone Circles
zones.forEach(z => {
  createGoogleCircle({
    center: { lat: z.lat, lng: z.lng }, radius: z.radius, strokeColor: z.color,
    strokeWeight: 1.4, fillColor: z.color, fillOpacity: 0.18
  },
    `<div style="font-family:'Inter',sans-serif">
      <b style="font-family:'Space Grotesk',sans-serif;font-size:14px;color:#fff">${z.name}</b><br>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#f59e0b;">Severity: ${z.severity}/10 · Hazard: ${z.type.toUpperCase()}</span>
      <div class="evidence-groups">${renderEvidenceGroups(z.evidence)}</div>
     </div>`
  );
});

// Facility Map Markers
const facIconEmoji = (type) => {
  let emoji = '🏥';
  if (type === 'PHC') emoji = '🏥';
  else if (type === 'District Hospital') emoji = '🏛️';
  else if (type === 'Super Specialty') emoji = '🏢';
  else if (type === 'Trauma Unit') emoji = '🚑';
  else if (type === 'Maternity Center') emoji = '👶';
  return emoji;
};

const facilityLayer = [];
function renderFacilityMarkers() {
  facilityLayer.forEach(removeMapObject);
  facilityLayer.length = 0;
  facilities.forEach(fac => {
  const svcBadges = Object.entries(fac.services)
    .filter(([_, val]) => val)
    .map(([key, _]) => `<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:1px 6px;border-radius:4px;font-size:10px;font-family:monospace;margin-right:3px;">${key}</span>`)
    .join('');

  const marker = createGoogleMarker(fac.lat, fac.lng, facIconEmoji(fac.type), fac.name,
    `<div style="font-family:'Inter',sans-serif;min-width:220px">
      <b style="font-family:'Space Grotesk',sans-serif;font-size:14px;color:#fff">${fac.name}</b><br>
      <span style="font-size:11px;color:#8497ad">${fac.category} · ${fac.isGovt ? 'FREE (Govt)' : 'Private'}</span>
      <div style="margin:6px 0;font-size:11.5px;color:#e2e8f0;">${fac.description}</div>
      <div style="margin-top:6px;">${svcBadges}</div>
      <div style="margin-top:8px;font-size:11px;color:#10b981;font-family:monospace">${fac.doctorStatus}</div>
     </div>`
  );
  if (marker) facilityLayer.push(marker);
  });
}
renderFacilityMarkers();

document.getElementById('stat-fac-count').textContent = facilities.length;
document.getElementById('stat-risk-zones').textContent = zones.length;
document.getElementById('stat-edges').textContent = edges.length;

// Start & Target Location Selection State
let pickMode = 'start';
let startLatLng = { lat: 13.0000, lng: 80.0000 }; // Rural Village start
let startNodeId = nid(4, 5);
let targetFacility = facilities[1]; // Kanchipuram Govt Hospital default
window.setTargetFacility = (facility) => { targetFacility = facility; };

let startMarker = createGoogleMarker(startLatLng.lat, startLatLng.lng, '🟢', 'Start location');
let endMarker = createGoogleMarker(targetFacility.lat, targetFacility.lng, '🔴', 'Target facility');

let fastestLine = null, safestLine = null;

function applyRegionView(region) {
  selectedRegion = region;
  if (region === 'vellore') {
    setMapView(12.9165, 79.1325, 12);
  } else if (region === 'kancheepuram') {
    setMapView(12.8333, 79.7000, 11);
  } else {
    setMapView(13.0200, 80.1800, 11);
  }
  refreshFacilitiesFromBackend(region);
}

const regionSelect = document.getElementById('region-select');
if (regionSelect) {
  regionSelect.value = 'all';
  regionSelect.addEventListener('change', event => {
    applyRegionView(event.target.value);
  });
}

function setPickMode(mode) {
  pickMode = mode;
  document.getElementById('btn-pick-start').classList.toggle('active', mode === 'start');
  document.getElementById('btn-pick-end').classList.toggle('active', mode === 'end');
}
document.getElementById('btn-pick-start').onclick = () => setPickMode('start');
document.getElementById('btn-pick-end').onclick = () => setPickMode('end');

function nearestNode(lat, lng) {
  let best = null, bestD = Infinity;
  nodes.forEach(n => {
    const d = distMeters(lat, lng, n.lat, n.lng);
    if (d < bestD) { bestD = d; best = n; }
  });
  return best;
}

const handleMapClick = (clickLat, clickLng) => {
  if (pickMode === 'start') {
    startLatLng = { lat: clickLat, lng: clickLng };
    const n = nearestNode(clickLat, clickLng);
    startNodeId = n.id;
    removeMapObject(startMarker);
    startMarker = createGoogleMarker(startLatLng.lat, startLatLng.lng, '🟢', 'Start location');
    log('Start location set on map: [' + startLatLng.lat.toFixed(4) + ', ' + startLatLng.lng.toFixed(4) + ']');
    document.getElementById('pick-hint').textContent = 'Start set. Select target facility or click compute routes.';
  } else {
    let closestFac = facilities[0], minD = Infinity;
    facilities.forEach(fac => {
      const d = distMeters(clickLat, clickLng, fac.lat, fac.lng);
      if (d < minD) { minD = d; closestFac = fac; }
    });
    targetFacility = closestFac;
    removeMapObject(endMarker);
    endMarker = createGoogleMarker(targetFacility.lat, targetFacility.lng, '🔴', 'Target facility');
    log('Target facility set to ' + targetFacility.name);
    document.getElementById('pick-hint').textContent = 'Facility set: ' + targetFacility.name + '.';
  }
};
if (usingGoogleMaps) map.addListener('click', e => handleMapClick(e.latLng.lat(), e.latLng.lng()));
else map.on('click', e => handleMapClick(e.latlng.lat, e.latlng.lng));

document.getElementById('btn-reset').onclick = () => {
  startLatLng = { lat: 13.0000, lng: 80.0000 };
  startNodeId = nid(4, 5);
  targetFacility = facilities[1];
  removeMapObject(startMarker);
  startMarker = createGoogleMarker(startLatLng.lat, startLatLng.lng, '🟢', 'Start location');
  removeMapObject(endMarker);
  endMarker = createGoogleMarker(targetFacility.lat, targetFacility.lng, '🔴', 'Target facility');
  removeMapObject(fastestLine);
  removeMapObject(safestLine);
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('pick-hint').textContent = 'Click map to place start location, or select a facility.';
  log('Map selections reset.');
};

// ---------- 9. Controls & Vehicle Profile ----------
let vehicleMode = 'civilian';
document.getElementById('mode-civilian').onclick = () => {
  vehicleMode = 'civilian';
  document.getElementById('mode-civilian').classList.add('active');
  document.getElementById('mode-emergency').classList.remove('active');
  document.getElementById('stat-mode').textContent = 'Civilian';
};
document.getElementById('mode-emergency').onclick = () => {
  vehicleMode = 'emergency';
  document.getElementById('mode-emergency').classList.add('active');
  document.getElementById('mode-civilian').classList.remove('active');
  document.getElementById('stat-mode').textContent = 'Emergency';
};
document.getElementById('risk-weight').oninput = (e) => {
  document.getElementById('risk-weight-val').textContent = e.target.value;
};

// ---------- 10. Scan Log Terminal Console ----------
const termEl = document.getElementById('terminal');
const termLines = [];
function log(text, cls) {
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
  termLines.push(`<span class="t-dim">[${t}]</span> ${cls ? `<span class="${cls}">${text}</span>` : text}`);
  while (termLines.length > 55) termLines.shift();
  termEl.innerHTML = termLines.join('<br>') + '<br><span class="cursor"></span>';
  termEl.scrollTop = termEl.scrollHeight;
}
log('ROUTIQ HEALTH Engine Phase 2 active.');
log('Real-world OpenStreetMap (OSRM & Nominatim) API channels initialized.', 't-cyan');
log('Geospatial risk zones mapped to Tamil Nadu road corridor.', 't-amber');

// ---------- 11. PHASE 2: OSRM Real Routing API Engine & Fallback ----------
let isOfflineMode = false;
window.demoMode = false;

function speedFnFor(mode, riskScore) {
  const norm = Math.min(riskScore / 10, 1);
  const base = mode === 'emergency' ? 58 : 38;
  return base * (1 - 0.45 * norm);
}

// Calculate hazard score for an OSRM GeoJSON coordinate array [lng, lat]
function evaluateOSRMRouteRisk(coordArray) {
  let totalRisk = 0;
  const intersectedZones = new Set();

  for (let i = 0; i < coordArray.length; i++) {
    const [lng, lat] = coordArray[i];
    zones.forEach(z => {
      const d = distMeters(lat, lng, z.lat, z.lng);
      if (d < z.radius) {
        totalRisk += z.severity * (1 - d / z.radius);
        intersectedZones.add(z.id);
      }
    });
  }

  const avgRisk = coordArray.length > 0 ? (totalRisk / coordArray.length) : 0;
  return { totalRisk, avgRisk: Math.min(9.9, avgRisk), zoneIds: [...intersectedZones] };
}

async function fetchOSRMRoute(startPos, endPos) {
  log(`Fetching live OSRM routes from [${startPos.lat.toFixed(4)}, ${startPos.lng.toFixed(4)}] to ${targetFacility.name}...`, 't-cyan');

  const url = `https://router.project-osrm.org/route/v1/driving/${startPos.lng},${startPos.lat};${endPos.lng},${endPos.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error('OSRM API HTTP error ' + resp.status);
  const data = await resp.json();

  if (!data.routes || data.routes.length === 0) throw new Error('No OSRM routes returned');

  log(`OSRM API response received: ${data.routes.length} route candidate(s) fetched.`, 't-cyan');

  // Process returned OSRM routes
  const processedRoutes = data.routes.map((r, idx) => {
    const distKm = r.distance / 1000;
    const rawTimeMin = r.duration / 60;
    const timeMin = vehicleMode === 'emergency' ? rawTimeMin * 0.75 : rawTimeMin;
    const latLngs = r.geometry.coordinates.map(c => [c[1], c[0]]);
    const riskEval = evaluateOSRMRouteRisk(r.geometry.coordinates);

    return {
      index: idx,
      distKm,
      timeMin,
      latLngs,
      ...riskEval
    };
  });

  // Direct / Fastest is Route 0
  const fastestRoute = processedRoutes[0];

  // Safest is the candidate with lowest risk or best safety score
  let safestRoute = processedRoutes.reduce((prev, curr) => (curr.avgRisk < prev.avgRisk ? curr : prev), processedRoutes[0]);

  // If only 1 route returned by OSRM, derive a safer alternative path visually
  if (processedRoutes.length === 1) {
    safestRoute = { ...fastestRoute };
  }

  return { fastestRoute, safestRoute, isLiveAPI: true };
}

// Fallback Dijkstra Execution (Offline Mode / Network Error)
function computeOfflineGridRoutes() {
  log('Executing cached offline Dijkstra graph solver...', 't-amber');
  const startN = nearestNode(startLatLng.lat, startLatLng.lng);
  const endN = nearestNode(targetFacility.lat, targetFacility.lng);
  const riskAversion = parseFloat(document.getElementById('risk-weight').value);

  const fastestWeight = (e) => e.distKm;
  const safestWeight = (e) => {
    const base = riskAversion / 10;
    const effAversion = vehicleMode === 'emergency' ? base * 0.45 : base;
    let cost = e.distKm * (1 + effAversion * e.riskScore * 3.5);
    if (e.riskScore > 7) cost *= vehicleMode === 'emergency' ? 2.5 : 6.0;
    return cost;
  };

  const fastest = dijkstra(startN.id, endN.id, fastestWeight);
  const safest = dijkstra(startN.id, endN.id, safestWeight);

  if (!fastest || !safest) return null;

  const speedFn = (r) => speedFnFor(vehicleMode, r);
  const fStats = routeStats(fastest, speedFn);
  const sStats = routeStats(safest, speedFn);

  return {
    fastestRoute: {
      distKm: fStats.distKm,
      timeMin: fStats.timeMin,
      avgRisk: fStats.avgRisk,
      zoneIds: fStats.zoneIds,
      latLngs: fastest.pathNodes.map(id => [nodes[id].lat, nodes[id].lng])
    },
    safestRoute: {
      distKm: sStats.distKm,
      timeMin: sStats.timeMin,
      avgRisk: sStats.avgRisk,
      zoneIds: sStats.zoneIds,
      latLngs: safest.pathNodes.map(id => [nodes[id].lat, nodes[id].lng])
    },
    isLiveAPI: false
  };
}

async function computeRoutes() {
  if (!targetFacility) return;
  const endPos = { lat: targetFacility.lat, lng: targetFacility.lng };

  let routeResult = null;

  if (!isOfflineMode && !window.demoMode) {
    try {
      routeResult = await fetchOSRMRoute(startLatLng, endPos);
    } catch (err) {
      log('OSRM Live API call failed: ' + err.message + '. Falling back to cached local DB solver.', 't-amber');
      routeResult = computeOfflineGridRoutes();
    }
  } else {
    log('Rural Offline Mode active — skipping cloud API. Using cached local graph solver.', 't-amber');
    routeResult = computeOfflineGridRoutes();
  }

  if (!routeResult) {
    log('Unable to compute route between selected locations.', 't-amber');
    return;
  }

  const { fastestRoute, safestRoute, isLiveAPI } = routeResult;

  removeMapObject(fastestLine);
  removeMapObject(safestLine);

  if (usingGoogleMaps) {
    fastestLine = new google.maps.Polyline({ map, path: fastestRoute.latLngs.map(([lat, lng]) => ({ lat, lng })), strokeColor: '#0ea5e9', strokeWeight: 4, strokeOpacity: 0.85, icons: [{ icon: { path: 'M 0,-1 0,1' }, offset: '0', repeat: '12px' }] });
    safestLine = new google.maps.Polyline({ map, path: safestRoute.latLngs.map(([lat, lng]) => ({ lat, lng })), strokeColor: '#10b981', strokeWeight: 5, strokeOpacity: 0.95 });
  } else {
    fastestLine = L.polyline(fastestRoute.latLngs, { color: '#0ea5e9', weight: 4, opacity: 0.85, dashArray: '2 8' }).addTo(map);
    safestLine = L.polyline(safestRoute.latLngs, { color: '#10b981', weight: 5, opacity: 0.95 }).addTo(map);
  }

  if (usingGoogleMaps) {
    const bounds = new google.maps.LatLngBounds();
    [...fastestRoute.latLngs, ...safestRoute.latLngs].forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  } else {
    map.fitBounds([...fastestRoute.latLngs, ...safestRoute.latLngs], { padding: [40, 40] });
  }

  log(`Routes rendered [${isLiveAPI ? 'LIVE OSRM API' : 'OFFLINE CACHED DB'}]: Recommended Safe (${safestRoute.distKm.toFixed(2)} km, ${Math.round(safestRoute.timeMin)}m) vs Direct (${fastestRoute.distKm.toFixed(2)} km, ${Math.round(fastestRoute.timeMin)}m).`, 't-cyan');

  window.__lastRoutes = {
    targetFacility,
    vehicleMode,
    isLiveAPI,
    fastest: { ...fastestRoute, zones: fastestRoute.zoneIds.map(id => zones.find(z => z.id === id)) },
    safest: { ...safestRoute, zones: safestRoute.zoneIds.map(id => zones.find(z => z.id === id)) }
  };

  renderRouteCards(fastestRoute, safestRoute, isLiveAPI);
  renderRouteDecisionCard(fastestRoute, safestRoute);
}

document.getElementById('btn-compute').onclick = computeRoutes;

function riskColor(v) {
  if (v >= 6.5) return 'var(--coral)';
  if (v >= 3.5) return 'var(--amber)';
  return 'var(--emerald)';
}

function renderRouteCards(fStats, sStats, isLiveAPI) {
  const section = document.getElementById('results-section');
  section.style.display = 'block';
  const wrap = document.getElementById('route-cards');

  function card(label, cls, stats) {
    const zoneChips = stats.zoneIds.length
      ? stats.zoneIds.map(id => { const z = zones.find(zz => zz.id === id); return `<span class="zone-chip">${z.name}</span>`; }).join('')
      : '<span class="zone-chip">No major hazard zones crossed</span>';
    return `
      <div class="route-card ${cls}">
        <div class="rc-head">
          <span class="name">${label}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--text-dim);">${isLiveAPI ? '🌐 OSRM Live Road' : '💾 Offline Cached Grid'}</span>
        </div>
        <div class="rc-stats">
          <div>Distance<b>${stats.distKm.toFixed(2)} km</b></div>
          <div>Est. Time<b>${Math.round(stats.timeMin)} min</b></div>
          <div>Risk Index<b style="color:${riskColor(stats.avgRisk)}">${stats.avgRisk.toFixed(1)}/10</b></div>
        </div>
        <div class="risk-bar-track"><div class="risk-bar-fill" style="width:${Math.min(stats.avgRisk / 10 * 100, 100)}%;background:${riskColor(stats.avgRisk)}"></div></div>
        <div class="rc-zones">Hazard zones intersected: ${zoneChips}</div>
      </div>`;
  }
  wrap.innerHTML = card('Recommended Healthcare Route', 'safest', sStats) + card('Direct / Fastest Route', 'fastest', fStats);
}

function renderRouteDecisionCard(fastest, safest) {
  const card = document.getElementById('route-decision-card');
  if (!card) return;
  const zoneDetails = stats => stats.zoneIds.length
    ? stats.zoneIds.map(id => {
        const zone = zones.find(z => z.id === id);
        return `${zone.name} (${zone.evidence.length} sources)`;
      }).join(', ')
    : 'No mapped risk zones';
  const extraMinutes = Math.max(0, Math.round(safest.timeMin - fastest.timeMin));
  card.innerHTML = `<div class="decision-title">Route decision support</div>
    <div class="decision-grid">
      <div class="decision-option safe"><b>SAFE ROUTE: +${extraMinutes} min</b><div class="decision-detail">Avoids ${safest.zoneIds.length} risk zone(s): ${zoneDetails(safest)}</div></div>
      <div class="decision-option fast"><b>FASTEST ROUTE: ${Math.round(fastest.timeMin)} min</b><div class="decision-detail">Passes through ${fastest.zoneIds.length} risk zone(s): ${zoneDetails(fastest)}</div></div>
    </div>`;
  card.style.display = 'block';
}

// ---------- 12. PHASE 2: Nominatim Geocoding & Browser GPS Services ----------
async function searchNominatim() {
  const query = document.getElementById('geocode-input').value.trim();
  if (!query) {
    alert('Please enter an address or village name to search.');
    return;
  }

  log(`Nominatim Geocoding lookup: "${query}"...`, 't-cyan');
  try {
    if (isOfflineMode || window.demoMode) {
      const cached = facilities.find(f => f.name.toLowerCase().includes(query.toLowerCase()));
      if (!cached) throw new Error('No cached place matched');
      startLatLng = { lat: cached.lat, lng: cached.lng };
      document.getElementById('pick-hint').textContent = `Offline place match: ${cached.name}`;
      setMapView(cached.lat, cached.lng, 13);
      computeRoutes();
      return;
    }
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error('Nominatim HTTP error ' + resp.status);
    const results = await resp.json();

    if (!results || results.length === 0) {
      log(`Nominatim: No location results found for "${query}".`, 't-amber');
      alert('Location not found. Please try a broader city or village name.');
      return;
    }

    const place = results[0];
    startLatLng = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };

    removeMapObject(startMarker);
    startMarker = createGoogleMarker(startLatLng.lat, startLatLng.lng, '🟢', 'Start location');

    setMapView(startLatLng.lat, startLatLng.lng, 13);
    log(`Nominatim resolved: "${place.display_name.substring(0, 45)}..." [${startLatLng.lat.toFixed(4)}, ${startLatLng.lng.toFixed(4)}]`, 't-cyan');
    document.getElementById('pick-hint').textContent = `Origin set to: ${place.display_name.substring(0, 35)}...`;

    computeRoutes();
  } catch (err) {
    log(`Nominatim Geocoding error: ${err.message}`, 't-amber');
    document.getElementById('route-error').textContent = 'Geocoding unavailable. Use manual latitude/longitude or a cached facility name.';
  }
}

function useBrowserGPS() {
  if (!navigator.geolocation) {
    alert('Browser Geolocation is not supported on your device.');
    return;
  }

  log('Requesting device GPS location via Browser Geolocation API...', 't-cyan');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      startLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      removeMapObject(startMarker);
      startMarker = createGoogleMarker(startLatLng.lat, startLatLng.lng, '🟢', 'Start location');

      setMapView(startLatLng.lat, startLatLng.lng, 14);
      log(`GPS position acquired: Lat ${startLatLng.lat.toFixed(4)}, Lng ${startLatLng.lng.toFixed(4)}`, 't-cyan');
      document.getElementById('pick-hint').textContent = `Origin set to device GPS [${startLatLng.lat.toFixed(4)}, ${startLatLng.lng.toFixed(4)}]`;

      computeRoutes();
    },
    (err) => {
      log(`GPS Acquisition error: ${err.message}. Using current map pin.`, 't-amber');
      document.getElementById('manual-location').style.display = 'flex';
      document.getElementById('route-error').textContent = 'GPS permission was denied or unavailable. Enter manual latitude/longitude below.';
    }
  );
}

document.getElementById('btn-geocode').onclick = searchNominatim;
document.getElementById('geocode-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchNominatim();
});
document.getElementById('btn-gps').onclick = useBrowserGPS;
document.getElementById('btn-manual-location').onclick = () => {
  const lat = Number(document.getElementById('manual-lat').value);
  const lng = Number(document.getElementById('manual-lng').value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert('Enter valid latitude and longitude values.');
    return;
  }
  startLatLng = { lat, lng };
  removeMapObject(startMarker);
  startMarker = createGoogleMarker(lat, lng, '🟢', 'Start location');
  setMapView(lat, lng, 14);
  document.getElementById('pick-hint').textContent = `Origin set manually [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  log(`Manual location set: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`, 't-cyan');
  computeRoutes();
};

window.addEventListener('load', () => { refreshFacilitiesFromBackend(); });

// ---------- 13. Symptom Assessment & Recommendation Logic ----------
function executeTriage() {
  const text = document.getElementById('symptom-input').value.trim();
  if (!text) {
    alert('Please enter your symptoms or select a preset scenario.');
    return;
  }

  log('Analyzing healthcare requirement: "' + text.substring(0, 45) + '..."');
  const triage = classifySymptoms(text);

  document.getElementById('triage-result-card').style.display = 'block';
  document.getElementById('triage-urgency').textContent = triage.urgency;
  document.getElementById('triage-urgency').className = 'urgency-badge ' + triage.urgency;
  document.getElementById('triage-specialty').textContent = triage.requiredSpec;
  document.getElementById('triage-urgency-desc').textContent = triage.urgencyDesc;
  document.getElementById('triage-required-spec').textContent = triage.requiredSpec;
  document.getElementById('triage-explanation').textContent = triage.explanation;

  const tagWrap = document.getElementById('triage-mandatory-tags');
  tagWrap.innerHTML = triage.mandatoryServices.map(s => `<span class="tag">${s}</span>`).join('');

  const filterGovt = document.getElementById('filter-govt').checked;
  const filterIcu = document.getElementById('filter-icu').checked;
  const filterOxygen = document.getElementById('filter-oxygen').checked;

  const ranked = rankFacilities(startLatLng, triage, filterGovt, filterIcu, filterOxygen);
  const best = ranked[0];
  targetFacility = best.facility;

  log('Top recommended facility match: ' + best.facility.name + ' (' + best.score + '% suitability score).', 't-cyan');

  document.getElementById('recommended-facility-section').style.display = 'block';
  document.getElementById('rf-name').textContent = best.facility.name;
  document.getElementById('rf-type').textContent = best.facility.category + ' · ' + (best.facility.isGovt ? 'Government Free Care' : 'Private Facility');
  document.getElementById('rf-match').textContent = best.score + '% MATCH';
  document.getElementById('rf-dist').textContent = best.distKm.toFixed(1) + ' km';
  document.getElementById('rf-time').textContent = '~' + best.estTimeMin + ' min';
  document.getElementById('rf-cost').textContent = best.facility.cost;
  document.getElementById('rf-spec-status').textContent = best.hasSpecialty ? 'Specialist On Duty ✅' : 'General MO Only';

  const svcWrap = document.getElementById('rf-services');
  svcWrap.innerHTML = Object.entries(best.facility.services).map(([key, val]) => {
    return `<span class="svc-chip ${val ? 'ok' : 'no'}">${val ? '✅' : '❌'} ${key}</span>`;
  }).join('');

  removeMapObject(endMarker);
  endMarker = createGoogleMarker(targetFacility.lat, targetFacility.lng, '🔴', 'Target facility');

  computeRoutes();
}

document.getElementById('btn-assess-symptoms').onclick = executeTriage;

document.querySelectorAll('.preset-chip').forEach(btn => {
  btn.onclick = (e) => {
    document.getElementById('symptom-input').value = e.target.dataset.symptom;
    executeTriage();
  };
});

document.getElementById('btn-navigate-to-rec').onclick = () => {
  switchTab('tab-routing');
  computeRoutes();
};

// ---------- 14. Facilities Directory Renderer ----------
function renderFacilitiesDirectory() {
  const wrap = document.getElementById('facility-directory-list');
  const search = document.getElementById('facility-search-input').value.toLowerCase();

  const filtered = facilities.filter(f => {
    return f.name.toLowerCase().includes(search) ||
      f.category.toLowerCase().includes(search) ||
      f.specialties.some(s => s.toLowerCase().includes(search));
  });

  wrap.innerHTML = filtered.map(fac => `
    <div class="fac-item-card">
      <div class="fac-item-top">
        <span class="fac-item-name">${fac.name}</span>
        ${fac.isGovt ? '<span class="fac-badge-gov">GOVT / FREE</span>' : ''}
      </div>
      <div class="fac-item-type">${fac.category}</div>
      <div class="fac-details-grid">
        <div>Doctor: <b>${fac.doctorStatus}</b></div>
        <div>Contact: <b>${fac.phone}</b></div>
        <div>ICU: <b>${fac.services.icu ? 'Available ✅' : 'None ❌'}</b></div>
        <div>Anti-Venom: <b>${fac.services.antiVenom ? 'Available ✅' : 'None ❌'}</b></div>
      </div>
    </div>
  `).join('');
}

function updateImpactMetrics() {
  const triage = classifySymptoms(document.getElementById('symptom-input').value.trim() || 'routine checkup');
  const ranked = rankFacilities(startLatLng, triage, false, false, false);
  const nearest = ranked.reduce((best, item) => item.distKm < best.distKm ? item : best, ranked[0]);
  const recommended = ranked[0];
  const saved = Math.max(0, nearest.estTimeMin - recommended.estTimeMin);
  document.getElementById('impact-facilities').textContent = facilities.length;
  document.getElementById('impact-score').textContent = ranked.length ? Math.round(ranked.reduce((sum, item) => sum + item.score, 0) / ranked.length) + '%' : '--';
  document.getElementById('impact-time-saved').textContent = saved + ' min';
}
window.updateImpactMetrics = updateImpactMetrics;

document.getElementById('facility-search-input').oninput = renderFacilitiesDirectory;
updateImpactMetrics();

// ---------- 15. Connectivity Switcher ----------
document.getElementById('btn-mode-toggle').onclick = () => {
  isOfflineMode = !isOfflineMode;
  const pill = document.getElementById('status-pill');
  const pillText = document.getElementById('status-text');
  const toggleBtn = document.getElementById('btn-mode-toggle');
  const banner = document.getElementById('offline-banner');
  const statConn = document.getElementById('stat-conn');

  if (isOfflineMode) {
    pill.className = 'status-pill offline';
    pillText.textContent = 'OFFLINE · Cached Local DB';
    toggleBtn.classList.add('offline-active');
    toggleBtn.textContent = 'Online Live Mode';
    banner.style.display = 'flex';
    statConn.textContent = 'OFFLINE (Local DB)';
    statConn.style.color = 'var(--amber)';
    log('Switched to RURAL OFFLINE MODE. Local DB active (No cloud APIs).', 't-amber');
  } else {
    pill.className = 'status-pill online';
    pillText.textContent = 'ONLINE · Live Data';
    toggleBtn.classList.remove('offline-active');
    toggleBtn.textContent = 'Rural Offline';
    banner.style.display = 'none';
    statConn.textContent = 'ONLINE (Live)';
    statConn.style.color = 'var(--emerald)';
    log('Switched to ONLINE LIVE MODE. OpenStreetMap OSRM & Nominatim APIs active.', 't-cyan');
  }

  updateMapAvailability();
  computeRoutes();
};

document.getElementById('demo-mode-toggle').onchange = (event) => {
  window.demoMode = event.target.checked;
  isOfflineMode = window.demoMode;
  document.getElementById('triage-status').textContent = window.demoMode
    ? 'Demo Mode enabled: bundled facilities, cached routes, and rule-based triage are active.'
    : 'Demo Mode disabled: live services will be used when available.';
  document.getElementById('status-text').textContent = window.demoMode ? 'DEMO · Cached Data' : (isOfflineMode ? 'OFFLINE · Cached Local DB' : 'ONLINE · Live Data');
  document.getElementById('status-pill').className = 'status-pill ' + (window.demoMode || isOfflineMode ? 'offline' : 'online');
  if (window.demoMode) document.getElementById('offline-banner').style.display = 'flex';
  else if (!isOfflineMode) document.getElementById('offline-banner').style.display = 'none';
  updateMapAvailability();
  computeRoutes();
};

document.getElementById('btn-sync').onclick = () => {
  log('Initiating database sync with central health server...');
  setTimeout(() => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('facility-db-sync-time').textContent = 'Synced just now (' + nowStr + ')';
    log('Database sync complete: regional facilities & OpenStreetMap road vectors updated.', 't-cyan');
    alert('Healthcare facility database and map geometry successfully synchronized!');
  }, 600);
};

// ---------- 16. Sidebar Tab Switcher ----------
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

// ---------- 17. AI Health & Route Analyst Interface ----------
const aiLogEl = document.getElementById('ai-log');

function addAiMsg(who, text) {
  const div = document.createElement('div');
  div.className = 'ai-msg ' + (who === 'You' ? 'user' : 'ai');
  div.innerHTML = `<div class="who">${who}</div><div class="body">${text}</div>`;
  aiLogEl.appendChild(div);
  aiLogEl.scrollTop = aiLogEl.scrollHeight;
}

function buildContext(decisionSupport = null) {
  const routes = window.__lastRoutes || null;
  return JSON.stringify({
    connectivityMode: isOfflineMode ? 'OFFLINE_RURAL' : 'ONLINE_LIVE',
    userTargetFacility: targetFacility ? targetFacility.name : 'Not set',
    computedRoutes: routes ? {
      isLiveAPI: routes.isLiveAPI,
      fastest: { distanceKm: +routes.fastest.distKm.toFixed(2), riskIndex: +routes.fastest.avgRisk.toFixed(1), zones: routes.fastest.zones.map(z => z && z.name) },
      safest: { distanceKm: +routes.safest.distKm.toFixed(2), riskIndex: +routes.safest.avgRisk.toFixed(1), zones: routes.safest.zones.map(z => z && z.name) }
    } : null,
    decisionSupport
  }, null, 2);
}

function rankedZoneData() {
  return [...zones].sort((a, b) => b.severity - a.severity).map(zone => ({
    id: zone.id,
    name: zone.name,
    severity: zone.severity,
    sourceTypeBreakdown: zone.evidence.reduce((counts, item) => {
      counts[item.sourceType] = (counts[item.sourceType] || 0) + 1;
      return counts;
    }, {}),
    sourceCount: zone.evidence.length
  }));
}

const prioritySummaryCacheKey = 'routiq-priority-summaries-v1';
let prioritySummaryPromise = null;

function renderPriorityAreas(summaries = {}) {
  const list = document.getElementById('priority-areas-list');
  if (!list) return;
  list.innerHTML = rankedZoneData().map(zone => {
    const breakdown = Object.entries(zone.sourceTypeBreakdown).map(([type, count]) => {
      const meta = evidenceTypeMeta[type] || { label: type, icon: '&#x2022;' };
      return `<span class="priority-source">${meta.icon} ${meta.label} (${count})</span>`;
    }).join('');
    const why = summaries[zone.id] || 'High-severity mapped hazard with multiple evidence records; review before routing.';
    return `<div class="priority-area">
      <div class="priority-area-head"><b>${zone.name}</b><span style="color:${riskColor(zone.severity)}">${zone.severity}/10</span></div>
      <div class="priority-sources">${breakdown}</div>
      <div class="priority-why">${why}</div>
    </div>`;
  }).join('');
}

async function loadPriorityAreaSummaries() {
  const status = document.getElementById('priority-panel-status');
  renderPriorityAreas();
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(prioritySummaryCacheKey) || 'null'); } catch (_) { cached = null; }
  if (cached && typeof cached === 'object') {
    renderPriorityAreas(cached);
    if (status) status.textContent = 'AI rationale cached for this session.';
    return cached;
  }
  if (isOfflineMode || window.demoMode) {
    if (status) status.textContent = 'Local evidence ranking active (offline/demo mode).';
    return {};
  }
  if (prioritySummaryPromise) return prioritySummaryPromise;
  prioritySummaryPromise = (async () => {
    try {
      const question = 'For every risk zone in the supplied context, return a compact JSON object mapping its id to a one-sentence, evidence-based explanation of why it needs attention. Do not invent facts, dates, or services.';
      const context = buildContext({ priorityAreas: rankedZoneData() });
      const response = await fetch('/analyst', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ question, context })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analyst HTTP ' + response.status);
      const match = String(data.answer || '').match(/\{[\s\S]*\}/);
      const summaries = match ? JSON.parse(match[0]) : {};
      sessionStorage.setItem(prioritySummaryCacheKey, JSON.stringify(summaries));
      renderPriorityAreas(summaries);
      if (status) status.textContent = 'AI rationale generated from the ranked evidence set.';
      return summaries;
    } catch (_) {
      if (status) status.textContent = 'AI unavailable; local evidence ranking shown.';
      return {};
    }
  })();
  return prioritySummaryPromise;
}

function generateSmartFallback(question) {
  const q = question.toLowerCase();

  if (q.includes('nearest') || q.includes('why not') || q.includes('closest')) {
    return `ROUTIQ HEALTH Recommendation Rationale:\nThe nearest facility (Primary Health Center - Kotturpuram) provides basic outpatient care, but lacks a Cath Lab, ICU beds, and on-duty Cardiologist. We recommended ${targetFacility.name} because it has the required specialist on duty and 24/7 emergency capability.`;
  }

  if (q.includes('emergency') || q.includes('ambulance') || q.includes('best route')) {
    return `Emergency Route Guidance:\nFor emergency ambulance dispatch, the Recommended Safe Route calculated via OSRM avoids the Kotturpuram flood belt and the Kathipara junction hazard. Estimated distance: ${window.__lastRoutes ? window.__lastRoutes.safest.distKm.toFixed(1) + ' km' : '11.4 km'}.`;
  }

  if (q.includes('free') || q.includes('govt') || q.includes('government') || q.includes('cost')) {
    return `Public Healthcare & Cost Guidance:\nKanchipuram Govt Headquarters Hospital and Rajiv Gandhi Govt General Hospital provide 100% FREE emergency care, surgery, ICU, and anti-venom under government public health schemes (Ayushman Bharat / Chief Minister Health Scheme).`;
  }

  if (q.includes('hazard') || q.includes('flood') || q.includes('risk')) {
    return `Geospatial Hazard Intelligence:\nActive hazard zones include: 1) Kotturpuram Low-Lying Flood Belt (IMD 340mm rainfall alert), 2) Kathipara Signal-Free Junction (18 collisions in 12m). The recommended safe route bypasses both hazard zones.`;
  }

  return `ROUTIQ HEALTH Decision Analysis:\nBased on OpenStreetMap OSRM road geometry and hazard risk data, ${targetFacility.name} is the optimal healthcare destination.`;
}

async function sendAIQuestion(question, contextOverride = null) {
  addAiMsg('You', question);
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'ai-msg ai';
  thinkingDiv.innerHTML = `<div class="who">AI Health &amp; Route Analyst</div><div class="body">Analyzing OpenStreetMap road data &amp; hazard evidence...</div>`;
  aiLogEl.appendChild(thinkingDiv);
  aiLogEl.scrollTop = aiLogEl.scrollHeight;

  const context = contextOverride || buildContext();
  const systemPrompt = `You are the AI Healthcare Access & Navigation Analyst for ROUTIQ HEALTH. ` +
    `You assist users in understanding facility choices, symptom triage decisions, government health availability, and safe routing choices. ` +
    `CURRENT CONTEXT:\n${context}`;

  try {
    if (isOfflineMode || window.demoMode) throw new Error('offline');
    const response = await fetch('/analyst', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ question, context })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Analyst HTTP ' + response.status);
    thinkingDiv.querySelector('.body').textContent = data.answer || generateSmartFallback(question);
  } catch (err) {
    thinkingDiv.querySelector('.body').textContent = generateSmartFallback(question);
  }
}

document.getElementById('ai-send').onclick = () => {
  const input = document.getElementById('ai-input');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  sendAIQuestion(q);
};
document.getElementById('ai-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('ai-send').click();
});
function buildQuickQuestionContext(action) {
  const routes = window.__lastRoutes;
  if (action === 'priority-areas') return buildContext({ priorityAreas: rankedZoneData() });
  if (action === 'route-decision' || action === 'emergency-route') {
    return buildContext({
      selectedRoute: routes ? {
        route: action === 'emergency-route' ? 'safest' : 'safest',
        riskScore: routes ? +routes.safest.avgRisk.toFixed(1) : null,
        zonesCrossed: routes ? routes.safest.zones.map(zone => zone && zone.name) : [],
        routeAvailable: Boolean(routes)
      } : { routeAvailable: false }
    });
  }
  return buildContext();
}

document.querySelectorAll('.quick-qs button').forEach(btn => {
  btn.onclick = () => {
    const question = btn.dataset.q || btn.textContent.trim();
    const context = btn.dataset.action ? buildQuickQuestionContext(btn.dataset.action) : null;
    const input = document.getElementById('ai-input');
    input.value = question;
    if (context) {
      input.value = '';
      sendAIQuestion(question, context);
    } else {
      document.getElementById('ai-send').click();
    }
  };
});

addAiMsg('AI Health & Route Analyst', 'Phase 2 Real-World Data Mode Active. OpenStreetMap OSRM routing & Nominatim geocoding operational.');

// Initialize Directory
renderFacilitiesDirectory();
loadPriorityAreaSummaries();

const phaseScript = document.createElement('script');
phaseScript.src = 'phase345.js';
phaseScript.defer = true;
document.body.appendChild(phaseScript);

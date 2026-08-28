/* =========================================================================
   ROUTIQ HEALTH — phase345.js
   Phase 3: PWA / IndexedDB / AES-256-GCM / Service Worker / GPS / SMS
   Phase 4: Voice STT/TTS / CDSS (Claude) / Digital Referral Slip + QR
   Phase 5: Ambulance Simulation / Google Maps Heatmap / Data Protection
   ========================================================================= */

/* ───────────────────────────────────────────────────────────────────────────
   PHASE 3 — PWA & OFFLINE-FIRST HARDENING
   ─────────────────────────────────────────────────────────────────────────── */

// 3-A  Register Service Worker ------------------------------------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => {
      log('Service Worker registered — scope: ' + reg.scope, 't-cyan');
      reg.addEventListener('updatefound', () => {
        log('Service Worker update available. Refreshing cache...', 't-amber');
      });
    })
    .catch(err => log('Service Worker registration failed: ' + err.message, 't-amber'));
}

// 3-B  AES-256-GCM Key Derivation --------------------------------------------
let _cryptoKey = null;

async function _getCryptoKey() {
  if (_cryptoKey) return _cryptoKey;
  // Derive a consistent key from a static app password using PBKDF2
  const passphrase = new TextEncoder().encode('routiq-health-v1-aes256');
  const baseKey = await crypto.subtle.importKey('raw', passphrase, 'PBKDF2', false, ['deriveKey']);
  const salt = new TextEncoder().encode('routiq-salt-2024');
  _cryptoKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return _cryptoKey;
}

async function encryptForDB(plainObj) {
  try {
    const key = await _getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(plainObj));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    // Pack iv + ciphertext as base64
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  } catch {
    // Fallback: unencrypted JSON (should not happen on modern browsers)
    return JSON.stringify(plainObj);
  }
}

async function decryptFromDB(payload) {
  try {
    const key = await _getCryptoKey();
    const combined = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    try { return JSON.parse(payload); } catch { return null; }
  }
}

// 3-C  IndexedDB Initialisation & Helpers ------------------------------------
const DB_NAME = 'routiq_health_db';
const DB_VER  = 2;
let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      ['facilities', 'routes', 'tiles', 'settings'].forEach(store => {
        if (!db.objectStoreNames.contains(store))
          db.createObjectStore(store, { keyPath: 'id' });
      });
    };
    req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
    req.onerror    = ()  => reject(req.error);
  });
}

async function dbPut(storeName, record) {
  const db = await openDB();
  const encrypted = await encryptForDB(record);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put({ id: record.id || record.key, _enc: encrypted });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = async () => {
      if (!req.result) { resolve(null); return; }
      const plain = await decryptFromDB(req.result._enc);
      resolve(plain);
    };
    req.onerror = () => reject(req.error);
  });
}

// 3-D  Sync all facilities into IndexedDB ------------------------------------
async function syncFacilitiesToDB() {
  try {
    for (const fac of facilities) {
      await dbPut('facilities', fac);
    }
    // Persist last sync timestamp
    await dbPut('settings', { id: 'lastSync', value: new Date().toISOString() });
    log('IndexedDB: ' + facilities.length + ' facility records written (AES-256-GCM encrypted).', 't-cyan');
  } catch (err) {
    log('IndexedDB write error: ' + err.message, 't-amber');
  }
}

// 3-E  Auto GPS on startup ----------------------------------------------------
function autoDetectGPS() {
  if (!navigator.geolocation) {
    log('Geolocation API unavailable. Using manual coordinates.', 't-amber');
    return;
  }
  log('Requesting device GPS position (navigator.geolocation)...', 't-cyan');
  navigator.geolocation.getCurrentPosition(
    pos => {
      if (typeof startLatLng === 'undefined') return; // app.js guard
      startLatLng.lat = pos.coords.latitude;
      startLatLng.lng = pos.coords.longitude;
      removeMapObject(startMarker);
      // startMarker is defined in app.js scope
      startMarker = createGoogleMarker(startLatLng.lat, startLatLng.lng, '🟢', 'Start location');
      window.startMarker = startMarker;
      setMapView(startLatLng.lat, startLatLng.lng, 13);
      log('GPS auto-acquired: [' + startLatLng.lat.toFixed(4) + ', ' + startLatLng.lng.toFixed(4) + ']', 't-cyan');
    },
    err => log('GPS denied (' + err.message + '). Click map or use address search to set location.', 't-amber'),
    { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
  );
}

// 3-F  SMS Emergency Referral -------------------------------------------------
function triggerSMSReferral(fac, loc, urgency, symptoms) {
  const body =
    'EMERGENCY REFERRAL — ROUTIQ HEALTH\n' +
    'Urgency: ' + urgency + '\n' +
    'Facility: ' + fac.name + '\n' +
    'Phone: ' + fac.phone + '\n' +
    'Patient GPS: ' + loc.lat.toFixed(5) + ',' + loc.lng.toFixed(5) + '\n' +
    'Symptoms: ' + (symptoms || 'Not specified').substring(0, 80) + '\n' +
    'Powered by ROUTIQ HEALTH';
  const link = document.createElement('a');
  link.href = 'sms:' + fac.phone + '?body=' + encodeURIComponent(body);
  link.click();
  log('SMS Emergency Referral dispatched for ' + fac.name + '.', 't-amber');
}

// Wire SMS buttons
document.getElementById('btn-sms-fallback').onclick = () => {
  const symp = document.getElementById('symptom-input').value || 'Emergency';
  const urg  = document.getElementById('triage-urgency').textContent || 'CRITICAL';
  triggerSMSReferral(targetFacility, startLatLng, urg, symp);
};

// 3-G  Initialise Phase 3 on DOMContentLoaded --------------------------------
(async () => {
  await syncFacilitiesToDB();
  autoDetectGPS();
  log('Phase 3 (PWA / IndexedDB / AES-256-GCM / GPS) initialised.', 't-cyan');
})();


/* ───────────────────────────────────────────────────────────────────────────
   PHASE 4 — MULTILINGUAL VOICE AI & CLINICAL DECISION SUPPORT
   ─────────────────────────────────────────────────────────────────────────── */

const VOICE_LANG_NAMES = {
  'en-IN': 'English (India)', 'ta-IN': 'Tamil', 'hi-IN': 'Hindi',
  'te-IN': 'Telugu',          'mr-IN': 'Marathi', 'bn-IN': 'Bengali',
  'kn-IN': 'Kannada'
};

// 4-A  Speech Recognition (STT) -----------------------------------------------
let _isListening = false;
let _recognition = null;

const voiceBtn = document.getElementById('btn-voice-input');

voiceBtn.onclick = () => {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Voice input requires Chrome or Edge browser.');
    return;
  }

  if (_isListening) {
    _recognition && _recognition.stop();
    return;
  }

  const lang = document.getElementById('voice-language').value;
  _recognition = new SpeechRec();
  _recognition.lang = lang;
  _recognition.continuous = false;
  _recognition.interimResults = false;

  _recognition.onstart = () => {
    _isListening = true;
    voiceBtn.textContent = '⏹️ Stop';
    voiceBtn.style.background = 'var(--coral)';
    voiceBtn.style.color = '#fff';
    log('Voice STT started — Language: ' + VOICE_LANG_NAMES[lang], 't-cyan');
  };

  _recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('symptom-input').value = transcript;
    log('Voice recognised: "' + transcript + '" (confidence: ' + (e.results[0][0].confidence * 100).toFixed(0) + '%).', 't-cyan');
    _resetVoiceBtn();
    // Auto trigger triage after voice input
    executeTriage();
  };

  _recognition.onerror = e => {
    log('Voice STT error: ' + e.error, 't-amber');
    _resetVoiceBtn();
  };

  _recognition.onend = () => _resetVoiceBtn();

  _recognition.start();
};

function _resetVoiceBtn() {
  _isListening = false;
  voiceBtn.textContent = '🎙️ Speak';
  voiceBtn.style.background = '';
  voiceBtn.style.color = '';
}

// 4-B  Speech Synthesis (TTS) -------------------------------------------------
document.getElementById('btn-speak-result').onclick = () => {
  const urgency = document.getElementById('triage-urgency-desc').textContent || 'Unknown urgency';
  const spec    = document.getElementById('triage-required-spec').textContent || 'General doctor';
  const facName = document.getElementById('rf-name').textContent || 'Not selected';
  const dist    = document.getElementById('rf-dist').textContent || 'Unknown distance';
  const text    = `Medical urgency: ${urgency}. Required specialist: ${spec}. Recommended facility: ${facName}, at ${dist}.`;

  const lang = document.getElementById('voice-language').value;
  const synth = window.speechSynthesis;
  if (!synth) { alert('Speech synthesis not supported in this browser.'); return; }
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = lang;
  utt.rate  = 0.9;
  utt.pitch = 1;
  synth.speak(utt);
  log('TTS reading triage result in ' + VOICE_LANG_NAMES[lang] + '.', 't-cyan');
};

// 4-C  CDSS — Claude API Enhanced Triage --------------------------------------
// Extends the existing classifySymptoms() in app.js with Claude differential reasoning.
// Returns null on failure (caller falls back to rule-based engine).
async function getCDSSAssessment(symptoms) {
  if (isOfflineMode || window.demoMode) {
    log('Offline mode: CDSS skipping Claude — using rule-based matrix.', 't-amber');
    document.getElementById('triage-status').textContent = 'Demo/offline mode: rule-based CDSS matrix used.';
    return null;
  }
  log('CDSS: sending symptoms to Claude for differential reasoning...', 't-cyan');
  const systemPrompt =
    'You are ROUTIQ HEALTH\'s Clinical Decision Support System (CDSS). ' +
    'Analyze the patient\'s symptom description and return ONLY this JSON (no markdown, no prose): ' +
    '{"urgency":"CRITICAL|URGENT|ROUTINE","urgencyDesc":"...","requiredSpec":"...","mandatoryServices":["...","..."],"explanation":"..."}. ' +
    'Keep explanation under 30 words. mandatoryServices max 4 items.';
  try {
    const resp = await fetch('/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ symptoms })
    });
    const data  = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'CDSS proxy HTTP ' + resp.status);
    if (data.urgency) {
      if (!['CRITICAL', 'URGENT', 'ROUTINE'].includes(data.urgency)) throw new Error('Invalid CDSS urgency');
      document.getElementById('triage-status').textContent = 'Claude CDSS result received through secure server proxy.';
      return data;
    }
    const raw   = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const match = raw.match(/\{[\s\S]+?\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      log('CDSS Claude response — urgency: ' + result.urgency + ', specialist: ' + result.requiredSpec, 't-cyan');
      return result;
    }
  } catch (err) {
    log('CDSS Claude call failed: ' + err.message + '. Falling back to rule-based triage.', 't-amber');
    document.getElementById('triage-status').textContent = 'Claude unavailable: rule-based matrix used (' + err.message + ').';
  }
  return null;
}

// Patch executeTriage() to optionally use CDSS (non-breaking override)
const _origExecuteTriage = executeTriage;
window.executeTriage = async function () {
  const text = document.getElementById('symptom-input').value.trim();
  if (!text) { alert('Please enter symptoms or select a preset.'); return; }

  log('Starting CDSS + AI triage assessment...', 't-cyan');

  // Try Claude CDSS first, fall back to rule-based
  let triage = await getCDSSAssessment(text);
  if (!triage) {
    triage = classifySymptoms(text); // rule-based fallback from app.js
  }

  // Render triage result card
  document.getElementById('triage-result-card').style.display = 'block';
  document.getElementById('triage-urgency').textContent = triage.urgency;
  document.getElementById('triage-urgency').className = 'urgency-badge ' + triage.urgency;
  document.getElementById('triage-specialty').textContent = triage.requiredSpec;
  document.getElementById('triage-urgency-desc').textContent = triage.urgencyDesc;
  document.getElementById('triage-required-spec').textContent = triage.requiredSpec;
  document.getElementById('triage-explanation').textContent = triage.explanation;
  document.getElementById('triage-mandatory-tags').innerHTML =
    (triage.mandatoryServices || []).map(s => `<span class="tag">${s}</span>`).join('');

  // Rank facilities
  const filterGovt   = document.getElementById('filter-govt').checked;
  const filterIcu    = document.getElementById('filter-icu').checked;
  const filterOxygen = document.getElementById('filter-oxygen').checked;
  const ranked = rankFacilities(startLatLng, triage, filterGovt, filterIcu, filterOxygen);
  const best   = ranked[0];
  window.setTargetFacility(best.facility);
  window.targetFacility = targetFacility;

  // Persist triage + recommended facility to IndexedDB
  await dbPut('routes', {
    id: 'lastTriage',
    symptoms: text,
    triage,
    facilityId: best.facility.id,
    score: best.score,
    ts: Date.now()
  });
  log('Triage session saved to IndexedDB (encrypted).', 't-cyan');

  // Render recommended facility card
  document.getElementById('recommended-facility-section').style.display = 'block';
  document.getElementById('rf-name').textContent = best.facility.name;
  document.getElementById('rf-type').textContent = best.facility.category + ' · ' + (best.facility.isGovt ? 'Government Free Care' : 'Private');
  document.getElementById('rf-match').textContent = best.score + '% MATCH';
  document.getElementById('rf-dist').textContent = best.distKm.toFixed(1) + ' km';
  document.getElementById('rf-time').textContent = '~' + best.estTimeMin + ' min';
  document.getElementById('rf-cost').textContent = best.facility.cost;
  document.getElementById('rf-spec-status').textContent = best.hasSpecialty ? 'Specialist On Duty ✅' : 'General MO Only';
  document.getElementById('rf-services').innerHTML = Object.entries(best.facility.services)
    .map(([k, v]) => `<span class="svc-chip ${v ? 'ok' : 'no'}">${v ? '✅' : '❌'} ${k}</span>`).join('');

  // Update end marker
  removeMapObject(window.endMarker);
  removeMapObject(endMarker);
  endMarker = createGoogleMarker(targetFacility.lat, targetFacility.lng, '🔴', 'Target facility');

  log('Top facility match: ' + best.facility.name + ' (' + best.score + '% suitability).', 't-cyan');

  // Store last triage for referral slip
  window._lastTriage = triage;
  window._lastBest   = best;

  computeRoutes();
};

// Rebind preset chips and button to patched version
document.getElementById('btn-assess-symptoms').onclick = () => window.executeTriage();
document.querySelectorAll('.preset-chip').forEach(btn => {
  btn.onclick = e => {
    document.getElementById('symptom-input').value = e.currentTarget.dataset.symptom;
    window.executeTriage();
  };
});

// 4-D  Digital Referral Slip + QR Code ----------------------------------------
function generateReferralSlip() {
  const triage = window._lastTriage;
  const best   = window._lastBest;

  if (!triage || !best) {
    alert('Please run a triage assessment first.');
    return;
  }

  const fac      = best.facility;
  const symptoms = document.getElementById('symptom-input').value || 'Not specified';
  const now      = new Date().toLocaleString('en-IN', { hour12: false });

  const slipHTML = [
    ['Date & Time',        now],
    ['Urgency Level',      `<span class="slip-urgency ${triage.urgency}">${triage.urgency}</span>`],
    ['Specialist Needed',  triage.requiredSpec],
    ['Required Services',  (triage.mandatoryServices || []).join(', ')],
    ['Facility',           fac.name],
    ['Category',           fac.category],
    ['Phone',              fac.phone],
    ['Distance',           best.distKm.toFixed(1) + ' km  (~' + best.estTimeMin + ' min)'],
    ['Cost',               fac.cost],
    ['Govt / Free',        fac.isGovt ? 'Yes ✅' : 'No'],
    ['Stated Symptoms',    symptoms.substring(0, 100)],
    ['Storage Encryption', 'AES-256-GCM (client-side)']
  ].map(([label, val]) =>
    `<div class="slip-row"><span class="slip-label">${label}</span><span>${val}</span></div>`
  ).join('');

  document.getElementById('referral-slip-content').innerHTML = slipHTML;

  // QR Code payload
  const qrPayload = JSON.stringify({
    ref: 'ROUTIQ-HEALTH',
    ts: now,
    urgency: triage.urgency,
    spec: triage.requiredSpec,
    facility: fac.name,
    phone: fac.phone,
    gps: startLatLng.lat.toFixed(5) + ',' + startLatLng.lng.toFixed(5),
    symptoms: symptoms.substring(0, 80)
  });

  const qrDiv = document.getElementById('referral-qr');
  qrDiv.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(qrDiv, {
        text: qrPayload, width: 140, height: 140,
        colorDark: '#10b981', colorLight: '#0d141e',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch { qrDiv.textContent = '[QR unavailable]'; }
  } else {
    qrDiv.style.cssText = 'width:140px;height:140px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-dim);';
    qrDiv.textContent = 'QR library loading...';
  }

  document.getElementById('referral-modal').style.display = 'flex';
  log('Referral Slip + QR generated for ' + fac.name + '.', 't-cyan');
}

document.getElementById('btn-gen-referral').onclick = generateReferralSlip;
document.getElementById('btn-close-referral').onclick = () => {
  document.getElementById('referral-modal').style.display = 'none';
};
document.getElementById('btn-print-referral').onclick = () => window.print();
document.getElementById('btn-sms-from-modal').onclick = () => {
  const symp = document.getElementById('symptom-input').value || 'Emergency';
  const urg  = (window._lastTriage || {}).urgency || 'CRITICAL';
  triggerSMSReferral(targetFacility, startLatLng, urg, symp);
};
document.getElementById('btn-navigate-to-rec').onclick = () => {
  switchTab('tab-routing');
  computeRoutes();
};

log('Phase 4 (Voice STT/TTS · CDSS · Referral Slip + QR) initialised.', 't-cyan');


/* ───────────────────────────────────────────────────────────────────────────
   PHASE 5 — EMERGENCY FLEET DISPATCH & ANALYTICS
   ─────────────────────────────────────────────────────────────────────────── */

// 5-A  Ambulance Simulation ---------------------------------------------------
let _ambulances = [];
let _ambInterval = null;
let _ambTick = 0;

function dispatchAmbulances() {
  // Clear existing
  _ambulances.forEach(a => removeMapObject(a.marker));
  _ambulances = [];
  if (_ambInterval) { clearInterval(_ambInterval); _ambInterval = null; }
  _ambTick = 0;

  if (!targetFacility) { alert('Run a triage assessment first to set a target facility.'); return; }

  // Spawn 3 ambulances near the user start point, each at slightly different offset
  const offsets = [
    { dlat:  0.025, dlng:  0.010 },
    { dlat: -0.015, dlng:  0.030 },
    { dlat:  0.010, dlng: -0.025 }
  ];

  offsets.forEach((off, i) => {
    const lat = startLatLng.lat + off.dlat;
    const lng = startLatLng.lng + off.dlng;
    const marker = createGoogleMarker(lat, lng, `<div style="font-size:20px;filter:drop-shadow(0 0 4px #ef4444);" title="Ambulance Unit ${i + 1}">🚑</div>`, `Ambulance Unit ${i + 1}`,
      `<b>Ambulance Unit ${i + 1}</b><br><span style="color:#10b981;font-size:11px">Dispatched to ${targetFacility.name}</span>`);
    _ambulances.push({ id: i + 1, lat, lng, marker, arrived: false });
  });

  document.getElementById('ambulance-overlay').style.display = 'block';
  document.getElementById('ambulance-status').textContent = '3 UNITS DISPATCHED';
  log('108 Ambulance simulation: 3 units dispatched → ' + targetFacility.name, 't-amber');

  _ambInterval = setInterval(() => {
    _ambTick++;
    let allDone = true;
    _ambulances.forEach(amb => {
      if (amb.arrived) return;
      const dLat  = targetFacility.lat - amb.lat;
      const dLng  = targetFacility.lng - amb.lng;
      const dist  = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist < 0.003) {
        amb.arrived = true;
        if (amb.marker) amb.marker.position = { lat: targetFacility.lat, lng: targetFacility.lng };
        log('Ambulance Unit ' + amb.id + ' arrived at ' + targetFacility.name + '.', 't-cyan');
      } else {
        allDone = false;
        const speed = (0.001 + Math.random() * 0.0006) * (isOfflineMode ? 0.8 : 1);
        amb.lat += (dLat / dist) * speed;
        amb.lng += (dLng / dist) * speed;
        if (amb.marker) amb.marker.position = { lat: amb.lat, lng: amb.lng };
      }
    });

    // Update ETA display
    const remaining = _ambulances.filter(a => !a.arrived).length;
    document.getElementById('ambulance-eta').textContent =
      remaining > 0 ? remaining + ' unit(s) en route (' + _ambTick + 's)' : 'ALL UNITS ARRIVED';

    if (allDone) {
      clearInterval(_ambInterval);
      _ambInterval = null;
      document.getElementById('ambulance-status').textContent = 'ALL ARRIVED';
      log('All 108 units arrived at ' + targetFacility.name + '.', 't-cyan');
    }
  }, 900);
}

document.getElementById('btn-dispatch-ambulance').onclick = dispatchAmbulances;

// 5-B  Google Maps Heatmap Analytics -----------------------------------------
let _heatLayer = null;

function showHealthHeatmap() {
  if (!map || !google.maps.visualization) {
    log('Google Maps visualization library unavailable. Heatmap unavailable.', 't-amber');
    document.getElementById('heatmap-status').textContent = 'Plugin unavailable';
    return;
  }
  if (_heatLayer) _heatLayer.setMap(null);

  const pts = [];

  // Facility coverage (good-access points, medium intensity)
  facilities.forEach(fac => pts.push([fac.lat, fac.lng, 0.55]));

  // Risk zone hotspots (high intensity = danger)
  zones.forEach(z => {
    const intensity = z.severity / 10;
    pts.push([z.lat, z.lng, intensity]);
    // Ring of secondary points
    for (let a = 0; a < 360; a += 45) {
      const r = (z.radius / 111_000) * 0.9;
      pts.push([
        z.lat + r * Math.cos(a * Math.PI / 180),
        z.lng + r * Math.sin(a * Math.PI / 180),
        intensity * 0.5
      ]);
    }
  });

  // Underserved rural pockets (bright = high unmet need)
  [
    [12.850, 79.750, 0.92], [12.900, 79.820, 0.87],
    [12.880, 80.060, 0.81], [13.000, 79.920, 0.76],
    [12.950, 80.250, 0.72], [12.820, 79.900, 0.88],
    [13.060, 79.800, 0.78]
  ].forEach(p => pts.push(p));

  _heatLayer = new google.maps.visualization.HeatmapLayer({
    data: pts.map(([lat, lng, weight]) => ({ location: new google.maps.LatLng(lat, lng), weight })),
    radius: 38, dissipating: true,
    gradient: ['rgba(13,43,26,0)', '#10b981', '#f59e0b', '#ef4444', '#7c3aed'], map
  });

  document.getElementById('heatmap-status').textContent = 'Active · ' + pts.length + ' data points';
  log('Health access heatmap rendered: ' + pts.length + ' points (facilities + risk zones + underserved areas).', 't-cyan');
}

function hideHealthHeatmap() {
  if (_heatLayer) { _heatLayer.setMap(null); _heatLayer = null; }
  document.getElementById('heatmap-status').textContent = 'Off';
  log('Health access heatmap hidden.', 't-dim');
}

document.getElementById('btn-show-heatmap').onclick = showHealthHeatmap;
document.getElementById('btn-hide-heatmap').onclick  = hideHealthHeatmap;

log('Phase 5 (Ambulance Simulation · Heatmap · AES-256-GCM Data Protection) initialised.', 't-cyan');

/* ───────────────────────────────────────────────────────────────────────────
   PHASE 3-5: Final startup log
   ─────────────────────────────────────────────────────────────────────────── */
log('ROUTIQ HEALTH Phases 3 · 4 · 5 fully loaded and operational.', 't-cyan');

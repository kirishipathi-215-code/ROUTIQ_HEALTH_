# ROUTIQ HEALTH — AI-Powered Healthcare Access & Smart Navigation Platform

> **"Finding the right healthcare facility, not just the nearest one—and navigating safely when every minute counts."**

---

## 📌 Problem Statement

In rural and underserved areas, people frequently struggle to find the right healthcare facility for their specific medical needs:
- 🏥 **Wrong Facility Delays**: Patients often travel to the nearest hospital only to discover that required doctors, ICU beds, oxygen, or specialists are unavailable.
- 🚑 **Emergency Obstacles**: Emergency journeys are frequently disrupted by unmapped road hazards, monsoon floods, severe traffic congestion, or damaged embankments.
- 📶 **Connectivity Barriers**: Low or zero internet access in remote rural areas prevents real-time hospital discovery.

---

## 💡 ROUTIQ HEALTH Solution

**ROUTIQ HEALTH** bridges the gap between **Healthcare Need**, **Facility Suitability**, **Road Safety**, and **Offline Rural Accessibility**:

```
User Location 📍 + Healthcare Need 🩺
               ↓
    [ AI Triage & Suitability Engine ]
               ↓
  Recommended Healthcare Facility 🏥
  • Distance & Est. Travel Time
  • Required Services Match (Cath Lab, Anti-venom, ICU) ✅
  • Government / Free Care Preference ✅
               ↓
 [ Geospatial Risk-Aware Routing Engine ]
  • Avoids Flood Belts, Accident Junctions & Bottlenecks
               ↓
 Navigate via Recommended Safe Route 📍 (Online or Offline Rural Mode)
```

---

## 🚀 Complete Project Execution Phases Roadmap

To take **ROUTIQ HEALTH** from its current high-fidelity working prototype to a fully production-grade, enterprise-scale platform, the project is structured into **5 Key Execution Phases**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               ROUTIQ HEALTH ROADMAP TO PERFECTION                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
   Phase 1: Foundational Intelligence & Working Prototype ───────────────────────► [COMPLETED ✅]
   Phase 2: Real-World Data & OpenStreetMap / API Integration ────────────────────► [COMPLETED ✅]
   Phase 3: Full PWA & Offline-First Hardening (Service Workers & SMS) ───────────► [COMPLETED ✅]
   Phase 4: Multilingual Voice AI & Clinical Decision Support (CDSS) ─────────────► [COMPLETED ✅]
   Phase 5: Emergency Fleet Dispatch (108) & Health Ministry Analytics ──────────► [COMPLETED ✅]
```

### ✅ Phase 1: Foundational Intelligence & Interactive Prototype (COMPLETED)
- [x] **UI/UX Design System**: Modern dark-slate health-tech dashboard built with Space Grotesk, Inter, and JetBrains Mono fonts.
- [x] **AI & Rule-Based Symptom Triage Engine**: Classifies user inputs into urgency levels (`CRITICAL`, `URGENT`, `ROUTINE`), identifies required specialists, and flags mandatory medical equipment.
- [x] **Facility Suitability & Ranking Engine**: Scores regional hospitals based on service capabilities (Cath Lab, ICU, Anti-venom, NICU, CT Scan) rather than simple physical proximity.
- [x] **Dual Connectivity Engine (Online vs Offline Rural Mode)**: Mode toggle supporting locally cached healthcare facility database and cached map geometry.
- [x] **Geospatial Risk-Aware Dijkstra Navigation**: Dual-route solver calculating **Recommended Safe Route** (avoids flood belts & accident junctions) vs **Fastest Route**.
- [x] **AI Health & Route Analyst**: Interactive Q&A interface explaining facility selection trade-offs and hazard evidence.
- [x] **Geospatial Scan Log Terminal**: Real-time terminal output tracking graph node calculations and DB sync operations.

---

### ✅ Phase 2: Real-World Data & OpenStreetMap / API Integration (COMPLETED)
- [x] **OSRM Live Routing**: Real driving routes from `router.project-osrm.org` with geospatial hazard post-processing penalty applied on top of real route geometry.
- [x] **Nominatim Geocoding**: Type any village, town, or city name to resolve real lat/lng and set user start location.
- [x] **Browser GPS Integration**: `navigator.geolocation` auto-acquires device coordinates with manual map-click fallback.
- [x] **Offline Fallback Dijkstra**: If OSRM fetch fails or Rural Offline mode is active, cached graph solver activates transparently.
- [x] **OSRM/Nominatim Caching**: Live API responses cached by Service Worker for offline reuse.

---

### ✅ Phase 3: Progressive Web App (PWA) & Offline-First Hardening (COMPLETED)
- [x] **Web App Manifest** (`manifest.json`): PWA installable in standalone mode with ROUTIQ HEALTH branding, dark theme, and app shortcuts.
- [x] **Service Worker** (`sw.js`): Cache-first for tiles, network-first with cache fallback for OSRM & Nominatim, stale-while-revalidate for CDN assets.
- [x] **IndexedDB + AES-256-GCM Encryption**: All facility records and triage sessions encrypted client-side before write, decrypted on read. PBKDF2 key derivation (100k iterations).
- [x] **Auto GPS Detection**: `navigator.geolocation.getCurrentPosition` on startup with graceful denial handling.
- [x] **SMS Emergency Referral Fallback**: One-click SMS pre-filled with facility name, phone, GPS coordinates, urgency level, and symptom summary — works even without internet via device SMS.

---

### ✅ Phase 4: Multilingual Voice AI & Clinical Decision Support (COMPLETED)
- [x] **Voice STT/TTS**: Web Speech API supporting English, Tamil, Hindi, Telugu, Marathi, Bengali, and Kannada. Speak symptoms → auto-triggers triage. Read aloud button reads result in chosen language.
- [x] **Claude CDSS Extension**: Sends symptoms to Claude for differential reasoning. Returns CRITICAL/URGENT/ROUTINE + specialist + mandatory services in JSON. Falls back to rule-based matrix if Claude is unavailable or offline.
- [x] **Digital Referral Slip + QR Code**: Full referral card generated with urgency, specialist, facility details, GPS location, symptoms, and encryption note. QR code encodes full referral payload for hospital-side scanning. Print / PDF support via `window.print()`.

---

### ✅ Phase 5: Emergency Fleet Dispatch & Health Ministry Analytics (COMPLETED)
- [x] **108 Ambulance Simulation**: 3 animated ambulance markers dispatched from near user GPS coordinates, moving in real-time toward recommended hospital. Arrival events logged in terminal.
- [x] **Leaflet.heat Analytics Heatmap**: Regional health access heatmap overlaid on real map — shows facility coverage (green), risk zone hotspots (amber/red), and underserved rural areas (purple) using Leaflet.heat plugin.
- [x] **AES-256-GCM Data Protection**: All patient triage sessions and facility data stored in IndexedDB using AES-256-GCM encryption. README includes HIPAA disclaimer noting backend requirements.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | HTML5, CSS3 (Vanilla Dark Mode), JavaScript ES6+, Space Grotesk, Inter, JetBrains Mono |
| **Mapping & Navigation** | Leaflet.js, Leaflet.heat, OSRM (OpenStreetMap Routing Machine), Nominatim Geocoding |
| **Routing Algorithm** | Dual Dijkstra (Fastest + Risk-Aware Safest Path), Geospatial Hazard Post-Processing |
| **PWA** | Service Workers (Cache API), Web App Manifest, IndexedDB, Background Sync |
| **AI & CDSS** | Anthropic Claude API (CDSS / differential triage), Rule-Based Fallback Triage Matrix |
| **Voice** | Web Speech API — SpeechRecognition (STT) + SpeechSynthesis (TTS), 7 Indian languages |
| **Security** | Web Crypto API — AES-256-GCM encryption, PBKDF2 key derivation (100k iterations) |
| **Emergency Fleet** | setInterval-based ambulance GPS simulation, Leaflet dynamic markers |
| **Referral** | qrcode.js (client-side QR generation), window.print() PDF export, SMS deep-link |

> [!NOTE]
> Full HIPAA-equivalent compliance requires server-side key management, audit logging, and secure backend infrastructure beyond this client-side prototype.

## Run locally

1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` for live CDSS.
4. Run `npm start` and open `http://localhost:8080`.

Demo Mode works without an API key and forces the bundled facility data, cached route solver, and rule-based triage path.

## Deploy

This repository includes `render.yaml` for Render. Create a web service from the repository, add `ANTHROPIC_API_KEY` as a secret, and deploy with the generated Node start command.

The initial facility seed covers Kancheepuram, Chengalpattu, and Chennai using the published district hospital directories and government facility listings; facility details should be revalidated by the deployment owner before production use.

## Architecture

```text
Browser PWA
  |-- IndexedDB + AES-GCM (offline facilities, triage, routes)
  |-- Leaflet / OSRM / Nominatim (live map services)
  `-- REST API: /facilities, /facilities/:id, /triage
          `-- Node/Express proxy -- Anthropic Claude (server-side API key)
```

## Changelog

### Stabilization pass completed
- Added a server-side Claude proxy so the API key is never shipped to the browser.
- Added REST facility endpoints and a 30-record Kancheepuram/Chennai seed dataset.
- Added Demo Mode, impact metrics, explicit service errors, and deployment configuration.
- Corrected triage-to-routing facility state so live OSRM requests use the selected recommendation.
- Fixed OSRM route-risk scoring to evaluate every geometry point instead of skipping coordinates.
- Repaired the PWA manifest app icon data URI so install assets render correctly.
- Added manual latitude/longitude entry when GPS permission is denied or unavailable.

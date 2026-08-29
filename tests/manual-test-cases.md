| Test ID | Module | Input | Expected Output | Actual Output | Pass/Fail |
|---|---|---|---|---|---|
| T-01 | Triage | chest pain symptom | CRITICAL urgency + Cardiologist required |  |  |
| T-02 | Triage | mild headache | ROUTINE urgency |  |  |
| R-01 | Routing | start/end straddling a severity-9 flood zone | safest route avoids it, fastest route may cross it |  |  |
| R-02 | Routing | emergency mode vs civilian mode on same start/end | emergency route has lower ETA and higher risk tolerance |  |  |
| O-01 | Offline | network disabled | cached facility list renders, live-map-unavailable banner shows |  |  |
| F-01 | Facility ranking | symptom requiring Cath Lab | top-ranked facility has `cathLab:true` in its record |  |  |
| S-01 | Smoke test | `npm run smoke-test` | 30+ facilities returned, one facility detail lookup matches by id |  |  |

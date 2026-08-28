const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;
function loadSeed(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return [];
  const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(records) ? records : [];
}

const seededFacilities = [
  ...loadSeed('facilities.seed.json').map(facility => ({ ...facility, region: 'kancheepuram' })),
  ...loadSeed('facilities.vellore.seed.json').map(facility => ({ ...facility, region: 'vellore' }))
];
app.use(cors());
app.use(express.json({limit: '32kb'}));
app.use(express.static(__dirname));

function filterFacilitiesByRegion(region) {
  if (region === 'vellore') return seededFacilities.filter(item => item.region === 'vellore');
  if (region === 'kancheepuram') return seededFacilities.filter(item => item.region === 'kancheepuram');
  return seededFacilities;
}

app.get('/health', (_req, res) => res.json({status: 'ok', service: 'routiq-health', facilities: seededFacilities.length}));
app.get('/facilities', (req, res) => {
  const region = String(req.query.region || 'all').toLowerCase();
  res.json(filterFacilitiesByRegion(region));
});
app.get('/facilities/:id', (req, res) => {
  const facility = seededFacilities.find(item => item.id === req.params.id);
  if (!facility) return res.status(404).json({error: 'Facility not found'});
  res.json(facility);
});

app.post('/triage', async (req, res) => {
  const symptoms = typeof req.body?.symptoms === 'string' ? req.body.symptoms.trim() : '';
  if (!symptoms || symptoms.length > 4000) return res.status(400).json({error: 'symptoms must be 1-4000 characters'});
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({error: 'CDSS is not configured'});
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022', max_tokens: 350,
        system: 'Return only JSON: {"urgency":"CRITICAL|URGENT|ROUTINE","urgencyDesc":"...","requiredSpec":"...","mandatoryServices":["..."],"explanation":"..."}. Keep explanation under 30 words.',
        messages: [{role:'user', content:'Patient symptoms: ' + symptoms}]})
    });
    if (!response.ok) return res.status(502).json({error: 'Claude API request failed'});
    const data = await response.json();
    const raw = (data.content || []).filter(block => block.type === 'text').map(block => block.text).join('');
    const match = raw.match(/\{[\s\S]+\}/);
    if (!match) return res.status(502).json({error: 'Claude returned invalid triage JSON'});
    res.json(JSON.parse(match[0]));
  } catch (error) {
    res.status(502).json({error: 'CDSS proxy unavailable'});
  }
});

app.post('/analyst', async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  const context = typeof req.body?.context === 'string' ? req.body.context.slice(0, 12000) : '';
  if (!question || question.length > 2000) return res.status(400).json({error: 'question must be 1-2000 characters'});
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({error: 'Analyst is not configured'});
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: {'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022', max_tokens: 800,
        system: 'You are ROUTIQ HEALTH\'s healthcare access and safe routing analyst. Use the supplied context and answer clearly.\n' + context,
        messages: [{role:'user', content: question}]})
    });
    if (!response.ok) return res.status(502).json({error:'Analyst API request failed'});
    const data = await response.json();
    const answer = (data.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n').trim();
    if (!answer) return res.status(502).json({error:'Analyst returned no answer'});
    res.json({answer});
  } catch (_) { res.status(502).json({error:'Analyst proxy unavailable'}); }
});

app.listen(port, () => console.log(`ROUTIQ HEALTH server listening on ${port}`));

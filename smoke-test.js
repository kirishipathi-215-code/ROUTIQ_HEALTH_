const baseUrl = process.env.BASE_URL || 'http://localhost:8080';

async function check(path, options) {
  const response = await fetch(baseUrl + path, options);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

(async () => {
  const health = await check('/health');
  if (health.status !== 'ok') throw new Error('Health check failed');
  const facilities = await check('/facilities');
  if (!Array.isArray(facilities) || facilities.length < 30) throw new Error('Facility seed is incomplete');
  const facility = await check('/facilities/' + facilities[0].id);
  if (facility.id !== facilities[0].id) throw new Error('Facility detail response mismatch');
  console.log(`ROUTIQ HEALTH API smoke test passed: ${facilities.length} facilities`);
})().catch(error => {
  console.error('ROUTIQ HEALTH API smoke test failed:', error.message);
  process.exitCode = 1;
});

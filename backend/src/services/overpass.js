const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const PER_MIRROR_TIMEOUT_MS = 12000; // fail over fast when a server is busy

const MIN_GAP_MS = 1200; // min spacing between upstream calls (free tier is ~2 slots)

// Serialize all Overpass traffic through one queue with a minimum gap. The
// public servers rate-limit hard (429) if you fire concurrent/rapid requests,
// which is exactly what happens during fast driving. One-at-a-time + spacing
// keeps us under the limit; the route-level cache absorbs the rest.
let chain = Promise.resolve();
let lastCallAt = 0;

function schedule(task) {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCallAt));
    if (wait) await new Promise(r => setTimeout(r, wait));
    lastCallAt = Date.now();
    return task();
  });
  // Keep the chain alive even if this task throws.
  chain = run.then(() => {}, () => {});
  return run;
}

async function fetchOverpass(query, urlIndex = 0) {
  const url = OVERPASS_URLS[urlIndex % OVERPASS_URLS.length];
  console.log(`[Overpass] Trying ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'AudioguideApp/1.0 (travel storyteller POC)' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(PER_MIRROR_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  } catch (err) {
    if (urlIndex < OVERPASS_URLS.length - 1) {
      console.log(`[Overpass] ${url} failed (${err.message}), trying mirror ${urlIndex + 1}`);
      return fetchOverpass(query, urlIndex + 1);
    }
    throw new Error(`All Overpass mirrors failed: ${err.message}`);
  }
}

async function queryPOIs(lat, lon, radius) {
  // Settlements get their own output slot so a city/town is never truncated by
  // the POI limit in a dense area (cities have lots of historic/tourism nodes).
  const query = `
[out:json][timeout:15];
(
  node["place"~"city|town|village|hamlet|suburb"](around:${radius},${lat},${lon});
)->.places;
(
  node["historic"](around:${radius},${lat},${lon});
  node["tourism"~"museum|attraction|viewpoint|artwork|castle|ruins"](around:${radius},${lat},${lon});
  node["natural"~"peak|waterfall|cave_entrance|hot_spring|volcano|spring"](around:${radius},${lat},${lon});
)->.poi;
.places out 15;
.poi out 40;
`.trim();

  const data = await schedule(() => fetchOverpass(query));

  return data.elements
    .filter(el => el.tags?.name)
    .map(el => ({
      id: `${el.type}-${el.id}`,
      name: el.tags.name,
      lat: el.center?.lat ?? el.lat,
      lon: el.center?.lon ?? el.lon,
      tags: el.tags,
    }))
    .filter(el => el.lat && el.lon);
}

module.exports = { queryPOIs };

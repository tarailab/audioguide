// Self-hosted Overpass holds the LT+LV extract — fast, no rate limits. Use it
// first inside the Baltics bbox; fall back to public mirrors elsewhere (and if
// the local one is ever down).
const LOCAL_OVERPASS = process.env.OVERPASS_LOCAL_URL || 'http://overpass/api/interpreter';
const PUBLIC_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Area covered by the local extract (Lithuania + Latvia, padded).
function inLocalCoverage(lat, lon) {
  return lat >= 53.8 && lat <= 58.2 && lon >= 20.9 && lon <= 28.4;
}
function urlsFor(lat, lon) {
  return inLocalCoverage(lat, lon) ? [LOCAL_OVERPASS, ...PUBLIC_URLS] : PUBLIC_URLS;
}

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

async function fetchOverpass(query, urls, urlIndex = 0) {
  const url = urls[urlIndex];
  const isLocal = url === LOCAL_OVERPASS;
  console.log(`[Overpass] Trying ${isLocal ? 'LOCAL' : url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'AudioguideApp/1.0 (travel storyteller POC)' },
      body: `data=${encodeURIComponent(query)}`,
      // Local has no rate limit and is fast; give it a short patience.
      signal: AbortSignal.timeout(isLocal ? 8000 : PER_MIRROR_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  } catch (err) {
    if (urlIndex < urls.length - 1) {
      console.log(`[Overpass] ${isLocal ? 'LOCAL' : url} failed (${err.message}), trying next`);
      return fetchOverpass(query, urls, urlIndex + 1);
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
  node["heritage"](around:${radius},${lat},${lon});
  node["tourism"~"museum|attraction|viewpoint|artwork|gallery|theme_park|zoo"](around:${radius},${lat},${lon});
  node["natural"~"peak|waterfall|cave_entrance|hot_spring|volcano|spring|cliff|bay|cape|glacier|geyser|rock|arch|sinkhole"](around:${radius},${lat},${lon});
  node["man_made"~"lighthouse|windmill|watermill|tower|obelisk"](around:${radius},${lat},${lon});
  node["geological"](around:${radius},${lat},${lon});
)->.poi;
.places out 15;
.poi out 40;
`.trim();

  const urls = urlsFor(lat, lon);
  const data = await schedule(() => fetchOverpass(query, urls));

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

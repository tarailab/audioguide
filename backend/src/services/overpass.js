// Self-hosted Overpass holds the LT+LV + Spain extract — fast, no rate limits.
// Use it first inside the covered regions; fall back to public mirrors elsewhere
// (and if the local one is ever down).
const LOCAL_OVERPASS = process.env.OVERPASS_LOCAL_URL || 'http://overpass/api/interpreter';
const PUBLIC_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Regions in the local extract (padded bboxes: [south, west, north, east]).
// Keep in sync with the merged pbf in docker-compose (osm/regions.osm.pbf).
const LOCAL_BBOXES = [
  [53.8, 20.9, 58.2, 28.4],   // Lithuania + Latvia
  [35.0, -9.6, 44.0, 4.5],    // Spain mainland + Balearics + Ceuta/Melilla
  [27.4, -18.3, 29.5, -13.3], // Canary Islands
];
function inLocalCoverage(lat, lon) {
  return LOCAL_BBOXES.some(([s, w, n, e]) => lat >= s && lat <= n && lon >= w && lon <= e);
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

async function fetchOverpass(query, urls, urlIndex = 0, localTimeoutMs = 8000) {
  const url = urls[urlIndex];
  const isLocal = url === LOCAL_OVERPASS;
  console.log(`[Overpass] Trying ${isLocal ? 'LOCAL' : url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'AudioguideApp/1.0 (travel storyteller POC)' },
      body: `data=${encodeURIComponent(query)}`,
      // Local has no rate limit; caller sets its patience (browse bbox queries
      // need longer than the driving app's small around-queries).
      signal: AbortSignal.timeout(isLocal ? localTimeoutMs : PER_MIRROR_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  } catch (err) {
    if (urlIndex < urls.length - 1) {
      console.log(`[Overpass] ${isLocal ? 'LOCAL' : url} failed (${err.message}), trying next`);
      return fetchOverpass(query, urls, urlIndex + 1, localTimeoutMs);
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
  return normalize(data);
}

// Browse query for the trip planner: notable POIs inside a map bbox
// (south,west,north,east). CRITICAL: the breadth scales to the view area. A
// country-sized box that asks for every historic/tourism/natural node is a
// pathological Overpass scan — it times out and, because all our Overpass
// traffic is serialized, jams the queue for the whole app. So a wide view
// fetches only headline settlements (cheap, tag-indexed), and the full POI set
// is reserved for a tight, zoomed-in box. No Wikipedia/Wikidata here; enrichment
// is deferred to enrichOne when a POI is actually clicked/added.
async function queryBBox({ south, west, north, east }) {
  const bbox = `${south},${west},${north},${east}`;
  const areaDeg2 = Math.abs((north - south) * (east - west));

  let placesFilter, poiBlock, placesOut, poiOut;
  if (areaDeg2 > 12) {
    // Country scale → cities + towns only.
    placesFilter = 'city|town';
    poiBlock = '';
    placesOut = 200; poiOut = 0;
  } else if (areaDeg2 > 0.6) {
    // Region / province → settlements + the most notable POI types only.
    placesFilter = 'city|town|village';
    poiBlock = `
  node["heritage"](${bbox});
  node["historic"~"castle|fort|monument|memorial|archaeological_site|ruins|monastery|city_gate|tower"](${bbox});
  node["tourism"~"museum|attraction|viewpoint|theme_park|zoo"](${bbox});
  node["natural"~"peak|volcano|waterfall|cave_entrance|glacier"](${bbox});
  node["man_made"~"lighthouse"](${bbox});`;
    placesOut = 120; poiOut = 400;
  } else {
    // Local view → the full detailed set.
    placesFilter = 'city|town|village|hamlet|suburb';
    poiBlock = `
  node["historic"](${bbox});
  node["heritage"](${bbox});
  node["tourism"~"museum|attraction|viewpoint|artwork|gallery|theme_park|zoo"](${bbox});
  node["natural"~"peak|waterfall|cave_entrance|hot_spring|volcano|spring|cliff|bay|cape|glacier|geyser|rock|arch|sinkhole"](${bbox});
  node["man_made"~"lighthouse|windmill|watermill|tower|obelisk"](${bbox});
  node["geological"](${bbox});`;
    placesOut = 80; poiOut = 400;
  }

  const query = `
[out:json][timeout:25];
(
  node["place"~"${placesFilter}"](${bbox});
)->.places;
.places out ${placesOut};
${poiBlock ? `(${poiBlock}\n)->.poi;\n.poi out ${poiOut};` : ''}
`.trim();

  // If the view is inside the local extract, serve it from the local server
  // ONLY — with a generous timeout. A bbox query that's slow locally would only
  // be slower on the public mirrors, and failing over to them (3 × 12s) just
  // jams the shared queue for the whole app. Outside coverage, use the mirrors.
  const covered = inLocalCoverage((south + north) / 2, (west + east) / 2);
  const urls = covered ? [LOCAL_OVERPASS] : PUBLIC_URLS;
  const data = await schedule(() => fetchOverpass(query, urls, 0, 25000));
  return normalize(data);
}

function normalize(data) {
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

module.exports = { queryPOIs, queryBBox };

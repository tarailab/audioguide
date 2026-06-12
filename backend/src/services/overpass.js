const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function fetchOverpass(query, urlIndex = 0) {
  const url = OVERPASS_URLS[urlIndex % OVERPASS_URLS.length];
  console.log(`[Overpass] Trying ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': 'AudioguideApp/1.0 (travel storyteller POC)' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(20000),
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
  const query = `
[out:json][timeout:10];
(
  node["historic"](around:${radius},${lat},${lon});
  node["tourism"~"museum|attraction|viewpoint|artwork|castle|ruins"](around:${radius},${lat},${lon});
  node["natural"~"peak|waterfall|cave_entrance|hot_spring|volcano|spring"](around:${radius},${lat},${lon});
  node["place"~"village|hamlet"](around:${radius},${lat},${lon});
);
out 40;
`.trim();

  const data = await fetchOverpass(query);

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

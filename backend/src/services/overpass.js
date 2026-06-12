const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function queryPOIs(lat, lon, radius) {
  const query = `
[out:json][timeout:15];
(
  node["historic"](around:${radius},${lat},${lon});
  way["historic"](around:${radius},${lat},${lon});
  node["tourism"~"museum|attraction|viewpoint|artwork|castle|ruins"](around:${radius},${lat},${lon});
  way["tourism"~"museum|attraction|viewpoint|castle"](around:${radius},${lat},${lon});
  node["natural"~"peak|waterfall|cave_entrance|hot_spring|volcano|spring"](around:${radius},${lat},${lon});
  node["place"~"village|hamlet"](around:${radius},${lat},${lon});
  way["building"~"cathedral|church|castle|fort|palace|monastery"](around:${radius},${lat},${lon});
);
out center 40;
`.trim();

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

  const data = await res.json();

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

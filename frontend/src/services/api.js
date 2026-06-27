const BASE = import.meta.env.VITE_API_URL || '';

export async function fetchPOIs({ lat, lon, speedKmh, course, heading, interests, params }) {
  const res = await fetch(`${BASE}/api/pois`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, speedKmh, course, heading, interests, params }),
  });
  if (!res.ok) throw new Error(`POI fetch failed: ${res.status}`);
  return res.json(); // { places: [...], area: {...} }
}

// ── Trip planner ─────────────────────────────────────────────────────────────

// Single-user for now; identity is a stub header the backend defaults anyway.
const USER = 'local';
const tripHeaders = { 'Content-Type': 'application/json', 'x-user-id': USER };

async function asJson(res) {
  if (!res.ok) {
    let msg = `${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// Browse a map bbox [south, west, north, east] → lightweight (un-enriched) POIs.
export async function browsePOIs(bbox, limit = 200) {
  const res = await fetch(`${BASE}/api/pois/browse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bbox, limit }),
  });
  return asJson(res); // { places, capped }
}

// Full enrichment for one POI (tier / image / wiki / sitelinks).
export async function enrichPOI(poi) {
  const res = await fetch(`${BASE}/api/pois/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poi }),
  });
  return asJson(res);
}

export const trips = {
  list: () => fetch(`${BASE}/api/trips`, { headers: tripHeaders }).then(asJson),
  get: (id) => fetch(`${BASE}/api/trips/${id}`, { headers: tripHeaders }).then(asJson),
  create: (name) => fetch(`${BASE}/api/trips`, {
    method: 'POST', headers: tripHeaders, body: JSON.stringify({ name }),
  }).then(asJson),
  rename: (id, name) => fetch(`${BASE}/api/trips/${id}`, {
    method: 'PATCH', headers: tripHeaders, body: JSON.stringify({ name }),
  }).then(asJson),
  remove: (id) => fetch(`${BASE}/api/trips/${id}`, {
    method: 'DELETE', headers: tripHeaders,
  }).then(asJson),
  setItem: (id, poi, status, note) => fetch(`${BASE}/api/trips/${id}/items`, {
    method: 'POST', headers: tripHeaders, body: JSON.stringify({ poi, status, note }),
  }).then(asJson),
  updateItem: (id, poiId, patch) => fetch(`${BASE}/api/trips/${id}/items/${encodeURIComponent(poiId)}`, {
    method: 'PATCH', headers: tripHeaders, body: JSON.stringify(patch),
  }).then(asJson),
  removeItem: (id, poiId) => fetch(`${BASE}/api/trips/${id}/items/${encodeURIComponent(poiId)}`, {
    method: 'DELETE', headers: tripHeaders,
  }).then(asJson),
};

export async function fetchStory({ poi, interests, tone, length, language, bearing }) {
  const res = await fetch(`${BASE}/api/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poi, interests, tone, length, language, bearing }),
  });
  if (!res.ok) throw new Error(`Story generation failed: ${res.status}`);
  return res.json();
}

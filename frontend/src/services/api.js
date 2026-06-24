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

export async function fetchStory({ poi, interests, tone, length, language, bearing }) {
  const res = await fetch(`${BASE}/api/story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poi, interests, tone, length, language, bearing }),
  });
  if (!res.ok) throw new Error(`Story generation failed: ${res.status}`);
  return res.json();
}

// Tiny in-memory TTL cache with in-flight de-duplication.
// Keeps repeated POI lookups and story generations from re-hitting the
// upstream APIs (Overpass rate-limits hard; Claude costs money).

const store = new Map();   // key -> { val, exp }
const pending = new Map();  // key -> Promise (a fetch already in flight)
const MAX = 2000;

function get(key) {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { store.delete(key); return null; }
  return e.val;
}

function set(key, val, ttlMs) {
  store.set(key, { val, exp: Date.now() + ttlMs });
  if (store.size > MAX) store.delete(store.keys().next().value);
  return val;
}

// Return cached value if fresh; otherwise run `producer()` once, sharing the
// same promise with any concurrent callers for the same key.
async function remember(key, ttlMs, producer) {
  const hit = get(key);
  if (hit !== null) return hit;

  if (pending.has(key)) return pending.get(key);

  const p = (async () => producer())();
  pending.set(key, p);
  try {
    const val = await p;
    set(key, val, ttlMs);
    return val;
  } finally {
    pending.delete(key);
  }
}

module.exports = { get, set, remember };

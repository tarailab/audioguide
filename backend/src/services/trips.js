const fs = require('fs');
const path = require('path');

// Trips persist to the host-mounted data volume (survives container rebuilds),
// same place as stories.jsonl. One JSON file holding all trips. Multi-user ready:
// every trip has an ownerId + members[], and every item an addedBy — so auth and
// family sharing (see CONTRIBUTING / backlog) slot in without a data reshape.
// Single-user for now: callers pass userId='local'.
const DIR = path.join(__dirname, '../../data');
const FILE = path.join(DIR, 'trips.json');

const VALID_STATUS = ['must', 'research', 'nearby', 'skip'];

let trips = load();

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) || [];
  } catch {
    return [];
  }
}

// Atomic write: tmp file + rename so a crash mid-write can't corrupt the store.
function persist() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(trips, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[Trips] write failed:', err.message);
  }
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function now() {
  return new Date().toISOString();
}

function canAccess(trip, userId) {
  return trip.ownerId === userId || (trip.members || []).includes(userId);
}

// Snapshot just the fields a saved trip needs, so it never depends on a live
// re-fetch / cache hit later. Accepts a raw or enriched POI.
function snapshot(poi) {
  const t = poi.tags || {};
  return {
    name: poi.name,
    lat: poi.lat,
    lon: poi.lon,
    tier: poi.tier || null,
    image: poi.image || null,
    wikiTitle: poi.wiki?.title || t.wikipedia || null,
    osm: poi.id, // "node-123" etc.
    category: t.historic || t.tourism || t.natural || t.man_made || t.place || t.heritage ? true : false,
    tags: {
      historic: t.historic, tourism: t.tourism, natural: t.natural,
      man_made: t.man_made, place: t.place, heritage: t.heritage,
      wikidata: t.wikidata, wikipedia: t.wikipedia,
    },
  };
}

function list(userId) {
  return trips
    .filter((t) => canAccess(t, userId))
    .map((t) => ({
      id: t.id, name: t.name, ownerId: t.ownerId, members: t.members,
      createdAt: t.createdAt, updatedAt: t.updatedAt, itemCount: t.items.length,
    }));
}

function get(tripId, userId) {
  const t = trips.find((x) => x.id === tripId);
  if (!t || !canAccess(t, userId)) return null;
  return t;
}

function create(name, userId) {
  const trip = {
    id: id('trip'),
    name: (name || 'Untitled trip').trim().slice(0, 120),
    ownerId: userId,
    members: [],
    createdAt: now(),
    updatedAt: now(),
    items: [],
  };
  trips.push(trip);
  persist();
  return trip;
}

function rename(tripId, name, userId) {
  const t = get(tripId, userId);
  if (!t) return null;
  t.name = (name || t.name).trim().slice(0, 120);
  t.updatedAt = now();
  persist();
  return t;
}

function remove(tripId, userId) {
  const t = get(tripId, userId);
  if (!t) return false;
  trips = trips.filter((x) => x.id !== tripId);
  persist();
  return true;
}

// Add or update a POI in the trip (upsert by OSM id). status default 'research'.
function setItem(tripId, poi, { status = 'research', note } = {}, userId) {
  const t = get(tripId, userId);
  if (!t) return null;
  if (!VALID_STATUS.includes(status)) return { error: 'invalid status' };

  const poiId = poi.id;
  const existing = t.items.find((i) => i.poiId === poiId);
  if (existing) {
    existing.status = status;
    if (note !== undefined) existing.note = note;
    existing.updatedAt = now();
  } else {
    t.items.push({
      poiId,
      status,
      note: note || '',
      addedBy: userId,
      addedAt: now(),
      updatedAt: now(),
      ...snapshot(poi),
    });
  }
  t.updatedAt = now();
  persist();
  return t;
}

function updateItem(tripId, poiId, patch, userId) {
  const t = get(tripId, userId);
  if (!t) return null;
  const item = t.items.find((i) => i.poiId === poiId);
  if (!item) return { error: 'item not found' };
  if (patch.status !== undefined) {
    if (!VALID_STATUS.includes(patch.status)) return { error: 'invalid status' };
    item.status = patch.status;
  }
  if (patch.note !== undefined) item.note = String(patch.note).slice(0, 2000);
  item.updatedAt = now();
  t.updatedAt = now();
  persist();
  return t;
}

function removeItem(tripId, poiId, userId) {
  const t = get(tripId, userId);
  if (!t) return null;
  const before = t.items.length;
  t.items = t.items.filter((i) => i.poiId !== poiId);
  if (t.items.length === before) return { error: 'item not found' };
  t.updatedAt = now();
  persist();
  return t;
}

module.exports = {
  VALID_STATUS, list, get, create, rename, remove, setItem, updateItem, removeItem,
};

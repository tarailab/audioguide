// POI categories — the trip planner's primary grouping + filter axis. Keys must
// match categoryOf() in backend/src/services/poiEnrich.js. Ordered most- to
// least-notable for stable chip/legend layout.
export const CATEGORIES = [
  { key: 'castle',     label: 'Castles & Forts',    icon: '🏰', color: '#b45309' },
  { key: 'heritage',   label: 'Heritage & History', icon: '🏛️', color: '#a855f7' },
  { key: 'culture',    label: 'Museums & Culture',  icon: '🖼️', color: '#ec4899' },
  { key: 'nature',     label: 'Nature & Geology',   icon: '🌲', color: '#16a34a' },
  { key: 'landmark',   label: 'Landmarks & Views',  icon: '🗼', color: '#f59e0b' },
  { key: 'settlement', label: 'Towns & Cities',     icon: '🏙️', color: '#3b82f6' },
  { key: 'other',      label: 'Other',              icon: '📍', color: '#94a3b8' },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const CATEGORY_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.color]));
export const ALL_CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

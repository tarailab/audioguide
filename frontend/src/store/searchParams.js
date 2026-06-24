// Search-area tuning params. Defaults MUST match backend SEARCH in
// routes/pois.js. The admin panel overrides these live and they ride along on
// each /api/pois request. Admin-only / testing — clear the UI later.
const KEY = 'audioguide-search-params';

export const SEARCH_DEFAULTS = {
  r0: 2000,
  kFwd: 180,
  kSide: 40,
  kBack: 20,
  capNormal: 20000,
  capFallback: 40000,
  nMin: 5,
  minScore: 4,
};

// Slider metadata: [min, max, step, label, unit]
export const SEARCH_FIELDS = [
  ['r0', 500, 6000, 100, 'Base reach', 'm'],
  ['kFwd', 0, 400, 10, 'Forward / km·h', 'm'],
  ['kSide', 0, 200, 5, 'Side / km·h', 'm'],
  ['kBack', 0, 100, 5, 'Back shrink / km·h', 'm'],
  ['capNormal', 5000, 40000, 1000, 'Forward cap', 'm'],
  ['capFallback', 20000, 80000, 5000, 'Fallback cap', 'm'],
  ['nMin', 1, 15, 1, 'Min places', ''],
  ['minScore', 0, 12, 1, 'Min score (>)', ''],
];

export function loadSearchParams() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? { ...SEARCH_DEFAULTS, ...JSON.parse(s) } : { ...SEARCH_DEFAULTS };
  } catch {
    return { ...SEARCH_DEFAULTS };
  }
}

export function saveSearchParams(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

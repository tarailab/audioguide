import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import BrowseMap, { TIER_SIZE, STATUS_RING } from '../components/BrowseMap';
import { browsePOIs, enrichPOI, trips as api } from '../services/api';
import { CATEGORIES, CAT, ALL_CATEGORY_KEYS } from '../store/categories';

// Open on the whole Iberian peninsula — the current planning target.
const SPAIN_CENTER = [40.0, -3.7];
const SPAIN_ZOOM = 6;

// Trip planner — desktop-first. Browse POIs on a map (same A–D classification as
// the audioguide), then mark each into the active trip: must-see, research,
// visit-if-nearby, or skip. Trips persist server-side.

const STATUS = [
  { id: 'must',     label: 'Must',     icon: '⭐', hint: 'Must-see — plan around it' },
  { id: 'research', label: 'Research', icon: '🔍', hint: 'Could be interesting — look into it' },
  { id: 'nearby',   label: 'If nearby', icon: '📍', hint: 'Visit only if we pass close' },
  { id: 'skip',     label: 'Skip',     icon: '🚫', hint: 'Not for this trip' },
];
const STATUS_LABEL = Object.fromEntries(STATUS.map((s) => [s.id, s]));

function limitForZoom(z) {
  if (z < 9) return 60;       // whole region: headline places only
  if (z < 12) return 150;
  return 300;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// bbox helpers for the refetch-guard: pad a [s,w,n,e] box, test containment.
function padBbox([s, w, n, e], f = 0.35) {
  const dLat = (n - s) * f, dLon = (e - w) * f;
  return [s - dLat, w - dLon, n + dLat, e + dLon];
}
function contains(outer, inner) {
  return outer && inner[0] >= outer[0] && inner[1] >= outer[1]
    && inner[2] <= outer[2] && inner[3] <= outer[3];
}

export default function TripPlanner({ onBack, onOpenPrefs }) {
  const [tripList, setTripList] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [trip, setTrip] = useState(null); // full active trip with items

  const [pois, setPois] = useState([]);
  const [browsing, setBrowsing] = useState(false);
  const [capped, setCapped] = useState(false);
  const bboxTimer = useRef(null);
  const lastReq = useRef(0);
  const lastFetch = useRef({ bbox: null, zoom: null }); // refetch-guard

  const [selected, setSelected] = useState(null); // raw browse poi
  const [enriched, setEnriched] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [filter, setFilter] = useState('all'); // status filter for the trip list
  // Category filter for the browse map (all on by default).
  const [activeCats, setActiveCats] = useState(() => new Set(ALL_CATEGORY_KEYS));

  // ── Trips ──────────────────────────────────────────────────────────────────
  const refreshList = useCallback(async () => {
    const { trips } = await api.list();
    setTripList(trips);
    return trips;
  }, []);

  useEffect(() => {
    refreshList().then((trips) => {
      if (trips.length) setActiveId(trips[0].id);
    }).catch((e) => console.error('[Planner] list failed', e));
  }, [refreshList]);

  useEffect(() => {
    if (!activeId) { setTrip(null); return; }
    api.get(activeId).then(({ trip }) => setTrip(trip)).catch(() => setTrip(null));
  }, [activeId]);

  const itemFor = useCallback(
    (poiId) => trip?.items.find((i) => i.poiId === poiId) || null,
    [trip],
  );
  const statusForId = useCallback((poiId) => itemFor(poiId)?.status || null, [itemFor]);

  async function createTrip() {
    const name = prompt('Trip name', 'New trip');
    if (name == null) return;
    const { trip } = await api.create(name);
    await refreshList();
    setActiveId(trip.id);
  }
  async function renameTrip() {
    if (!trip) return;
    const name = prompt('Rename trip', trip.name);
    if (name == null) return;
    const res = await api.rename(trip.id, name);
    setTrip(res.trip); refreshList();
  }
  async function deleteTrip() {
    if (!trip || !confirm(`Delete trip "${trip.name}"? This can't be undone.`)) return;
    await api.remove(trip.id);
    const trips = await refreshList();
    setActiveId(trips[0]?.id || null);
  }

  // ── Browse ───────────────────────────────────────────────────────────────────
  // Only refetch when the view leaves the already-loaded area (or zoom changes).
  // We fetch a padded bbox, so small pans stay within it and hit no network —
  // that, plus client-side category filtering, is what kills the pan lag.
  const onBounds = useCallback((bbox, zoom) => {
    const lf = lastFetch.current;
    if (zoom === lf.zoom && contains(lf.bbox, bbox)) return; // already have it
    clearTimeout(bboxTimer.current);
    bboxTimer.current = setTimeout(async () => {
      const reqId = ++lastReq.current;
      const padded = padBbox(bbox);
      setBrowsing(true);
      try {
        const { places, capped } = await browsePOIs(padded, limitForZoom(zoom));
        if (reqId !== lastReq.current) return; // a newer pan superseded this one
        setPois(places);
        setCapped(!!capped);
        lastFetch.current = { bbox: padded, zoom };
      } catch (e) {
        if (reqId === lastReq.current) { setPois([]); console.error('[Planner] browse failed', e); }
      } finally {
        if (reqId === lastReq.current) setBrowsing(false);
      }
    }, 400);
  }, []);

  // Select a POI → lazily enrich it (real tier / image / wiki).
  async function selectPoi(poi) {
    setSelected(poi);
    setEnriched(null);
    setEnriching(true);
    try {
      const full = await enrichPOI(poi);
      setEnriched(full);
    } catch (e) {
      console.error('[Planner] enrich failed', e);
    } finally {
      setEnriching(false);
    }
  }

  // ── Marking ──────────────────────────────────────────────────────────────────
  async function mark(poi, status) {
    if (!trip) { alert('Create or select a trip first.'); return; }
    // Prefer the enriched snapshot (tier/image/wiki) when we have it.
    const payload = enriched && enriched.id === poi.id ? enriched : poi;
    const res = await api.setItem(trip.id, payload, status);
    setTrip(res.trip); refreshList();
  }
  async function setNote(poiId, note) {
    const res = await api.updateItem(trip.id, poiId, { note });
    setTrip(res.trip);
  }
  async function unmark(poiId) {
    const res = await api.removeItem(trip.id, poiId);
    setTrip(res.trip); refreshList();
  }

  function exportTrip(kind) {
    if (!trip) return;
    if (kind === 'json') {
      download(`${trip.name}.json`, JSON.stringify(trip, null, 2), 'application/json');
    } else {
      const features = trip.items.map((i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [i.lon, i.lat] },
        properties: { name: i.name, status: i.status, tier: i.tier, note: i.note, osm: i.osm },
      }));
      download(`${trip.name}.geojson`, JSON.stringify({ type: 'FeatureCollection', features }, null, 2), 'application/geo+json');
    }
  }

  // Category counts over loaded POIs + the map's visible (filtered) subset.
  const catCounts = useMemo(() => {
    const c = {};
    for (const p of pois) c[p.category] = (c[p.category] || 0) + 1;
    return c;
  }, [pois]);
  const visiblePois = useMemo(
    () => pois.filter((p) => activeCats.has(p.category)),
    [pois, activeCats],
  );
  const toggleCat = (key) => setActiveCats((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const allOn = activeCats.size === ALL_CATEGORY_KEYS.length;

  const counts = STATUS.reduce((acc, s) => {
    acc[s.id] = trip?.items.filter((i) => i.status === s.id).length || 0;
    return acc;
  }, {});
  const visibleItems = (trip?.items || [])
    .filter((i) => filter === 'all' || i.status === filter)
    .sort((a, b) => STATUS.findIndex((s) => s.id === a.status) - STATUS.findIndex((s) => s.id === b.status));

  const detail = enriched || selected;

  return (
    <div className="planner-root">
      {/* Header */}
      <header className="planner-header">
        <button className="nav-btn" onClick={onBack} title="Back to the audioguide">← Journey</button>
        <h1>🗺 Trip Planner</h1>
        <div className="trip-switcher">
          <select value={activeId || ''} onChange={(e) => setActiveId(e.target.value)}>
            {tripList.length === 0 && <option value="">No trips yet</option>}
            {tripList.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.itemCount})</option>
            ))}
          </select>
          <button className="link-btn" onClick={createTrip}>+ New</button>
          {trip && <button className="link-btn" onClick={renameTrip}>Rename</button>}
          {trip && <button className="link-btn danger" onClick={deleteTrip}>Delete</button>}
        </div>
        {onOpenPrefs && (
          <button className="nav-btn" onClick={onOpenPrefs} title="Preferences">⚙</button>
        )}
      </header>

      <div className="planner-body">
        {/* Map */}
        <div className="planner-map-wrap">
          {/* Category filter chips */}
          <div className="cat-bar">
            <button className={`cat-chip all ${allOn ? '' : 'off'}`}
                    onClick={() => setActiveCats(new Set(allOn ? [] : ALL_CATEGORY_KEYS))}>
              {allOn ? 'None' : 'All'}
            </button>
            {CATEGORIES.map((c) => {
              const on = activeCats.has(c.key);
              const n = catCounts[c.key] || 0;
              return (
                <button key={c.key}
                        className={`cat-chip ${on ? '' : 'off'}`}
                        style={on ? { borderColor: c.color, boxShadow: `inset 0 -2px 0 ${c.color}` } : undefined}
                        title={c.label}
                        onClick={() => toggleCat(c.key)}>
                  <span className="cat-dot" style={{ background: c.color }} />
                  {c.icon} <span className="cat-count">{n}</span>
                </button>
              );
            })}
          </div>

          <BrowseMap
            pois={visiblePois}
            statusForId={statusForId}
            selectedId={selected?.id}
            onBoundsChange={onBounds}
            onPoiClick={selectPoi}
            initialCenter={SPAIN_CENTER}
            initialZoom={SPAIN_ZOOM}
            focusKey={trip?.id}
            focusPoints={trip?.items}
          />
          <div className="map-status">
            {browsing ? 'Loading…' : `${visiblePois.length}${visiblePois.length !== pois.length ? `/${pois.length}` : ''} places`}
            {capped && ' · zoom in for more'}
          </div>

          {/* Legend */}
          <div className="map-legend">
            <div className="legend-group">
              <span className="legend-title">Size = value</span>
              {['A', 'B', 'C', 'D'].map((t) => (
                <span key={t} className="legend-item">
                  <span className="legend-dot" style={{ width: TIER_SIZE[t], height: TIER_SIZE[t], background: '#cbd5e1' }} />{t}
                </span>
              ))}
            </div>
            <div className="legend-group">
              <span className="legend-title">Ring = mark</span>
              {STATUS.map((s) => (
                <span key={s.id} className="legend-item" title={s.hint}>
                  <span className="legend-dot ring" style={{ borderColor: STATUS_RING[s.id] }} />{s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: detail + trip contents */}
        <aside className="planner-aside">
          {/* Selected POI detail */}
          <section className="detail-panel">
            {!detail ? (
              <p className="muted">Click a place on the map to inspect and add it.</p>
            ) : (
              <>
                <div className="detail-head">
                  {detail.image && <img src={detail.image} alt={detail.name} className="detail-img" loading="lazy" />}
                  <div>
                    <h2>{detail.name}</h2>
                    <p className="detail-meta">
                      <span className={`tier tier-${detail.tier || '?'}`}>{detail.tier || '·'}</span>
                      {detail.category && CAT[detail.category] && (
                        <span className="detail-cat">{CAT[detail.category].icon} {CAT[detail.category].label}</span>
                      )}
                      {enriching && ' · enriching…'}
                      {detail.sitelinks ? ` · ${detail.sitelinks} wikis` : ''}
                    </p>
                  </div>
                </div>
                {detail.wiki?.extract && <p className="detail-wiki">{detail.wiki.extract}</p>}
                <p className="detail-links">
                  {detail.tags?.wikipedia && (
                    <a target="_blank" rel="noreferrer"
                       href={`https://en.wikipedia.org/wiki/${encodeURIComponent((detail.tags.wikipedia.split(':').pop()))}`}>Wikipedia ↗</a>
                  )}
                  <a target="_blank" rel="noreferrer"
                     href={`https://www.openstreetmap.org/${detail.id.replace('-', '/')}`}>OSM ↗</a>
                  <a target="_blank" rel="noreferrer"
                     href={`https://www.google.com/maps?q=${detail.lat},${detail.lon}`}>Map ↗</a>
                </p>

                <div className="mark-row">
                  {STATUS.map((s) => {
                    const active = statusForId(detail.id) === s.id;
                    return (
                      <button key={s.id} title={s.hint}
                              className={`mark-btn mark-${s.id} ${active ? 'active' : ''}`}
                              onClick={() => mark(detail, s.id)}>
                        {s.icon} {s.label}
                      </button>
                    );
                  })}
                  {statusForId(detail.id) && (
                    <button className="mark-btn ghost" onClick={() => unmark(detail.id)}>Remove</button>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Trip contents */}
          <section className="trip-panel">
            <div className="trip-panel-head">
              <strong>{trip ? trip.name : '—'}</strong>
              {trip && (
                <span className="export">
                  <button className="link-btn" onClick={() => exportTrip('json')}>JSON</button>
                  <button className="link-btn" onClick={() => exportTrip('geojson')}>GeoJSON</button>
                </span>
              )}
            </div>

            <div className="filter-row">
              <button className={filter === 'all' ? 'chip on' : 'chip'} onClick={() => setFilter('all')}>
                All {trip?.items.length || 0}
              </button>
              {STATUS.map((s) => (
                <button key={s.id} className={filter === s.id ? 'chip on' : 'chip'} onClick={() => setFilter(s.id)}>
                  {s.icon} {counts[s.id]}
                </button>
              ))}
            </div>

            <div className="trip-items">
              {!trip && <p className="muted">Create a trip to start adding places.</p>}
              {trip && visibleItems.length === 0 && <p className="muted">Nothing here yet.</p>}
              {visibleItems.map((i) => (
                <div key={i.poiId} className="trip-item">
                  <div className="trip-item-main" onClick={() => selectPoi({ id: i.poiId, name: i.name, lat: i.lat, lon: i.lon, tags: i.tags })}>
                    <span className={`tier tier-${i.tier || '?'}`}>{i.tier || '·'}</span>
                    <span className="trip-item-cat" title={CAT[i.category]?.label}>{CAT[i.category]?.icon || '📍'}</span>
                    <span className="trip-item-name">{i.name}</span>
                    <span className="trip-item-status" title={STATUS_LABEL[i.status]?.hint}>{STATUS_LABEL[i.status]?.icon}</span>
                  </div>
                  <div className="trip-item-controls">
                    <select value={i.status} onChange={(e) => api.updateItem(trip.id, i.poiId, { status: e.target.value }).then((r) => setTrip(r.trip)).then(refreshList)}>
                      {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <input className="note-input" placeholder="note…" defaultValue={i.note}
                           onBlur={(e) => e.target.value !== i.note && setNote(i.poiId, e.target.value)} />
                    <button className="link-btn danger" onClick={() => unmark(i.poiId)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Browse map for the trip planner. POIs render as canvas circleMarkers (one
// shared <canvas>, not a DOM node per point) so several thousand stay smooth.
// The colour encoding maps onto a circle's two native properties:
//   fill   = value tier (A–D)
//   stroke = your trip mark (must / research / nearby / skip), else a faint edge
// Marks/selection restyle existing markers in place — we never clear-and-rebuild.

export const TIER_COLOR = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#6b7280' };
export const STATUS_RING = { must: '#ef4444', research: '#f59e0b', nearby: '#3b82f6', skip: '#6b7280' };

export default function BrowseMap({ pois, statusForId, selectedId, onBoundsChange, onPoiClick, initialCenter, initialZoom, focusKey, focusPoints }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const rendererRef = useRef(null);
  const layerRef = useRef(null);
  const markers = useRef(new Map()); // poiId -> circleMarker (with ._poi)
  const lastFocus = useRef(null);
  // Latest callbacks/selection, read inside Leaflet handlers without re-binding.
  const cbRef = useRef({});
  cbRef.current = { onBoundsChange, onPoiClick, statusForId, selectedId };

  function styleFor(poi) {
    const { statusForId, selectedId } = cbRef.current;
    const status = statusForId?.(poi.id);
    const selected = poi.id === selectedId;
    return {
      renderer: rendererRef.current,
      radius: selected ? 9 : 6,
      fillColor: TIER_COLOR[poi.tier] || '#6b7280',
      fillOpacity: 1,
      color: status ? STATUS_RING[status] : (selected ? '#ffffff' : 'rgba(15,23,42,0.5)'),
      weight: status || selected ? 3 : 1,
    };
  }

  // Init once.
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false, preferCanvas: true })
      .setView(initialCenter || [54.687, 25.28], initialZoom ?? 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    rendererRef.current = L.canvas({ padding: 0.5 });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const emit = () => {
      const b = map.getBounds();
      cbRef.current.onBoundsChange?.([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()], map.getZoom());
    };
    map.on('moveend', emit);
    emit(); // initial load
    return () => { map.remove(); mapRef.current = null; markers.current.clear(); };
  }, []);

  // When the active trip changes (focusKey), fit the map to that trip's POIs so
  // all added places are on screen. Keyed on focusKey so it fires once per trip
  // switch — not on every add/remove (which would make the map jump around).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusKey || focusKey === lastFocus.current) return;
    lastFocus.current = focusKey;
    if (focusPoints && focusPoints.length) {
      const b = L.latLngBounds(focusPoints.map((p) => [p.lat, p.lon]));
      map.fitBounds(b, { padding: [50, 50], maxZoom: 13 });
    }
  }, [focusKey, focusPoints]);

  // Sync markers to `pois` by DIFF: add new, remove gone, leave the rest. No
  // teardown of the whole layer, so panning into new data is cheap.
  useEffect(() => {
    const lg = layerRef.current;
    if (!lg) return;
    const next = new Set(pois.map((p) => p.id));
    for (const [id, m] of markers.current) {
      if (!next.has(id)) { lg.removeLayer(m); markers.current.delete(id); }
    }
    for (const poi of pois) {
      if (markers.current.has(poi.id)) continue;
      const m = L.circleMarker([poi.lat, poi.lon], styleFor(poi));
      m._poi = poi;
      m.on('click', () => cbRef.current.onPoiClick?.(m._poi));
      m.addTo(lg);
      markers.current.set(poi.id, m);
    }
  }, [pois]);

  // Restyle in place when selection / marks change — O(n) style updates collapse
  // into a single canvas repaint; no markers are recreated.
  useEffect(() => {
    for (const m of markers.current.values()) m.setStyle(styleFor(m._poi));
    const sel = selectedId && markers.current.get(selectedId);
    if (sel) sel.bringToFront();
  }, [selectedId, statusForId, pois]);

  return <div ref={containerRef} className="browse-map" />;
}

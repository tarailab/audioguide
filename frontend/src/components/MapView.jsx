import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons broken by bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Arrow points up (north) at 0°, rotated to the travel heading.
function youIcon(course) {
  const rot = Number.isFinite(course) ? course : 0;
  return L.divIcon({
    className: '',
    html: `<div style="transform:rotate(${rot}deg);transition:transform 0.3s ease-out;">
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="14" fill="rgba(74,158,255,0.25)"/>
        <path d="M15 3 L23 25 L15 19 L7 25 Z" fill="#4a9eff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const POI_ICON = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#f97316;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(249,115,22,0.8)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const PLAYING_ICON = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(34,197,94,0.9)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MapView({ position, queue, current, course, headingUp = true, onPoiTap }) {
  const containerRef = useRef(null);
  const rotWrapRef = useRef(null);
  const mapRef = useRef(null);
  const youRef = useRef(null);
  const poiMarkersRef = useRef({});
  const followRef = useRef(true);

  // Init map once
  useEffect(() => {
    if (mapRef.current) return;
    const center = position ? [position.lat, position.lon] : [54.6872, 25.2797];
    mapRef.current = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(center, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);
    // Re-measure after layout settles (the oversized 200% container reports a
    // wrong size if measured synchronously → map renders half-width).
    const remeasure = () => mapRef.current?.invalidateSize();
    requestAnimationFrame(remeasure);
    setTimeout(remeasure, 200);
    setTimeout(remeasure, 600);
    const ro = new ResizeObserver(remeasure);
    ro.observe(containerRef.current);
    window.addEventListener('orientationchange', remeasure);

    // Stop auto-following once the user drags the map; resume by tapping
    // their own arrow (re-centres below).
    mapRef.current.on('dragstart', () => { followRef.current = false; });
  }, []);

  // Heading-up: rotate the whole map so travel direction points to the top of
  // the screen. The map container is oversized 200% (see render) so rotation
  // never exposes empty corners.
  useEffect(() => {
    if (!rotWrapRef.current) return;
    const rot = (headingUp && Number.isFinite(course)) ? -course : 0;
    rotWrapRef.current.style.transform = `rotate(${rot}deg)`;
  }, [course, headingUp]);

  // Update user position marker + follow it on every fix
  useEffect(() => {
    if (!mapRef.current || !position) return;
    const latlng = [position.lat, position.lon];
    if (!youRef.current) {
      youRef.current = L.marker(latlng, { icon: youIcon(course), zIndexOffset: 1000 })
        .addTo(mapRef.current)
        .on('click', () => { followRef.current = true; mapRef.current.panTo(latlng); });
    } else {
      youRef.current.setLatLng(latlng);
    }
    if (followRef.current) {
      mapRef.current.panTo(latlng, { animate: true, duration: 0.5 });
    }
  }, [position]);

  // Rotate the arrow to the current travel heading
  useEffect(() => {
    if (youRef.current) youRef.current.setIcon(youIcon(course));
  }, [course]);

  // Update POI markers
  useEffect(() => {
    if (!mapRef.current) return;
    const allPois = [...queue];
    if (current?.poi) allPois.push(current.poi);

    const seen = new Set();
    allPois.forEach(poi => {
      if (!poi.lat || !poi.lon) return;
      seen.add(poi.id);
      const isPlaying = current?.poi?.id === poi.id;
      const icon = isPlaying ? PLAYING_ICON : POI_ICON;

      if (poiMarkersRef.current[poi.id]) {
        poiMarkersRef.current[poi.id].setIcon(icon);
      } else {
        const marker = L.marker([poi.lat, poi.lon], { icon })
          .addTo(mapRef.current)
          .bindTooltip(poi.name, { permanent: false, direction: 'top' })
          .on('click', () => onPoiTap && onPoiTap(poi));
        poiMarkersRef.current[poi.id] = marker;
      }
    });

    // Remove stale markers
    Object.keys(poiMarkersRef.current).forEach(id => {
      if (!seen.has(id)) {
        poiMarkersRef.current[id].remove();
        delete poiMarkersRef.current[id];
      }
    });
  }, [queue, current]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        ref={rotWrapRef}
        style={{
          position: 'absolute', inset: 0,
          transformOrigin: 'center center',
          transition: 'transform 0.4s ease-out',
          willChange: 'transform',
        }}
      >
        {/* Oversized so map rotation never reveals empty corners */}
        <div
          ref={containerRef}
          style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%' }}
        />
      </div>
    </div>
  );
}

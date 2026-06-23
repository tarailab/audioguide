import { useState, useEffect, useRef } from 'react';

const CAR_THRESHOLD_MS = 5.5; // m/s ≈ 20 km/h

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compass bearing (0=N, 90=E) from point 1 to point 2.
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function useGPS() {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [mode, setMode] = useState('walk');
  const [course, setCourse] = useState(null); // travel direction, deg from N
  const [error, setError] = useState(null);
  const prev = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        const now = Date.now();

        let spd = pos.coords.speed ?? 0;
        if (!pos.coords.speed && prev.current) {
          const dt = (now - prev.current.time) / 1000;
          if (dt > 0 && dt < 10) {
            spd = haversineMeters(prev.current.lat, prev.current.lon, lat, lon) / dt;
          }
        }

        // Travel direction. Derive it from actual movement between the last
        // two fixes first — that's reliable while driving. Only fall back to
        // the device's reported GPS heading when we haven't moved enough, and
        // ignore a reported heading of exactly 0, which many Android devices
        // emit to mean "unknown" (that bug pinned the map to north).
        if (prev.current) {
          const movedM = haversineMeters(prev.current.lat, prev.current.lon, lat, lon);
          if (movedM > 5) {
            setCourse(bearingDeg(prev.current.lat, prev.current.lon, lat, lon));
          } else if (Number.isFinite(pos.coords.heading) && pos.coords.heading > 0) {
            setCourse(pos.coords.heading);
          }
        }

        prev.current = { lat, lon, time: now };
        setSpeed(spd);
        setMode(spd > CAR_THRESHOLD_MS ? 'car' : 'walk');
        setPosition({ lat, lon, accuracy });
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { position, speed, speedKmh: Math.round((speed || 0) * 3.6), mode, course, error };
}

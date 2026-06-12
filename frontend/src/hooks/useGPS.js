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

export function useGPS() {
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [mode, setMode] = useState('walk');
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

  return { position, speed, speedKmh: Math.round((speed || 0) * 3.6), mode, error };
}

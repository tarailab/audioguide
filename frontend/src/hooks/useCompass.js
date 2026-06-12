import { useState, useEffect } from 'react';

export function useCompass() {
  const [heading, setHeading] = useState(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);

  const requestAndStart = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') return;
      } catch {
        return;
      }
    }
    startListening();
  };

  const startListening = () => {
    const handler = (e) => {
      // webkitCompassHeading works on iOS; alpha works on Android (inverted)
      const h = e.webkitCompassHeading != null
        ? e.webkitCompassHeading
        : e.alpha != null
        ? (360 - e.alpha) % 360
        : null;
      if (h != null) setHeading(Math.round(h));
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  };

  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ — needs user gesture to request
      setPermissionNeeded(true);
    } else {
      const cleanup = startListening();
      return cleanup;
    }
  }, []);

  return { heading, permissionNeeded, requestPermission: requestAndStart };
}

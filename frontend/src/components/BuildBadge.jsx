import { useState, useEffect } from 'react';

// Captured once when this module is first evaluated by the browser — i.e. when
// the app code actually loaded. A full reload (or an HMR update of this file)
// re-evaluates it, so the clock + counter reset. That's the signal: if your
// phone fetched fresh code, this restarts from 0s.
const LOADED_AT = new Date();
const clock = LOADED_AT.toTimeString().slice(0, 8); // HH:MM:SS, phone-local

export default function BuildBadge() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setSecs(Math.floor((Date.now() - LOADED_AT.getTime()) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const ago = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;

  return (
    <div className="build-badge">
      <span>updated {clock}</span>
      <span className="build-ago">{ago} ago</span>
    </div>
  );
}

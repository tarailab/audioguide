import { useState, useEffect } from 'react';
import { APP_VERSION } from '../version';

const LOADED_AT = new Date();
const clock = LOADED_AT.toTimeString().slice(0, 8);

export default function BuildBadge() {
  const [secs, setSecs] = useState(0);
  const [serverVer, setServerVer] = useState(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSecs(Math.floor((Date.now() - LOADED_AT.getTime()) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Compare the bundled version against the freshly-fetched one. If the running
  // bundle is older, it's stale — reload once to pull the new code. If it's
  // STILL stale after that reload, the cache is genuinely stuck: stop looping
  // and show a loud warning instead of guessing.
  useEffect(() => {
    fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        setServerVer(j.version);
        if (j.version && j.version !== APP_VERSION) {
          const already = sessionStorage.getItem('ag-reloaded-for');
          if (already !== j.version) {
            sessionStorage.setItem('ag-reloaded-for', j.version);
            window.location.reload();
          } else {
            setStale(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  const ago = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;

  return (
    <div className={`build-badge ${stale ? 'build-stale' : ''}`}>
      <span className="build-ver">v{APP_VERSION}</span>
      <span className="build-ago">
        {stale ? `STALE — clear cache (server v${serverVer})` : `${clock} · ${ago} ago`}
      </span>
    </div>
  );
}

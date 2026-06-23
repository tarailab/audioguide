import { useState } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useCompass } from '../hooks/useCompass';
import { useStoryQueue } from '../hooks/useStoryQueue';
import { primeTTS } from '../services/tts';
import CompassRose from '../components/CompassRose';
import MapView from '../components/MapView';

export default function JourneyScreen({ prefs, onOpenPrefs }) {
  const { position, speedKmh, mode, course, error: gpsError } = useGPS();
  const { heading, permissionNeeded, requestPermission } = useCompass();

  const [autoMode, setAutoMode] = useState(() => {
    const saved = localStorage.getItem('audioguide-automode');
    return saved == null ? true : saved === 'true';
  });
  const toggleAuto = () => setAutoMode(v => {
    localStorage.setItem('audioguide-automode', String(!v));
    return !v;
  });

  const { queue, current, status, skip, togglePause, thumbsUp, thumbsDown, playNow } = useStoryQueue({
    position, heading, mode, speedKmh, course, prefs, autoMode,
  });

  const [expanded, setExpanded] = useState(false);

  return (
    // Unlock mobile speech synthesis on the first touch anywhere (Android/iOS
    // Chrome blocks audio that isn't started from a user gesture).
    <div className="journey-root" onPointerDown={primeTTS}>

      {/* Full-screen map background */}
      <div className="map-bg">
        <MapView
          position={position}
          queue={queue}
          current={current}
          course={course}
          onPoiTap={(poi) => playNow(poi)}
        />
      </div>

      {/* Top HUD */}
      <div className="hud-top">
        <div className="hud-pill">
          <span className={`mode-badge mode-${mode}`}>{mode.toUpperCase()}</span>
          <span className="speed-display">{speedKmh} <small>km/h</small></span>
        </div>
        <CompassRose heading={heading} />
        <div className="hud-pill">
          <button
            className={`icon-btn auto-btn ${autoMode ? 'auto-on' : 'auto-off'}`}
            onClick={toggleAuto}
            aria-label={autoMode ? 'Auto-play on' : 'Auto-play off'}
            title={autoMode ? 'Auto-play: ON — stories play as you go' : 'Auto-play: OFF — tap a place to play'}
          >
            {autoMode ? '🔁' : '✋'}
          </button>
          <button
            className="icon-btn"
            onClick={() => window.location.reload()}
            aria-label="Reload app"
            title="Reload app"
          >↻</button>
          <button className="icon-btn" onClick={onOpenPrefs} aria-label="Preferences">⚙</button>
        </div>
      </div>

      {/* iOS compass permission */}
      {permissionNeeded && heading == null && (
        <button className="banner-btn" onClick={requestPermission}>
          Enable compass →
        </button>
      )}

      {/* Bottom card */}
      <div className={`bottom-card ${expanded ? 'expanded' : ''}`}>

        {/* Story state */}
        {status === 'idle' && !current && (
          <div className="card-idle">
            <div className="card-row">
              <span className="card-label">
                {!position ? '📍 Waiting for GPS…'
                  : queue.length > 0 ? `📍 ${queue.length} place${queue.length > 1 ? 's' : ''} nearby`
                  : '📍 Ready'}
              </span>
              <button
                className="btn-play"
                onClick={() => { primeTTS(); playNow(); }}
                disabled={!position || status === 'fetching'}
              >
                {status === 'fetching' ? '…' : '▶ Play'}
              </button>
            </div>
            {!position && (
              <p className="card-hint">Allow location access to find stories nearby</p>
            )}
          </div>
        )}

        {status === 'fetching' && (
          <div className="card-row">
            <div className="spinner-sm" />
            <span className="card-label">Finding places nearby…</span>
          </div>
        )}

        {status === 'loading' && current && (
          <div className="card-row">
            <div className="spinner-sm" />
            <span className="card-label">Crafting story for <strong>{current.poi?.name}</strong>…</span>
          </div>
        )}

        {(status === 'playing' || status === 'paused' || status === 'loading') && current && (
          <div className="card-playing">
            <div className="card-row">
              <div>
                <p className="poi-name-lg">{current.poi?.name}</p>
                <p className="poi-meta">{current.poi?.distance}m · {current.poi?.bearing}</p>
              </div>
              <div className="play-controls">
                <button className="ctrl-btn" onClick={thumbsDown} aria-label="Not interested">👎</button>
                <button className="ctrl-btn pause-btn" onClick={togglePause} aria-label="Pause/Resume">
                  {status === 'paused' ? '▶' : '⏸'}
                </button>
                <button className="ctrl-btn skip-btn" onClick={skip} aria-label="Skip">⏭</button>
                <button className="ctrl-btn" onClick={thumbsUp} aria-label="Love it">👍</button>
              </div>
            </div>
            {current.text && (
              <p className="story-snippet"
                 onClick={() => setExpanded(v => !v)}>
                {expanded ? current.text : current.text.slice(0, 120) + '… ▼'}
              </p>
            )}
          </div>
        )}

        {/* Queue strip */}
        {queue.length > 0 && status !== 'playing' && status !== 'loading' && (
          <div className="queue-strip">
            {queue.slice(0, 4).map(p => (
              <button key={p.id} className="queue-chip" onClick={() => playNow(p)}>
                <span className="queue-name">{p.name}</span>
                <span className="queue-dist">{p.distance < 1000 ? `${p.distance}m` : `${(p.distance / 1000).toFixed(1)}km`}</span>
              </button>
            ))}
          </div>
        )}

      </div>

      {gpsError && <div className="error-banner">GPS: {gpsError}</div>}
    </div>
  );
}

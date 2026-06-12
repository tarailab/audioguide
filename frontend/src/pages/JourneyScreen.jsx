import { useState } from 'react';
import { useGPS } from '../hooks/useGPS';
import { useCompass } from '../hooks/useCompass';
import { useStoryQueue } from '../hooks/useStoryQueue';
import CompassRose from '../components/CompassRose';

export default function JourneyScreen({ prefs, onOpenPrefs }) {
  const { position, speedKmh, mode, error: gpsError } = useGPS();
  const { heading, permissionNeeded, requestPermission } = useCompass();
  const { queue, current, status, skip, thumbsUp, thumbsDown } = useStoryQueue({
    position, heading, mode, prefs,
  });

  const [showControls, setShowControls] = useState(false);

  return (
    <div className="screen journey-screen">

      {/* Top status bar */}
      <div className="status-bar">
        <span className={`mode-badge mode-${mode}`}>{mode.toUpperCase()}</span>
        <span className="speed-display">{speedKmh} <small>km/h</small></span>
        <CompassRose heading={heading} />
        <button className="icon-btn" onClick={onOpenPrefs} aria-label="Preferences">⚙</button>
      </div>

      {/* iOS compass permission */}
      {permissionNeeded && heading == null && (
        <button className="banner-btn" onClick={requestPermission}>
          Enable compass →
        </button>
      )}

      {/* Main story area */}
      <div className="story-area">
        {status === 'idle' && !current && (
          <div className="state-card idle">
            <div className="state-icon">🎧</div>
            <p className="state-title">Listening…</p>
            <p className="state-sub">
              {!position
                ? 'Waiting for GPS…'
                : queue.length > 0
                ? `${queue.length} place${queue.length > 1 ? 's' : ''} ahead`
                : 'Looking for stories nearby'}
            </p>
          </div>
        )}

        {status === 'fetching' && (
          <div className="state-card loading">
            <div className="spinner" />
            <p className="state-sub">Finding nearby places…</p>
          </div>
        )}

        {status === 'loading' && current && (
          <div className="state-card loading">
            <div className="spinner" />
            <p className="state-title">Crafting story…</p>
            <p className="state-sub poi-name">{current.poi?.name}</p>
          </div>
        )}

        {status === 'playing' && current && (
          <div className="state-card playing">
            <div className="playing-dot" />
            <p className="state-label">NOW PLAYING</p>
            <p className="poi-name-large">{current.poi?.name}</p>
            <p className="poi-distance">{current.poi?.distance}m · {current.poi?.bearing}</p>
            <p className="story-preview">{current.text?.slice(0, 140)}…</p>
          </div>
        )}
      </div>

      {/* Queue preview strip */}
      {queue.length > 0 && status !== 'playing' && (
        <div className="queue-strip">
          {queue.slice(0, 3).map(p => (
            <div key={p.id} className="queue-item">
              <span className="queue-name">{p.name}</span>
              <span className="queue-dist">{p.distance < 1000 ? `${p.distance}m` : `${(p.distance/1000).toFixed(1)}km`}</span>
            </div>
          ))}
        </div>
      )}

      {/* HiViz controls */}
      <div className="controls-row">
        <button className="ctrl-btn thumb-btn" onClick={thumbsDown} aria-label="Not interested">
          👎
        </button>
        <button
          className={`ctrl-btn skip-btn ${status === 'playing' ? '' : 'dim'}`}
          onClick={skip}
          aria-label="Skip"
        >
          ⏭
        </button>
        <button className="ctrl-btn thumb-btn" onClick={thumbsUp} aria-label="Love it">
          👍
        </button>
      </div>

      {/* Density/length overlay */}
      <div className="overlay-row">
        <button className="overlay-toggle" onClick={() => setShowControls(v => !v)}>
          {showControls ? 'Hide controls ▲' : 'Length & density ▼'}
        </button>
        {showControls && <ControlsOverlay prefs={prefs} onOpenPrefs={onOpenPrefs} />}
      </div>

      {gpsError && <div className="error-banner">GPS: {gpsError}</div>}
    </div>
  );
}

function ControlsOverlay({ onOpenPrefs }) {
  return (
    <div className="controls-overlay">
      <p className="overlay-hint">Tap ⚙ to change length, density & interests</p>
      <button className="btn-primary" onClick={onOpenPrefs}>Open preferences →</button>
    </div>
  );
}

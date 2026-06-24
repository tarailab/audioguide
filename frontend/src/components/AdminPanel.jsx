import { SEARCH_FIELDS, SEARCH_DEFAULTS } from '../store/searchParams';
import { computeReaches } from '../utils/searchArea';

// Admin / testing overlay for tuning the search area live. Gated by ?admin=1.
// Clear this whole component out before any public release.
export default function AdminPanel({ params, onChange, onReset, onClose, speedKmh, queue, area }) {
  const R = computeReaches(speedKmh, params);
  const inArea = queue.filter(p => p.inArea).length;

  const set = (k, v) => onChange({ ...params, [k]: Number(v) });

  return (
    <div className="admin-panel">
      <div className="admin-head">
        <strong>🛠 Search tuning</strong>
        <button className="admin-x" onClick={onClose}>✕</button>
      </div>

      <div className="admin-readout">
        <span>{speedKmh} km/h</span>
        <span>fwd {(R.fwd / 1000).toFixed(1)}k</span>
        <span>side {(R.side / 1000).toFixed(1)}k</span>
        <span>back {Math.round(R.back)}m</span>
        <span>{inArea}/{queue.length} in area</span>
      </div>

      {SEARCH_FIELDS.map(([key, min, max, step, label, unit]) => (
        <label key={key} className="admin-row">
          <span className="admin-lbl">{label}</span>
          <input
            type="range" min={min} max={max} step={step}
            value={params[key]} onChange={(e) => set(key, e.target.value)}
          />
          <span className="admin-val">{params[key]}{unit}</span>
        </label>
      ))}

      <button className="admin-reset" onClick={onReset}>Reset defaults</button>
    </div>
  );
}

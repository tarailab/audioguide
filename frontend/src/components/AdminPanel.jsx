import { SEARCH_FIELDS, SEARCH_DEFAULTS } from '../store/searchParams';
import { computeReaches } from '../utils/searchArea';

// Format a param value for display: metres → km when large, counts as-is.
function fmtVal(unit, v) {
  if (unit !== 'm') return String(v);
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)} km` : `${v} m`;
}

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
        <div key={key} className="admin-row">
          <div className="admin-row-top">
            <span className="admin-lbl">{label}</span>
            <span className="admin-val">{fmtVal(unit, params[key])}</span>
          </div>
          <input
            type="range" min={min} max={max} step={step}
            value={params[key]} onChange={(e) => set(key, e.target.value)}
          />
        </div>
      ))}

      <button className="admin-reset" onClick={onReset}>Reset defaults</button>
    </div>
  );
}

// Mirror of the backend's reaches()/ellipse so the admin overlay can draw the
// exact search area and update instantly as sliders or speed change.

export function computeReaches(speedKmh, p) {
  const v = speedKmh || 0;
  return {
    fwd: Math.min(p.capNormal, Math.max(p.r0, p.r0 + p.kFwd * v)),
    side: Math.min(6000, Math.max(p.r0, p.r0 + p.kSide * v)),
    back: Math.max(800, Math.min(p.r0, p.r0 - p.kBack * v)),
  };
}

// Offset ellipse as an array of [lat, lon] points, oriented along `course`
// (deg from north). At rest fwd≈side≈back so it's a circle centred on the user.
export function ellipseLatLngs(lat, lon, course, R, steps = 64) {
  const c = ((Number.isFinite(course) ? course : 0) * Math.PI) / 180;
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const off = (R.fwd - R.back) / 2;
  const a = (R.fwd + R.back) / 2;
  const b = R.side;
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);

  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const f = off + a * Math.cos(t); // forward component (m)
    const s = b * Math.sin(t);       // sideways component (m, +right)
    const east = f * sinC + s * cosC;
    const north = f * cosC - s * sinC;
    pts.push([lat + north / mPerLat, lon + east / mPerLon]);
  }
  return pts;
}

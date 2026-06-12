export default function CompassRose({ heading }) {
  if (heading == null) return <span className="compass-na">— °</span>;

  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir = dirs[Math.round(heading / 45) % 8];

  return (
    <div className="compass-rose" title={`Heading: ${heading}°`}>
      <span
        className="compass-needle"
        style={{ transform: `rotate(${heading}deg)` }}
      >↑</span>
      <span className="compass-label">{heading}° {dir}</span>
    </div>
  );
}

function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x =
    Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function bearingToWords(poiBearing, deviceHeading) {
  if (deviceHeading == null) return 'ahead';
  const rel = ((poiBearing - deviceHeading) + 360) % 360;
  if (rel < 30 || rel > 330) return 'straight ahead';
  if (rel < 90) return 'on your right';
  if (rel < 150) return 'to your right';
  if (rel < 210) return 'behind you';
  if (rel < 270) return 'to your left';
  return 'on your left';
}

module.exports = { calcDistance, calcBearing, bearingToWords };

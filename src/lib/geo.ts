/** ระยะทางระหว่าง 2 พิกัด (เมตร) — Haversine */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GeoBranch = { id: number; name: string; latitude: number | null; longitude: number | null; radiusM: number };

export function nearestBranch(lat: number, lon: number, branches: GeoBranch[]) {
  let best: { branch: GeoBranch; distance: number } | null = null;
  for (const b of branches) {
    if (b.latitude == null || b.longitude == null) continue;
    const d = distanceM(lat, lon, b.latitude, b.longitude);
    if (!best || d < best.distance) best = { branch: b, distance: d };
  }
  return best;
}

/**
 * 약 5km 격자(D21). 서버에는 좌표 대신 격자 번호만 보낸다.
 * DB의 생성 열(grid_y = floor(lat / 0.045), grid_x = floor(lon / 0.056))과 같은 값이어야 한다.
 */
export const GRID_LAT = 0.045;
export const GRID_LON = 0.056;

export interface LatLon {
  lat: number;
  lon: number;
}

export interface GridCell {
  gy: number;
  gx: number;
}

// 한국 좌표 범위(DB의 geom 생성 조건과 같다: 위도 33~39, 경도 124~132)
const GY_MIN = Math.floor(33 / GRID_LAT);
const GY_MAX = Math.floor(39 / GRID_LAT);
const GX_MIN = Math.floor(124 / GRID_LON);
const GX_MAX = Math.floor(132 / GRID_LON);

const EARTH_R = 6_371_000;
const M_PER_DEG_LAT = 111_320;
const rad = (d: number) => (d * Math.PI) / 180;

export function gridOf(lat: number, lon: number): GridCell {
  return { gy: Math.floor(lat / GRID_LAT), gx: Math.floor(lon / GRID_LON) };
}

export function gridKey(c: GridCell): string {
  return `${c.gy}_${c.gx}`;
}

/** "gy_gx" → 칸. 형식이 틀리거나 한국 범위 밖이면 null. */
export function parseGridKey(key: string): GridCell | null {
  const m = /^(\d{3})_(\d{4})$/.exec(key);
  if (!m) return null;
  const gy = Number(m[1]);
  const gx = Number(m[2]);
  if (gy < GY_MIN || gy > GY_MAX || gx < GX_MIN || gx > GX_MAX) return null;
  return { gy, gx };
}

/** 칸의 중심점 */
export function gridCenter(c: GridCell): LatLon {
  return { lat: (c.gy + 0.5) * GRID_LAT, lon: (c.gx + 0.5) * GRID_LON };
}

/** 두 점 사이 거리(m, 하버사인) */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** 중심에서 칸(사각형)의 가장 가까운 점까지 거리(m, 평면 근사) */
function distanceToCellM(center: LatLon, c: GridCell): number {
  const lat = Math.min(Math.max(center.lat, c.gy * GRID_LAT), (c.gy + 1) * GRID_LAT);
  const lon = Math.min(Math.max(center.lon, c.gx * GRID_LON), (c.gx + 1) * GRID_LON);
  const dy = (lat - center.lat) * M_PER_DEG_LAT;
  const dx = (lon - center.lon) * M_PER_DEG_LAT * Math.cos(rad(center.lat));
  return Math.hypot(dx, dy);
}

/** 중심에서 radiusKm 안에 조금이라도 걸치는 칸. 가까운 칸부터(중심 칸이 맨 앞). */
export function cellsWithin(center: LatLon, radiusKm: number): GridCell[] {
  const home = gridOf(center.lat, center.lon);
  const radiusM = radiusKm * 1000;
  const cellLonM = GRID_LON * M_PER_DEG_LAT * Math.cos(rad(center.lat));
  const ry = Math.ceil(radiusM / (GRID_LAT * M_PER_DEG_LAT)) + 1;
  const rx = Math.ceil(radiusM / cellLonM) + 1;
  const out: { c: GridCell; d: number }[] = [];
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const c = { gy: home.gy + dy, gx: home.gx + dx };
      const d = distanceToCellM(center, c);
      if (d <= radiusM) out.push({ c, d });
    }
  }
  return out.sort((a, b) => a.d - b.d).map((x) => x.c);
}

/**
 * 격자(D21). 서버에는 좌표 대신 격자 번호만 보낸다.
 * - coarse: 약 5km(위도 0.045° × 경도 0.056°). 반경 3·10·25km 목록과 상호 검색 정렬에 쓴다.
 * - fine: 약 1km(위도 0.009° × 경도 0.0112°). 첫 화면을 빨리 띄우려고 반경 1km를 먼저 받을 때 쓴다.
 * DB의 생성 열(grid_y/grid_x, fgrid_y/fgrid_x = floor(좌표 / 크기))과 같은 값이어야 한다.
 */
export type GridLevel = 'coarse' | 'fine';

export const GRID_LAT = 0.045;
export const GRID_LON = 0.056;
export const FINE_GRID_LAT = 0.009;
export const FINE_GRID_LON = 0.0112;

const SIZE: Record<GridLevel, { lat: number; lon: number }> = {
  coarse: { lat: GRID_LAT, lon: GRID_LON },
  fine: { lat: FINE_GRID_LAT, lon: FINE_GRID_LON },
};

export interface LatLon {
  lat: number;
  lon: number;
}

export interface GridCell {
  gy: number;
  gx: number;
}

// 한국 좌표 범위(DB의 geom 생성 조건과 같다: 위도 33~39, 경도 124~132)
const bounds = (level: GridLevel) => ({
  gyMin: Math.floor(33 / SIZE[level].lat),
  gyMax: Math.floor(39 / SIZE[level].lat),
  gxMin: Math.floor(124 / SIZE[level].lon),
  gxMax: Math.floor(132 / SIZE[level].lon),
});
const BOUNDS = { coarse: bounds('coarse'), fine: bounds('fine') };

const EARTH_R = 6_371_000;
const M_PER_DEG_LAT = 111_320;
const rad = (d: number) => (d * Math.PI) / 180;

export function gridOf(lat: number, lon: number, level: GridLevel = 'coarse'): GridCell {
  return { gy: Math.floor(lat / SIZE[level].lat), gx: Math.floor(lon / SIZE[level].lon) };
}

/** coarse "834_2267", fine "f4173_11337" */
export function gridKey(c: GridCell, level: GridLevel = 'coarse'): string {
  return `${level === 'fine' ? 'f' : ''}${c.gy}_${c.gx}`;
}

/** 격자 번호 → 칸. 형식이 틀리거나 한국 범위 밖이면 null. */
export function parseGridKey(key: string): (GridCell & { level: GridLevel }) | null {
  const m = /^(f?)(\d{3,4})_(\d{4,5})$/.exec(key);
  if (!m) return null;
  const level: GridLevel = m[1] ? 'fine' : 'coarse';
  const gy = Number(m[2]);
  const gx = Number(m[3]);
  const b = BOUNDS[level];
  if (gy < b.gyMin || gy > b.gyMax || gx < b.gxMin || gx > b.gxMax) return null;
  return { level, gy, gx };
}

/** 칸의 중심점 */
export function gridCenter(c: GridCell, level: GridLevel = 'coarse'): LatLon {
  return { lat: (c.gy + 0.5) * SIZE[level].lat, lon: (c.gx + 0.5) * SIZE[level].lon };
}

/** 두 점 사이 거리(m, 하버사인) */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** 중심에서 칸(사각형)의 가장 가까운 점까지 거리(m, 평면 근사) */
function distanceToCellM(center: LatLon, c: GridCell, level: GridLevel): number {
  const { lat: sLat, lon: sLon } = SIZE[level];
  const lat = Math.min(Math.max(center.lat, c.gy * sLat), (c.gy + 1) * sLat);
  const lon = Math.min(Math.max(center.lon, c.gx * sLon), (c.gx + 1) * sLon);
  const dy = (lat - center.lat) * M_PER_DEG_LAT;
  const dx = (lon - center.lon) * M_PER_DEG_LAT * Math.cos(rad(center.lat));
  return Math.hypot(dx, dy);
}

/** 중심에서 radiusKm 안에 조금이라도 걸치는 칸. 가까운 칸부터(중심 칸이 맨 앞). */
export function cellsWithin(center: LatLon, radiusKm: number, level: GridLevel = 'coarse'): GridCell[] {
  const { lat: sLat, lon: sLon } = SIZE[level];
  const home = gridOf(center.lat, center.lon, level);
  const radiusM = radiusKm * 1000;
  const ry = Math.ceil(radiusM / (sLat * M_PER_DEG_LAT)) + 1;
  const rx = Math.ceil(radiusM / (sLon * M_PER_DEG_LAT * Math.cos(rad(center.lat)))) + 1;
  const out: { c: GridCell; d: number }[] = [];
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const c = { gy: home.gy + dy, gx: home.gx + dx };
      const d = distanceToCellM(center, c, level);
      if (d <= radiusM) out.push({ c, d });
    }
  }
  return out.sort((a, b) => a.d - b.d).map((x) => x.c);
}

import type { LatLon } from '@munyeon/core';

/**
 * 지역 화면의 거리 기준점: 그 시군구 기관 좌표의 가운데값(D56). 외부 자료 없이 정한다(D28).
 * 평균이 아니라 가운데값이라 멀리 떨어진 섬·외곽 몇 곳에 끌려가지 않는다.
 */
export function regionCenter(points: { lat: number | null; lon: number | null }[]): LatLon | null {
  const lats: number[] = [];
  const lons: number[] = [];
  for (const p of points) {
    if (p.lat === null || p.lon === null) continue;
    lats.push(p.lat);
    lons.push(p.lon);
  }
  if (lats.length === 0) return null;
  const mid = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  return { lat: mid(lats), lon: mid(lons) };
}

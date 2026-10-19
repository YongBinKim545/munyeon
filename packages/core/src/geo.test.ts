import { describe, expect, test } from 'vitest';
import { cellsWithin, distanceM, GRID_LAT, GRID_LON, gridKey, gridOf, parseGridKey } from './geo.ts';

const MYEONGDONG = { lat: 37.5637, lon: 126.9838 };

describe('grid', () => {
  test('gridOf floors by cell size', () => {
    expect(gridOf(MYEONGDONG.lat, MYEONGDONG.lon)).toEqual({ gy: Math.floor(37.5637 / GRID_LAT), gx: Math.floor(126.9838 / GRID_LON) });
    expect(gridOf(MYEONGDONG.lat, MYEONGDONG.lon)).toEqual({ gy: 834, gx: 2267 });
  });

  test('gridKey round-trip', () => {
    expect(gridKey({ gy: 834, gx: 2267 })).toBe('834_2267');
    expect(parseGridKey('834_2267')).toEqual({ gy: 834, gx: 2267 });
  });

  test('parseGridKey rejects bad input and cells outside Korea', () => {
    for (const bad of ['', '834', '834_', 'a_b', '834_2267_1', '834.5_2267', '-1_2267', '1_1', '834_ 2267']) {
      expect(parseGridKey(bad)).toBeNull();
    }
  });

  test('cellsWithin covers every point within radius', () => {
    for (const km of [3, 10, 25]) {
      const keys = new Set(cellsWithin(MYEONGDONG, km).map(gridKey));
      // 반경 위 점들이 모두 받은 칸 안에 있다
      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const dLat = ((km * 1000 * 0.999) / 111_320) * Math.cos(rad);
        const dLon = ((km * 1000 * 0.999) / (111_320 * Math.cos((MYEONGDONG.lat * Math.PI) / 180))) * Math.sin(rad);
        const p = gridOf(MYEONGDONG.lat + dLat, MYEONGDONG.lon + dLon);
        expect(keys.has(gridKey(p))).toBe(true);
      }
    }
  });

  test('cellsWithin stays small', () => {
    expect(cellsWithin(MYEONGDONG, 3).length).toBeLessThanOrEqual(9);
    expect(cellsWithin(MYEONGDONG, 10).length).toBeLessThanOrEqual(25);
    expect(cellsWithin(MYEONGDONG, 25).length).toBeLessThanOrEqual(121);
  });

  test('center cell comes first', () =>
    expect(cellsWithin(MYEONGDONG, 3)[0]).toEqual(gridOf(MYEONGDONG.lat, MYEONGDONG.lon)));
});

describe('distanceM', () => {
  test('seoul city hall to myeongdong about 600m', () => {
    const d = distanceM({ lat: 37.5663, lon: 126.9779 }, MYEONGDONG);
    expect(d).toBeGreaterThan(550);
    expect(d).toBeLessThan(650);
  });
  test('zero', () => expect(distanceM(MYEONGDONG, MYEONGDONG)).toBe(0));
});

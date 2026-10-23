import { describe, expect, test, vi } from 'vitest';
import { makeRecord } from './fixtures';
import { decodeGrid, encodeGrid, type GridPayload } from './grid';
import {
  areaLabel, cellUrls, formatArea, kindOf, loadCells, loadNearby, matcherOf, type CellCache, type ListFilter, type NearbyStep,
} from './nearby';

const center = { lat: 37.5637, lon: 126.9838 }; // 명동
const at = new Date('2026-10-19T10:00:00+09:00'); // 월요일
const ctx = { holidays: new Set<string>() };
const open = { dutyTime1s: '0900', dutyTime1c: '1800' };
const closed = { dutyTime1s: '1900', dutyTime1c: '2300' };

/** 칸 번호와 관계없이 같은 기관 목록을 돌려주는 가짜 서버 */
function server(rows: ReturnType<typeof makeRecord>[]) {
  const urls: string[] = [];
  const fetchJson = vi.fn(async (url: string): Promise<GridPayload> => {
    urls.push(url);
    return encodeGrid(rows);
  });
  return { urls, fetchJson };
}

describe('list filter (D41)', () => {
  const entry = (kind: 'pharmacy' | 'hospital', pediatric: boolean) => decodeGrid(encodeGrid([makeRecord({ kind, category: kind === 'pharmacy' ? 'pharmacy' : 'general', pediatricName: pediatric })]), kind)[0]!;

  test('pediatric and hospital read hospital cells', () => {
    expect(kindOf('pharmacy')).toBe('pharmacy');
    expect(kindOf('hospital')).toBe('hospital');
    expect(kindOf('pediatric')).toBe('hospital');
  });

  test('hospital includes pediatric; pediatric keeps only pediatric names', () => {
    expect(matcherOf('hospital')).toBeUndefined();
    expect(matcherOf('pharmacy')).toBeUndefined();
    const ped = matcherOf('pediatric')!;
    expect(ped(entry('hospital', true))).toBe(true);
    expect(ped(entry('hospital', false))).toBe(false);
  });
});

describe('cellUrls', () => {
  test('requests carry grid ids only', () => {
    const urls = [...cellUrls('pharmacy', center, 1, 'fine'), ...cellUrls('pharmacy', center, 25, 'coarse')];
    for (const u of urls) {
      expect(u).toMatch(/^\/api\/grid\/pharmacy\/f?\d+_\d+$/);
      expect(u).not.toMatch(/\d+\.\d+/);
    }
  });
});

describe('loadCells', () => {
  test('dedupes ids and does not fetch the same cell twice', async () => {
    const { fetchJson } = server([makeRecord({ id: 'A' })]);
    const cache: CellCache = new Map();
    const urls = ['/api/grid/pharmacy/834_2267', '/api/grid/pharmacy/834_2268'];
    expect((await loadCells('pharmacy', urls, cache, fetchJson)).entries.map((e) => e.id)).toEqual(['A']);
    await loadCells('pharmacy', urls, cache, fetchJson);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  test('a failed cell is counted and retried next time', async () => {
    const fetchJson = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue(encodeGrid([makeRecord({ id: 'B' })]));
    const cache: CellCache = new Map();
    expect(await loadCells('pharmacy', ['/x'], cache, fetchJson)).toEqual({ entries: [], failed: 1 });
    expect(await loadCells('pharmacy', ['/x'], cache, fetchJson)).toMatchObject({ failed: 0, entries: [{ id: 'B' }] });
  });
});

describe('loadNearby', () => {
  test('fine 1km first, then 3km, stops when enough open places', async () => {
    const near = [1, 2, 3, 4, 5, 6].map((i) => makeRecord({ id: `O${i}`, hours: open, lat: center.lat + i * 0.001, lon: center.lon }));
    const { urls, fetchJson } = server(near);
    const steps: NearbyStep[] = [];
    await loadNearby({ kind: 'pharmacy', center, at: () => at, ctx, cache: new Map(), fetchJson, onStep: (s) => steps.push(s) });
    expect(steps.map((s) => [s.radiusKm, s.done])).toEqual([[1, false], [3, true]]);
    expect(urls.some((u) => u.includes('/f'))).toBe(true);
  });

  test('widens to 10km and 25km when fewer than 5 visible', async () => {
    const { fetchJson } = server([
      makeRecord({ id: 'C1', hours: closed, lat: center.lat, lon: center.lon }),
      makeRecord({ id: 'O1', hours: open, lat: center.lat, lon: center.lon }),
    ]);
    const steps: NearbyStep[] = [];
    await loadNearby({ kind: 'pharmacy', center, at: () => at, ctx, cache: new Map(), fetchJson, onStep: (s) => steps.push(s) });
    expect(steps.map((s) => [s.radiusKm, s.done])).toEqual([[1, false], [3, false], [10, false], [25, true]]);
  });

  test('stops widening when a 3km cell fails and reports it', async () => {
    const fetchJson = vi.fn(async (url: string): Promise<GridPayload> => {
      if (url.endsWith('834_2267')) throw new Error('503');
      return encodeGrid([]);
    });
    const steps: NearbyStep[] = [];
    await loadNearby({ kind: 'pharmacy', center, at: () => at, ctx, cache: new Map(), fetchJson, onStep: (s) => steps.push(s) });
    expect(steps.map((s) => [s.radiusKm, s.done, s.failed])).toEqual([[1, false, 0], [3, true, 1]]);
  });

  test('pediatric widening counts pediatric places only', async () => {
    const hosp = (id: string, pediatricName: boolean) =>
      makeRecord({ id, kind: 'hospital', category: 'general', pediatricName, hours: open, lat: center.lat, lon: center.lon });
    const rows = [hosp('P1', true), ...[1, 2, 3, 4, 5, 6].map((i) => hosp(`H${i}`, false))];
    const run = async (filter: ListFilter) => {
      const steps: NearbyStep[] = [];
      await loadNearby({
        kind: kindOf(filter), match: matcherOf(filter), center, at: () => at, ctx, cache: new Map(), fetchJson: server(rows).fetchJson,
        onStep: (s) => steps.push(s),
      });
      return steps.map((s) => s.radiusKm);
    };
    expect(await run('hospital')).toEqual([1, 3]);
    expect(await run('pediatric')).toEqual([1, 3, 10, 25]);
  });

  test('stops when no longer current', async () => {
    const { fetchJson } = server([]);
    const onStep = vi.fn();
    await loadNearby({ kind: 'pharmacy', center, at: () => at, ctx, cache: new Map(), fetchJson, isCurrent: () => false, onStep });
    expect(onStep).not.toHaveBeenCalled();
  });
});

describe('area names', () => {
  test('formatArea', () => {
    expect(formatArea('서울특별시', '마포구', '망원동')).toBe('마포구 망원동');
    expect(formatArea('서울특별시', '중구', '명동1가')).toBe('중구 명동1가');
    expect(formatArea('부산광역시', '중구', '중앙동')).toBe('부산 중구 중앙동');
    expect(formatArea('부산광역시', '중구', null)).toBe('부산 중구');
    expect(formatArea('전남광주통합특별시', '동구', '충장동')).toBe('광주 동구 충장동');
    expect(formatArea('경기도', '수원시 영통구', '영통동')).toBe('수원시 영통구 영통동');
  });

  test('areaLabel uses the nearest institution', () => {
    const entries = decodeGrid(encodeGrid([
      makeRecord({ id: 'F', sigungu: '종로구', dong: '관철동', lat: 37.569, lon: 126.987 }),
      makeRecord({ id: 'N', sigungu: '중구', dong: '명동2가', lat: 37.5638, lon: 126.9839 }),
    ]), 'pharmacy');
    expect(areaLabel(center, entries)).toBe('중구 명동2가');
    expect(areaLabel(center, [])).toBeNull();
  });
});

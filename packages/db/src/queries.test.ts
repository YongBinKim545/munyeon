import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { Sql } from './client.ts';
import {
  countSitemapEntries, deactivateMissing, finishRun, getHolidays, getInstitution, getLastSyncAt, getNearby,
  getRegionStats, insertEvent, listChangedIndexable, listChangedRegions, insertFeedback, listGridCell, listLandingCounts, listNeighborhoods, listRegion, listRegions, listSido, listSitemapEntries,
  listEmergency, refreshDuplicates, refreshNeighborhoods, searchInstitutions, startRun, upsertHolidays, upsertInstitutions, type InstitutionRow,
} from './queries.ts';
import { MIGRATIONS_DIR } from './migrate.ts';
import { startTestDb } from './test-db.ts';
import { FINE_GRID_LAT, FINE_GRID_LON, GRID_LAT, GRID_LON, gridOf } from '@munyeon/core';

let sql: Sql;
let stop: () => Promise<void>;

beforeAll(async () => {
  ({ sql, stop } = await startTestDb());
}, 60_000);
afterAll(async () => stop?.());
beforeEach(async () => {
  await sql`truncate institutions, events, sync_runs, feedback`;
});

const row = (over: Partial<InstitutionRow> = {}): InstitutionRow => ({
  id: 'C1100001', kind: 'pharmacy', name: '시청약국', divName: null, addr: '서울특별시 중구 세종대로 110',
  sido: '서울특별시', sigungu: '중구', tel: '02-123-4567', lat: 37.5665, lon: 126.978,
  hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, hasHours: true, raw: { hpid: 'C1100001' }, contentHash: 'h1',
  category: 'pharmacy', specialty: null, dong: '태평로1가', pediatricName: false,
  hasSunday: false, hasHoliday: false, hasNight: false,
  ...over,
});
const t1 = new Date('2026-11-01T00:00:00Z');
const t2 = new Date('2026-11-01T01:00:00Z');

describe('upsertInstitutions', () => {
  test('insert then unchanged is a no-op', async () => {
    expect(await upsertInstitutions(sql, [row()], t1)).toEqual({ inserted: 1, changed: 0, changedIds: [] });
    expect(await upsertInstitutions(sql, [row()], t2)).toEqual({ inserted: 0, changed: 0, changedIds: [] });
    expect((await getInstitution(sql, 'pharmacy', 'C1100001'))?.updatedAt).toEqual(t1);
  });

  test('hash change updates row and updated_at', async () => {
    await upsertInstitutions(sql, [row()], t1);
    expect(await upsertInstitutions(sql, [row({ contentHash: 'h2', name: '새약국' })], t2)).toEqual({ inserted: 0, changed: 1, changedIds: ['C1100001'] });
    const rec = await getInstitution(sql, 'pharmacy', 'C1100001');
    expect(rec?.name).toBe('새약국');
    expect(rec?.updatedAt).toEqual(t2);
  });

  test('zero or missing coordinates leave geom null', async () => {
    await upsertInstitutions(sql, [row({ id: 'Z1', lat: 0, lon: 0 }), row({ id: 'Z2', lat: null, lon: null })], t1);
    expect((await getInstitution(sql, 'pharmacy', 'Z1'))?.hasGeom).toBe(false);
    expect((await getInstitution(sql, 'pharmacy', 'Z2'))?.hasGeom).toBe(false);
    expect(await getNearby(sql, 'pharmacy', 'Z1')).toEqual([]);
  });

  test('duplicate ids in one call keep the last row', async () => {
    expect(await upsertInstitutions(sql, [row({ id: 'DUP', name: '첫번째' }), row({ id: 'DUP', name: '두번째', contentHash: 'h9' })], t1))
      .toEqual({ inserted: 1, changed: 0, changedIds: [] });
    expect((await getInstitution(sql, 'pharmacy', 'DUP'))?.name).toBe('두번째');
  });

  test('batches larger than 1000 rows', async () => {
    const rows = Array.from({ length: 1205 }, (_, i) => row({ id: `B${i}`, contentHash: `h${i}` }));
    expect((await upsertInstitutions(sql, rows, t1)).inserted).toBe(1205);
  });
});

describe('sido merge (P0-1)', () => {
  test('region change alone counts as a change', async () => {
    await upsertInstitutions(sql, [row({ sido: null, sigungu: null })], t1);
    expect(await upsertInstitutions(sql, [row()], t2)).toEqual({ inserted: 0, changed: 1, changedIds: ['C1100001'] });
  });

  test('migration 0007 re-derives empty and old sido, leaves the rest', async () => {
    const JG = '전남광주통합특별시';
    await upsertInstitutions(sql, [
      row({ id: 'H1', kind: 'hospital', addr: JG + ' 고흥군 고흥읍 터미널길 16', sido: null, sigungu: null }),
      row({ id: 'P1', addr: '광주광역시 북구 무등로 1', sido: '광주광역시', sigungu: '북구' }),
      row({ id: 'P2', addr: '서울 성동구 독서당로 278 1층  (금호동4가)', sido: null, sigungu: null }),
      row({ id: 'P3', addr: '경기도 금빛로 27', sido: null, sigungu: null }),
      row({ id: 'P4' }),
    ], t1);
    await sql.unsafe(await readFile(join(MIGRATIONS_DIR, '0007_sido_merge.sql'), 'utf8'));
    const got = await sql<{ id: string; sido: string | null; sigungu: string | null }[]>`select id, sido, sigungu from institutions order by id`;
    expect(got.map((r) => [r.id, r.sido, r.sigungu])).toEqual([
      ['H1', JG, '고흥군'], ['P1', JG, '북구'], ['P2', '서울특별시', '성동구'], ['P3', null, null], ['P4', '서울특별시', '중구'],
    ]);
    expect((await listNeighborhoods(sql)).some((n) => n.sido === JG && n.sigungu === '고흥군')).toBe(true);
  });
});

describe('refreshDuplicates (D76)', () => {
  // 실데이터 꼴: 같은 이름·전화·주소, 한쪽만 토요일
  const SAT = { dutyTime1s: '0900', dutyTime1c: '1800', dutyTime6s: '0900', dutyTime6c: '1300' };
  const WEEKDAY = { dutyTime1s: '0900', dutyTime1c: '1800' };
  const H = (id: string, over: Partial<InstitutionRow> = {}) =>
    row({ id, kind: 'hospital', name: '수내봄산부인과의원', tel: '031-712-2204', addr: '경기도 성남시 분당구 백현로101번길 29', category: 'general', ...over });

  test('one listed per group; the other id shows the representative', async () => {
    await upsertInstitutions(sql, [H('A2121617', { hours: SAT }), H('A2121621', { hours: WEEKDAY }), H('Z', { name: '다른의원' })], t1);
    expect(await refreshDuplicates(sql)).toEqual({ groups: 1, changed: 1, changedIds: [{ kind: 'hospital', id: 'A2121621' }] });
    const cell = await listRegion(sql, '서울특별시', '중구', 'hospital');
    expect(cell.map((r) => r.id).sort()).toEqual(['A2121617', 'Z']);
    const viaDup = await getInstitution(sql, 'hospital', 'A2121621');
    expect(viaDup?.id).toBe('A2121617');
    expect(viaDup?.hours).toEqual(SAT);
    expect((await listSitemapEntries(sql, 0, 10)).map((r) => r.id).sort()).toEqual(['A2121617', 'Z']);
    expect((await searchInstitutions(sql, '수내봄')).map((r) => r.id)).toEqual(['A2121617']);
  });

  test('a day only the duplicate has is merged into what the representative shows', async () => {
    await upsertInstitutions(sql, [H('A', { hours: { ...WEEKDAY, dutyTime2s: '0900', dutyTime2c: '1800' } }), H('B', { hours: SAT })], t1);
    await refreshDuplicates(sql);
    const [r] = await listRegion(sql, '서울특별시', '중구', 'hospital');
    expect(r?.id).toBe('A');
    expect(r?.hours).toEqual({ ...SAT, dutyTime2s: '0900', dutyTime2c: '1800' });
  });

  test('spacing and symbols are ignored; a different name at the same tel/addr is not merged', async () => {
    await upsertInstitutions(sql, [H('A'), H('B', { name: '수내봄 산부인과의원', tel: '031 712 2204' }), H('C', { name: '수내봄내과의원' })], t1);
    expect((await refreshDuplicates(sql)).groups).toBe(1);
    expect((await listRegion(sql, '서울특별시', '중구', 'hospital')).map((r) => r.id).sort()).toEqual(['A', 'C']);
  });

  test('rerun without changes touches nothing; a fixed source releases the group', async () => {
    await upsertInstitutions(sql, [H('A', { hours: SAT }), H('B', { hours: WEEKDAY })], t1);
    await refreshDuplicates(sql);
    expect((await refreshDuplicates(sql)).changed).toBe(0);
    await upsertInstitutions(sql, [H('B', { name: '새이름의원', hours: WEEKDAY, contentHash: 'h2' })], t2);
    expect(await refreshDuplicates(sql)).toMatchObject({ groups: 0, changed: 1 });
    expect((await listRegion(sql, '서울특별시', '중구', 'hospital')).map((r) => r.id).sort()).toEqual(['A', 'B']);
  });
});

describe('listEmergency (D78)', () => {
  test('active ER hospitals with coordinates, ER phone when the source has one', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'E1', kind: 'hospital', category: 'general', name: '가병원', raw: { dutyEryn: '1', dutyTel3: '02-111-0119' } }),
      row({ id: 'E2', kind: 'hospital', category: 'general', name: '나병원', raw: { dutyEryn: '1' } }),
      row({ id: 'E3', kind: 'hospital', category: 'general', name: '다병원', raw: { dutyEryn: '2' } }),
      row({ id: 'E4', kind: 'hospital', category: 'general', name: '라병원', raw: { dutyEryn: '1' }, lat: null, lon: null }),
    ], t1);
    const list = await listEmergency(sql);
    expect(list.map((r) => [r.id, r.erTel])).toEqual([['E1', '02-111-0119'], ['E2', null]]);
    expect(list[0]).toMatchObject({ tel: '02-123-4567', sido: '서울특별시', sigungu: '중구' });
  });
});

describe('listChangedIndexable (P1-1, D75)', () => {
  test('only pages that are in the sitemap: changed since the run, active, with hours', async () => {
    await upsertInstitutions(sql, [row({ id: 'A' }), row({ id: 'B' }), row({ id: 'N', hasHours: false, hours: {} })], t1);
    await upsertInstitutions(sql, [row({ id: 'B', contentHash: 'h2' }), row({ id: 'N', hasHours: false, hours: {}, contentHash: 'h2' })], t2);
    expect(await listChangedIndexable(sql, t2)).toEqual([{ kind: 'pharmacy', id: 'B' }]);
  });
});

describe('listChangedRegions (P0-10)', () => {
  test('regions of rows inserted, changed or deactivated since the run started', async () => {
    await upsertInstitutions(sql, [row({ id: 'A' }), row({ id: 'B', sigungu: '마포구' }), row({ id: 'H', kind: 'hospital', sigungu: '강남구' })], t1);
    expect(await listChangedRegions(sql, t2)).toEqual([]);
    await upsertInstitutions(sql, [row({ id: 'B', sigungu: '마포구', contentHash: 'h2' })], t2);
    await deactivateMissing(sql, 'hospital', [], t2);
    expect(await listChangedRegions(sql, t2)).toEqual([
      { kind: 'hospital', sido: '서울특별시', sigungu: '강남구' },
      { kind: 'pharmacy', sido: '서울특별시', sigungu: '마포구' },
    ]);
  });
});

describe('deactivateMissing', () => {
  test('deactivates unseen of same kind only and reactivates on return', async () => {
    await upsertInstitutions(sql, [row({ id: 'A' }), row({ id: 'B' }), row({ id: 'H', kind: 'hospital' })], t1);
    expect(await deactivateMissing(sql, 'pharmacy', ['A'], t2)).toEqual(['B']);
    expect((await getInstitution(sql, 'pharmacy', 'B'))?.isActive).toBe(false);
    expect((await getInstitution(sql, 'hospital', 'H'))?.isActive).toBe(true);
    expect(await upsertInstitutions(sql, [row({ id: 'B' })], t2)).toEqual({ inserted: 0, changed: 1, changedIds: ['B'] });
    expect((await getInstitution(sql, 'pharmacy', 'B'))?.isActive).toBe(true);
  });
});

describe('reads', () => {
  test('nearby orders by distance within radius', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'P0' }),
      row({ id: 'P1', lat: 37.5675, name: '가까운약국' }),   // 약 110m
      row({ id: 'P2', lat: 37.5765, name: '먼약국' }),       // 약 1.1km
      row({ id: 'P3', lat: 37.7, name: '아주먼약국' }),      // 약 15km
      row({ id: 'H1', kind: 'hospital', lat: 37.5666 }),
    ], t1);
    const near = await getNearby(sql, 'pharmacy', 'P0');
    expect(near.map((n) => n.id)).toEqual(['P1', 'P2']);
    expect(near[0]!.distanceM).toBeGreaterThan(90);
    expect(near[0]!.distanceM).toBeLessThan(130);
  });

  test('region lists and counts', async () => {
    await upsertInstitutions(sql, [row({ id: 'A', name: '나약국' }), row({ id: 'B', name: '가약국' }), row({ id: 'H', kind: 'hospital' })], t1);
    expect((await listRegion(sql, '서울특별시', '중구', 'pharmacy')).map((r) => r.name)).toEqual(['가약국', '나약국']);
    expect(await listRegions(sql)).toEqual([{ sido: '서울특별시', sigungu: '중구', hospital: 1, pharmacy: 2 }]);
  });

  test('sitemap excludes institutions without hours', async () => {
    await upsertInstitutions(sql, [row({ id: 'A' }), row({ id: 'B', hasHours: false, hours: {} })], t1);
    expect(await countSitemapEntries(sql)).toBe(1);
    expect(await listSitemapEntries(sql, 0, 10)).toEqual([{ kind: 'pharmacy', id: 'A', updatedAt: t1 }]);
  });

  test('holidays seed and upsert', async () => {
    expect(await getHolidays(sql, '2027-02-01', '2027-02-28')).toEqual(['2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09']);
    await upsertHolidays(sql, [{ ymd: '2027-02-10', name: '테스트' }], 'kasi');
    expect(await getHolidays(sql, '2027-02-10', '2027-02-10')).toEqual(['2027-02-10']);
  });

  test('events store no client identifiers', async () => {
    await insertEvent(sql, { type: 'tel_tap', institutionId: 'A', page: '/pharmacy/A', source: 'share' });
    const cols = await sql<{ column_name: string }[]>`select column_name from information_schema.columns where table_name = 'events'`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(['created_minute', 'id', 'institution_id', 'page', 'source', 'type']);
    const [row] = await sql<{ source: string | null }[]>`select source from events`;
    expect(row?.source).toBe('share');
    const [e] = await sql<{ s: number }[]>`select extract(second from created_minute)::int as s from events`;
    expect(e?.s).toBe(0);
  });

  test('sync runs give last success time', async () => {
    const id = await startRun(sql, 'pharmacy', t1);
    expect(await getLastSyncAt(sql, 'pharmacy')).toBeNull();
    await finishRun(sql, id, { status: 'ok', pages: 3, rows: 10, changed: 1, deactivated: 0 });
    expect(await getLastSyncAt(sql, 'pharmacy')).toBeInstanceOf(Date);
  });
});

describe('search and regions', () => {
  test('searchInstitutions matches name parts, active only, max limit', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'S1', name: '시청온누리약국' }),
      row({ id: 'S2', name: '서울시청약국' }),
      row({ id: 'S3', name: '시청앞약국' }),
      row({ id: 'X1', name: '다른약국' }),
    ], t1);
    await deactivateMissing(sql, 'pharmacy', ['S1', 'S2', 'X1'], t2);
    const hits = await searchInstitutions(sql, '시청', 10);
    expect(hits.map((h) => h.id).sort()).toEqual(['S1', 'S2']);
    expect(hits[0]).toMatchObject({ sido: '서울특별시', sigungu: '중구', category: 'pharmacy' });
    expect(await searchInstitutions(sql, '시청', 1)).toHaveLength(1);
  });

  test('a two-letter term matches anywhere in the name (2-letter index, not trigram)', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'M1', kind: 'hospital', name: '국립정신건강센터' }),
      row({ id: 'M2', kind: 'hospital', name: '마음정신과의원' }),
      row({ id: 'M3', kind: 'hospital', name: '정형외과의원' }),
      row({ id: 'M4', name: 'ABC약국' }),
    ], t1);
    expect((await searchInstitutions(sql, '정신', 10)).map((h) => h.id).sort()).toEqual(['M1', 'M2']);
    expect((await searchInstitutions(sql, '건강', 10)).map((h) => h.id)).toEqual(['M1']);
    expect((await searchInstitutions(sql, 'bc', 10)).map((h) => h.id)).toEqual(['M4']);
  });

  test('near search: nearby first; widens to the whole country when fewer than the limit nearby', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'P1', name: '정신약국', lat: 37.5665, lon: 126.978 }), // 서울시청
      row({ id: 'P2', name: '정신건강약국', lat: 37.57, lon: 126.98 }), // 약 0.5km
      row({ id: 'P3', name: '부산정신약국', lat: 35.1796, lon: 129.0756 }), // 부산, 약 325km
    ], t1);
    const near = { lat: 37.5665, lon: 126.978 };
    expect((await searchInstitutions(sql, '정신', 2, near)).map((h) => h.id)).toEqual(['P1', 'P2']);
    const all = await searchInstitutions(sql, '정신', 10, near);
    expect(all.map((h) => h.id)).toEqual(['P1', 'P2', 'P3']);
    expect(all[2]!.distanceM).toBeGreaterThan(300_000);
  });

  test('search treats LIKE wildcards literally', async () => {
    await upsertInstitutions(sql, [row({ id: 'W1', name: '백퍼센트약국' })], t1);
    expect(await searchInstitutions(sql, '%%', 10)).toEqual([]);
  });

  test('refreshNeighborhoods builds dong and sigungu rows', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'N1', dong: '역삼동', sigungu: '강남구', lat: 37.50, lon: 127.03 }),
      row({ id: 'N2', dong: '역삼동', sigungu: '강남구', lat: 37.52, lon: 127.05 }),
      row({ id: 'N3', dong: null, sigungu: '강남구', lat: 37.51, lon: 127.04 }),
    ], t1);
    expect(await refreshNeighborhoods(sql)).toBe(2);
    const list = await listNeighborhoods(sql);
    expect(list).toContainEqual({ name: '역삼동', sido: '서울특별시', sigungu: '강남구', lat: 37.51, lon: 127.04 });
    expect(list.find((n) => n.name === '강남구')).toBeTruthy();
  });

  test('listSido and getRegionStats', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'R1', hours: { dutyTime7s: '1000', dutyTime7c: '1400', dutyTime8s: '1000', dutyTime8c: '1400' } }),
      row({ id: 'R2' }),
      row({ id: 'R3', kind: 'hospital', category: 'general' }),
    ], t1);
    expect(await listSido(sql)).toEqual([{ sido: '서울특별시', hospital: 1, pharmacy: 2 }]);
    expect(await getRegionStats(sql, '서울특별시', '중구', 'pharmacy')).toEqual({ total: 2, withHoliday: 1, withSunday: 1 });
  });

  test('summaries carry badge fields', async () => {
    await upsertInstitutions(sql, [row({ id: 'K1', kind: 'hospital', category: 'general', specialty: '소아청소년과', pediatricName: true })], t1);
    const [k] = await listRegion(sql, '서울특별시', '중구', 'hospital');
    expect(k).toMatchObject({ category: 'general', specialty: '소아청소년과', pediatricName: true, lat: 37.5665 });
  });
});

describe('listLandingCounts', () => {
  test('counts per region, kind and situation like the landing filter', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'L1', hasSunday: true }),
      row({ id: 'L2', hasHoliday: true, hasNight: true }),
      row({ id: 'L3', hasNight: true }),
      row({ id: 'L4' }),
      row({ id: 'L5', kind: 'hospital', category: 'general', hours: {} }),
    ], t1);
    const rows = await listLandingCounts(sql);
    expect(rows).toContainEqual({ sido: '서울특별시', sigungu: '중구', kind: 'pharmacy', all: 4, sunday: 1, holiday: 1, night: 2 });
    expect(rows).toContainEqual({ sido: '서울특별시', sigungu: '중구', kind: 'hospital', all: 1, sunday: 0, holiday: 0, night: 0 });
  });
});

describe('grid', () => {
  // 명동 칸(834_2267): 위도 37.530~37.575, 경도 126.952~127.008
  test('listGridCell returns active rows with coordinates in that cell and kind', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'G1', name: '나약국', lat: 37.5637, lon: 126.9838 }),
      row({ id: 'G2', name: '가약국', lat: 37.5500, lon: 126.9600 }),
      row({ id: 'N1', name: '옆칸약국', lat: 37.5800, lon: 126.9838 }),
      row({ id: 'H1', kind: 'hospital', category: 'general', name: '명동의원', lat: 37.5637, lon: 126.9838 }),
      row({ id: 'Z1', name: '좌표없음약국', lat: null, lon: null }),
      row({ id: 'D1', name: '닫은약국', lat: 37.5637, lon: 126.9838 }),
    ], t1);
    await deactivateMissing(sql, 'pharmacy', ['G1', 'G2', 'N1', 'Z1'], t2);
    const cell = gridOf(37.5637, 126.9838);
    const rows = await listGridCell(sql, 'pharmacy', cell.gy, cell.gx);
    expect(rows.map((r) => r.id)).toEqual(['G2', 'G1']);
    expect(rows[0]).toMatchObject({ sido: '서울특별시', sigungu: '중구', lat: 37.55, lon: 126.96, category: 'pharmacy' });
    expect((await listGridCell(sql, 'hospital', cell.gy, cell.gx)).map((r) => r.id)).toEqual(['H1']);
    const fine = gridOf(37.5637, 126.9838, 'fine');
    expect((await listGridCell(sql, 'pharmacy', fine.gy, fine.gx, 'fine')).map((r) => r.id)).toEqual(['G1']);
  });

  test('db grid columns match core gridOf on cell edges', async () => {
    const pts: [number, number][] = [[37.53, 126.952], [37.575, 127.008], [33.0, 124.0], [38.99999, 131.99999], [37.5637, 126.9838]];
    await upsertInstitutions(sql, pts.map(([lat, lon], i) => row({ id: 'E' + i, lat, lon })), t1);
    const got = await sql<{ id: string; gy: number; gx: number; fy: number; fx: number }[]>`select id, grid_y as gy, grid_x as gx, fgrid_y as fy, fgrid_x as fx from institutions order by id`;
    expect(got.map((g) => ({ gy: g.gy, gx: g.gx }))).toEqual(pts.map(([lat, lon]) => gridOf(lat, lon)));
    expect(got.map((g) => ({ gy: g.fy, gx: g.fx }))).toEqual(pts.map(([lat, lon]) => gridOf(lat, lon, 'fine')));
    expect(FINE_GRID_LAT).toBe(0.009);
    expect(FINE_GRID_LON).toBe(0.0112);
    expect(GRID_LAT).toBe(0.045);
    expect(GRID_LON).toBe(0.056);
  });

  test('searchInstitutions near orders by distance and returns distanceM', async () => {
    await upsertInstitutions(sql, [
      row({ id: 'F', name: '온누리약국', lat: 37.60, lon: 126.98 }),
      row({ id: 'M', name: '온누리약국', lat: 37.57, lon: 126.98 }),
      row({ id: 'C', name: '온누리약국', lat: 37.5637, lon: 126.9838 }),
      row({ id: 'X', name: '온누리약국', lat: null, lon: null }),
    ], t1);
    const hits = await searchInstitutions(sql, '온누리', 20, { lat: 37.5637, lon: 126.9838 });
    expect(hits.map((h) => h.id)).toEqual(['C', 'M', 'F', 'X']);
    expect(hits[0]?.distanceM).toBe(0);
    expect(hits[1]?.distanceM).toBeGreaterThan(500);
    expect(hits[3]?.distanceM).toBeUndefined();
  });
});

describe('insertFeedback (D49)', () => {
  const fb = { type: 'correction' as const, body: '', fields: ['tel', 'hours'], kind: 'pharmacy' as const, institutionId: 'C1100001', path: '/pharmacy/C1100001' };

  test('stores only the given fields with a minute timestamp, and skips the same report within 10 minutes', async () => {
    expect(await insertFeedback(sql, fb)).toBe(true);
    expect(await insertFeedback(sql, fb)).toBe(false);
    expect(await insertFeedback(sql, { ...fb, fields: ['tel'] })).toBe(true);
    expect(await insertFeedback(sql, { ...fb, institutionId: 'C1100002' })).toBe(true);
    const rows = await sql<{ type: string; fields: string[]; created_minute: Date }[]>`select type, fields, created_minute from feedback order by id`;
    expect(rows).toHaveLength(3);
    expect(rows[0]!.fields).toEqual(['tel', 'hours']);
    expect(rows[0]!.created_minute.getSeconds()).toBe(0);
  });

  test('opinions without an institution are deduplicated by body', async () => {
    const op = { type: 'opinion' as const, body: '글씨가 작아요', fields: [], kind: null, institutionId: null, path: '/' };
    expect(await insertFeedback(sql, op)).toBe(true);
    expect(await insertFeedback(sql, op)).toBe(false);
    expect(await insertFeedback(sql, { ...op, body: '지도가 있으면 좋겠어요' })).toBe(true);
  });
});

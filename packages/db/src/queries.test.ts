import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { Sql } from './client.ts';
import {
  countSitemapEntries, deactivateMissing, finishRun, getHolidays, getInstitution, getLastSyncAt, getNearby,
  insertEvent, listRegion, listRegions, listSitemapEntries, startRun, upsertHolidays, upsertInstitutions,
  type InstitutionRow,
} from './queries.ts';
import { startTestDb } from './test-db.ts';

let sql: Sql;
let stop: () => Promise<void>;

beforeAll(async () => {
  ({ sql, stop } = await startTestDb());
}, 60_000);
afterAll(async () => stop?.());
beforeEach(async () => {
  await sql`truncate institutions, events, sync_runs`;
});

const row = (over: Partial<InstitutionRow> = {}): InstitutionRow => ({
  id: 'C1100001', kind: 'pharmacy', name: '시청약국', divName: null, addr: '서울특별시 중구 세종대로 110',
  sido: '서울특별시', sigungu: '중구', tel: '02-123-4567', lat: 37.5665, lon: 126.978,
  hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, hasHours: true, raw: { hpid: 'C1100001' }, contentHash: 'h1',
  ...over,
});
const t1 = new Date('2026-11-01T00:00:00Z');
const t2 = new Date('2026-11-01T01:00:00Z');

describe('upsertInstitutions', () => {
  test('insert then unchanged is a no-op', async () => {
    expect(await upsertInstitutions(sql, [row()], t1)).toEqual({ inserted: 1, changed: 0 });
    expect(await upsertInstitutions(sql, [row()], t2)).toEqual({ inserted: 0, changed: 0 });
    expect((await getInstitution(sql, 'pharmacy', 'C1100001'))?.updatedAt).toEqual(t1);
  });

  test('hash change updates row and updated_at', async () => {
    await upsertInstitutions(sql, [row()], t1);
    expect(await upsertInstitutions(sql, [row({ contentHash: 'h2', name: '새약국' })], t2)).toEqual({ inserted: 0, changed: 1 });
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

  test('batches larger than 1000 rows', async () => {
    const rows = Array.from({ length: 1205 }, (_, i) => row({ id: `B${i}`, contentHash: `h${i}` }));
    expect((await upsertInstitutions(sql, rows, t1)).inserted).toBe(1205);
  });
});

describe('deactivateMissing', () => {
  test('deactivates unseen of same kind only and reactivates on return', async () => {
    await upsertInstitutions(sql, [row({ id: 'A' }), row({ id: 'B' }), row({ id: 'H', kind: 'hospital' })], t1);
    expect(await deactivateMissing(sql, 'pharmacy', ['A'], t2)).toBe(1);
    expect((await getInstitution(sql, 'pharmacy', 'B'))?.isActive).toBe(false);
    expect((await getInstitution(sql, 'hospital', 'H'))?.isActive).toBe(true);
    expect(await upsertInstitutions(sql, [row({ id: 'B' })], t2)).toEqual({ inserted: 0, changed: 1 });
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
    await insertEvent(sql, { type: 'tel_tap', institutionId: 'A', page: '/pharmacy/A' });
    const cols = await sql<{ column_name: string }[]>`select column_name from information_schema.columns where table_name = 'events'`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(['created_minute', 'id', 'institution_id', 'page', 'type']);
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

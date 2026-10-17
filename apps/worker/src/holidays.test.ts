import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { parseKasi, syncHolidays } from './holidays.ts';
import { parsePage, PortalError } from './portal.ts';

const page = parsePage(readFileSync(new URL('./__fixtures__/kasi-2027.xml', import.meta.url), 'utf8'));

describe('parseKasi', () => {
  test('keeps only isHoliday=Y and formats dates', () => {
    expect(parseKasi(page.items)).toEqual([
      { ymd: '2027-01-01', name: '1월1일' },
      { ymd: '2027-02-06', name: '설날' },
      { ymd: '2027-02-07', name: '설날' },
      { ymd: '2027-02-08', name: '설날' },
      { ymd: '2027-02-09', name: '대체공휴일' },
    ]);
  });
  test('drops malformed locdate', () => expect(parseKasi([{ isHoliday: 'Y', locdate: '2027', dateName: 'x' }])).toEqual([]));
});

describe('syncHolidays', () => {
  test('fetches each year and upserts as kasi', async () => {
    const fetchYear = vi.fn(async () => page);
    const upsert = vi.fn(async (rows: unknown[]) => rows.length);
    expect(await syncHolidays([2026, 2027], { fetchYear, upsert })).toBe(10);
    expect(fetchYear.mock.calls.map((c) => (c as unknown[])[0])).toEqual([2026, 2027]);
  });
  test('portal error propagates (seed data stays)', async () => {
    const fetchYear = vi.fn(async () => { throw new PortalError('30', 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'); });
    const upsert = vi.fn();
    await expect(syncHolidays([2027], { fetchYear, upsert })).rejects.toThrow(PortalError);
    expect(upsert).not.toHaveBeenCalled();
  });
});

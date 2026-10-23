import { describe, expect, test } from 'vitest';
import { dateLabel, dayLabel, tierOnDate } from './day.ts';
import { parseWeeklyHours, type RawHours } from './hours.ts';

// 2026-10-25(일) 평일 일요일, 2026-12-25(금) 공휴일
const ctx = { holidays: new Set(['2026-12-25']) };
const w = (raw: RawHours) => parseWeeklyHours(raw);

describe('tierOnDate — 날짜를 고른 목록(\'지금\'과 같은 규칙)', () => {
  test('registered hours for that weekday → open that day with its range', () =>
    expect(tierOnDate(w({ dutyTime7s: '0900', dutyTime7c: '1800' }), '2026-10-25', ctx)).toEqual({
      tier: 'open', range: { open: 540, close: 1080 },
    }));

  test('empty weekday field is unknown, not closed', () =>
    expect(tierOnDate(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), '2026-10-25', ctx)).toEqual({ tier: 'unknown' }));

  test('holiday uses code 8 when registered', () =>
    expect(tierOnDate(w({ dutyTime8s: '1000', dutyTime8c: '1500', dutyTime5s: '0900', dutyTime5c: '1800' }), '2026-12-25', ctx)).toEqual({
      tier: 'open', range: { open: 600, close: 900 },
    }));

  test('holiday without code 8 but with that weekday hours → call to confirm, usual hours shown', () =>
    expect(tierOnDate(w({ dutyTime5s: '0900', dutyTime5c: '1800' }), '2026-12-25', ctx)).toEqual({
      tier: 'holidayUsual', weekdayLabel: '금요일', range: { open: 540, close: 1080 },
    }));

  test('holiday with neither is unknown', () =>
    expect(tierOnDate(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), '2026-12-25', ctx)).toEqual({ tier: 'unknown' }));

  test('both midnight notations keep their next-day close', () => {
    expect(tierOnDate(w({ dutyTime7s: '0900', dutyTime7c: '2500' }), '2026-10-25', ctx).range).toEqual({ open: 540, close: 1500 });
    expect(tierOnDate(w({ dutyTime7s: '2000', dutyTime7c: '0300' }), '2026-10-25', ctx).range).toEqual({ open: 1200, close: 1620 });
  });
});

describe('labels', () => {
  test('dateLabel', () => {
    expect(dateLabel('2026-10-25')).toBe('10/25(일)');
    expect(dateLabel('2027-02-07')).toBe('2/7(일)');
  });
  test('dayLabel uses the schedule notation', () => {
    expect(dayLabel({ open: 540, close: 1080 })).toBe('09:00~18:00');
    expect(dayLabel({ open: 1200, close: 1620 })).toBe('20:00~익일 03:00');
    expect(dayLabel({ open: 0, close: 1440 })).toBe('24시간');
  });
});

import { describe, expect, test } from 'vitest';
import type { Category } from './classify.ts';
import { parseWeeklyHours, type RawHours } from './hours.ts';
import { nextOpening, orderList, soonLabel, tierOf, usualHoursOpen, usualLabel, type ListTier } from './list.ts';

// 2026-12-25(금) 공휴일, 2026-12-24(목) 평일, 2026-10-19(월) 평일
const ctx = { holidays: new Set(['2026-12-25', '2027-01-01']) };
const kst = (s: string) => new Date(`${s}+09:00`);
const w = (raw: RawHours) => parseWeeklyHours(raw);

describe('nextOpening', () => {
  const mon21: RawHours = { dutyTime1s: '2100', dutyTime1c: '2300' };

  test('opens later today within 2 hours', () =>
    expect(nextOpening(w(mon21), kst('2026-10-19T20:00:00'), ctx)).toEqual(kst('2026-10-19T21:00:00')));

  test('more than 2 hours away is null', () =>
    expect(nextOpening(w(mon21), kst('2026-10-19T18:00:00'), ctx)).toBeNull());

  test('exactly 2 hours away counts', () =>
    expect(nextOpening(w(mon21), kst('2026-10-19T19:00:00'), ctx)).toEqual(kst('2026-10-19T21:00:00')));

  test('open now is null', () =>
    expect(nextOpening(w(mon21), kst('2026-10-19T21:30:00'), ctx)).toBeNull());

  test('nextOpening crosses midnight into tomorrow weekday code', () => {
    const tue0030: RawHours = { dutyTime2s: '0030', dutyTime2c: '0900' };
    expect(nextOpening(w(tue0030), kst('2026-10-19T23:30:00'), ctx)).toEqual(kst('2026-10-20T00:30:00'));
  });

  test('tomorrow holiday uses code 8', () => {
    // 12-24(목) 23:30 → 12-25(금, 공휴일)
    const withHoliday: RawHours = { dutyTime5s: '0030', dutyTime5c: '0900', dutyTime8s: '0000', dutyTime8c: '0600' };
    expect(nextOpening(w(withHoliday), kst('2026-12-24T23:30:00'), ctx)).toEqual(kst('2026-12-25T00:00:00'));
    const noHoliday: RawHours = { dutyTime5s: '0030', dutyTime5c: '0900' };
    expect(nextOpening(w(noHoliday), kst('2026-12-24T23:30:00'), ctx)).toBeNull();
  });

  test('no hours is null', () => expect(nextOpening(w({}), kst('2026-10-19T20:00:00'), ctx)).toBeNull());

  // 2026-10-19 사용자 결정: 오늘 칸이 비어 있어도(정보 없음) 내일 2시간 안에 열면 '곧 영업'으로 둔다
  test('today unknown but opens tomorrow within 2 hours is soon', () => {
    const tueOnly: RawHours = { dutyTime2s: '0000', dutyTime2c: '0900' };
    expect(nextOpening(w(tueOnly), kst('2026-10-19T22:30:00'), ctx)).toEqual(kst('2026-10-20T00:00:00'));
    expect(tierOf(w(tueOnly), kst('2026-10-19T22:30:00'), ctx).tier).toBe('soon');
  });
});

describe('usualHoursOpen', () => {
  const fri9to18: RawHours = { dutyTime5s: '0900', dutyTime5c: '1800' };

  test('holiday without code 8 but usual friday hours cover now', () =>
    expect(usualHoursOpen(w(fri9to18), kst('2026-12-25T10:00:00'), ctx)).toEqual({ weekdayLabel: '금요일' }));

  test('holidayUsual only when code 8 missing', () =>
    expect(usualHoursOpen(w({ ...fri9to18, dutyTime8s: '1300', dutyTime8c: '1500' }), kst('2026-12-25T10:00:00'), ctx)).toBeNull());

  test('usual hours do not cover now', () =>
    expect(usualHoursOpen(w(fri9to18), kst('2026-12-25T19:00:00'), ctx)).toBeNull());

  test('no usual hours for that weekday', () =>
    expect(usualHoursOpen(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), kst('2026-12-25T10:00:00'), ctx)).toBeNull());

  test('not a holiday', () =>
    expect(usualHoursOpen(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), kst('2026-10-19T10:00:00'), ctx)).toBeNull());

  test('holiday early morning, usual friday overnight range from thursday-style start is not used', () => {
    // 금요일 2000-0300: 12-25(금) 01:00은 목요일(12-24) 구간이므로 금요일 평소 시간으로는 닫힘
    expect(usualHoursOpen(w({ dutyTime5s: '2000', dutyTime5c: '0300' }), kst('2026-12-25T01:00:00'), ctx)).toBeNull();
  });
});

describe('tierOf', () => {
  test('open', () => expect(tierOf(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), kst('2026-10-19T10:00:00'), ctx).tier).toBe('open'));
  test('24 hours is open', () =>
    expect(tierOf(w({ dutyTime1s: '0000', dutyTime1c: '2400', dutyTime2s: '0000', dutyTime2c: '2400' }), kst('2026-10-19T23:50:00'), ctx).tier).toBe('open'));
  test('soon', () => {
    const t = tierOf(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), kst('2026-10-19T08:00:00'), ctx);
    expect(t).toEqual({ tier: 'soon', opensAt: kst('2026-10-19T09:00:00') });
  });
  test('holidayUsual', () =>
    expect(tierOf(w({ dutyTime5s: '0900', dutyTime5c: '1800' }), kst('2026-12-25T10:00:00'), ctx)).toEqual({ tier: 'holidayUsual', weekdayLabel: '금요일' }));
  test('closed', () => expect(tierOf(w({ dutyTime1s: '0900', dutyTime1c: '1800' }), kst('2026-10-19T20:00:00'), ctx).tier).toBe('closed'));
  test('unknown', () => expect(tierOf(w({}), kst('2026-10-19T20:00:00'), ctx).tier).toBe('unknown'));
});

describe('orderList', () => {
  const item = (id: string, tier: ListTier, category: Category, distanceM: number) => ({ id, tier, category, distanceM });
  const items = [
    item('closed-near', 'closed', 'general', 100),
    item('oriental-open', 'open', 'oriental', 50),
    item('open-far', 'open', 'general', 900),
    item('soon', 'soon', 'general', 300),
    item('open-near', 'open', 'general', 200),
    item('unknown', 'unknown', 'general', 150),
    item('usual', 'holidayUsual', 'general', 120),
    item('dental-closed', 'closed', 'dental', 10),
    item('dental-soon', 'soon', 'dental', 20),
  ];

  test('open mode: open → soon → holidayUsual, minor categories last in each section', () =>
    expect(orderList(items, 'open').map((i) => i.id)).toEqual([
      'open-near', 'open-far', 'oriental-open', 'soon', 'dental-soon', 'usual',
    ]));

  test('all mode appends closed and unknown by distance, minor last', () =>
    expect(orderList(items, 'all').map((i) => i.id)).toEqual([
      'open-near', 'open-far', 'oriental-open', 'soon', 'dental-soon', 'usual', 'closed-near', 'unknown', 'dental-closed',
    ]));

  test('does not mutate input', () => {
    const copy = items.map((i) => i.id);
    orderList(items, 'all');
    expect(items.map((i) => i.id)).toEqual(copy);
  });
});

describe('labels', () => {
  const at = kst('2026-10-19T20:00:00');
  test('minutes', () => expect(soonLabel(kst('2026-10-19T20:40:00'), at)).toBe('곧 영업 · 40분 뒤 오후 8시 40분'));
  test('one hour', () => expect(soonLabel(kst('2026-10-19T21:00:00'), at)).toBe('곧 영업 · 1시간 뒤 오후 9시'));
  test('hour and half', () => expect(soonLabel(kst('2026-10-19T21:30:00'), at)).toBe('곧 영업 · 1시간 30분 뒤 오후 9시 30분'));
  test('after midnight', () =>
    expect(soonLabel(kst('2026-10-20T00:30:00'), kst('2026-10-19T23:30:00'))).toBe('곧 영업 · 1시간 뒤 새벽 12시 30분'));
  test('usual', () => expect(usualLabel('금요일')).toBe('평소 금요일엔 이 시간 영업'));
});

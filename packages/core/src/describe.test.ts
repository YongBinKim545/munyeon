import { describe, expect, test } from 'vitest';
import { describeStatus, koreanTime } from './describe.ts';
import { parseWeeklyHours, type RawHours } from './hours.ts';

const ctx = { holidays: new Set(['2026-12-25']) };
const kst = (s: string) => new Date(`${s}+09:00`);
const d = (raw: RawHours, at: string) => describeStatus(parseWeeklyHours(raw), kst(at), ctx);
const weekday: RawHours = {
  dutyTime1s: '0900', dutyTime1c: '1800', dutyTime2s: '0900', dutyTime2c: '1830',
  dutyTime5s: '0900', dutyTime5c: '1800',
};

describe('koreanTime', () => {
  test.each([
    ['2026-10-19T00:00:00', '자정'],
    ['2026-10-19T03:00:00', '새벽 3시'],
    ['2026-10-19T09:00:00', '오전 9시'],
    ['2026-10-19T12:00:00', '낮 12시'],
    ['2026-10-19T18:30:00', '오후 6시 30분'],
  ])('%s → %s', (at, expected) => expect(koreanTime(kst(at))).toBe(expected));
});

describe('describeStatus', () => {
  test('open', () => expect(d(weekday, '2026-10-19T10:00:00')).toEqual({ tone: 'open', text: '영업 중 · 오후 6시 마감 (등록 기준)', holiday: false }));
  test('closing soon', () => expect(d(weekday, '2026-10-19T17:20:00').text).toBe('곧 마감 · 40분 남음 (등록 기준)'));
  test('before opening', () => expect(d(weekday, '2026-10-19T08:00:00')).toMatchObject({ tone: 'closed', text: '영업 전 · 오전 9시 시작' }));
  test('closed with tomorrow hours', () => expect(d(weekday, '2026-10-19T19:00:00').text).toBe('영업 종료 · 내일 오전 9시 시작'));
  test('closed without tomorrow info', () => expect(d(weekday, '2026-10-20T19:00:00').text).toBe('영업 종료'));
  test('unknown today', () => expect(d(weekday, '2026-10-18T10:00:00')).toEqual({ tone: 'unknown', text: '오늘 정보 없음 — 전화로 확인', holiday: false }));
  test('holiday flag', () => expect(d(weekday, '2026-12-25T10:00:00')).toEqual({ tone: 'unknown', text: '오늘 정보 없음 — 전화로 확인', holiday: true }));
  test('overnight closes at dawn', () =>
    expect(d({ dutyTime1s: '2000', dutyTime1c: '0300' }, '2026-10-19T23:00:00').text).toBe('영업 중 · 새벽 3시 마감 (등록 기준)'));
  test('ends at midnight with no next-day continuation', () =>
    expect(d({ dutyTime1s: '0900', dutyTime1c: '2400' }, '2026-10-19T12:00:00').text).toBe('영업 중 · 자정 마감 (등록 기준)'));

  const allDay: RawHours = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [[`dutyTime${n}s`, '0000'], [`dutyTime${n}c`, '2400']]),
  );
  test('24h place at 23:30 is not closing soon', () =>
    expect(d(allDay, '2026-10-19T23:30:00')).toEqual({ tone: 'open', text: '24시간 영업 (등록 기준)', holiday: false }));
  test('24h place at noon', () => expect(d(allDay, '2026-10-19T12:00:00').text).toBe('24시간 영업 (등록 기준)'));
  test('24h on holiday uses code 8', () => expect(d(allDay, '2026-12-25T23:50:00')).toMatchObject({ text: '24시간 영업 (등록 기준)', holiday: true }));
  test('24h today but tomorrow unknown closes at midnight', () =>
    expect(d({ dutyTime1s: '0000', dutyTime1c: '2400' }, '2026-10-19T23:30:00').text).toBe('곧 마감 · 30분 남음 (등록 기준)'));
  test('list cards drop the basis suffix (D42); other states unchanged', () => {
    const card = (raw: RawHours, at: string) => describeStatus(parseWeeklyHours(raw), kst(at), ctx, { basis: false }).text;
    expect(card(weekday, '2026-10-19T10:00:00')).toBe('영업 중 · 오후 6시 마감');
    expect(card(weekday, '2026-10-19T17:20:00')).toBe('곧 마감 · 40분 남음');
    expect(card(allDay, '2026-10-19T12:00:00')).toBe('24시간 영업');
    expect(card(weekday, '2026-10-19T08:00:00')).toBe('영업 전 · 오전 9시 시작');
    expect(card(weekday, '2026-10-18T10:00:00')).toBe('오늘 정보 없음 — 전화로 확인');
  });
  test('midnight close chained to next day early hours', () =>
    expect(d({ dutyTime1s: '0900', dutyTime1c: '2400', dutyTime2s: '0000', dutyTime2c: '0200' }, '2026-10-19T23:30:00').text)
      .toBe('영업 중 · 새벽 2시 마감 (등록 기준)'));
});

import { describe, expect, test } from 'vitest';
import { parseWeeklyHours, type RawHours } from './hours.ts';
import { addDaysYmd, kstParts } from './kst.ts';
import { getOpenStatus } from './status.ts';

const ctx = {
  holidays: new Set(['2026-12-25', '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09']),
};
const kst = (s: string) => new Date(`${s}+09:00`);
const status = (raw: RawHours, at: string) => getOpenStatus(parseWeeklyHours(raw), kst(at), ctx);

// 2026-10-19 = 월요일
describe('kst', () => {
  test('kstParts ignores host timezone', () =>
    expect(kstParts(new Date('2026-10-18T15:30:00Z'))).toEqual({ ymd: '2026-10-19', weekday: 1, minute: 30 }));
  test('sunday is 7', () => expect(kstParts(kst('2026-10-18T12:00:00')).weekday).toBe(7));
  test('addDaysYmd crosses month and year', () => {
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysYmd('2027-03-01', -1)).toBe('2027-02-28');
  });
});

describe('getOpenStatus', () => {
  const mon9to18: RawHours = { dutyTime1s: '0900', dutyTime1c: '1800' };

  test('open within weekday range', () => {
    const s = status(mon9to18, '2026-10-19T10:00:00');
    expect(s.state).toBe('open');
    expect(s.basis).toBe('weekday');
    expect(s.closesAt).toEqual(kst('2026-10-19T18:00:00'));
  });

  test('closed after hours with no reopen', () => {
    const s = status(mon9to18, '2026-10-19T19:00:00');
    expect(s.state).toBe('closed');
    expect(s.opensAt).toBeUndefined();
  });

  test('closed before opening reports opensAt', () => {
    const s = status(mon9to18, '2026-10-19T08:00:00');
    expect(s.state).toBe('closed');
    expect(s.opensAt).toEqual(kst('2026-10-19T09:00:00'));
  });

  test('closing minute itself is closed', () => expect(status(mon9to18, '2026-10-19T18:00:00').state).toBe('closed'));

  test('missing weekday is unknown', () => expect(status(mon9to18, '2026-10-18T10:00:00').state).toBe('unknown'));

  test('2500 style still open at 00:30 next day', () => {
    const s = status({ dutyTime1s: '0900', dutyTime1c: '2500' }, '2026-10-20T00:30:00');
    expect(s.state).toBe('open');
    expect(s.closesAt).toEqual(kst('2026-10-20T01:00:00'));
  });

  test('2000-0300 still open at 01:00 next day', () => {
    const s = status({ dutyTime1s: '2000', dutyTime1c: '0300' }, '2026-10-20T01:00:00');
    expect(s.state).toBe('open');
    expect(s.closesAt).toEqual(kst('2026-10-20T03:00:00'));
  });

  test('2000-0300 open on the same evening', () => {
    const s = status({ dutyTime1s: '2000', dutyTime1c: '0300' }, '2026-10-19T23:00:00');
    expect(s.state).toBe('open');
    expect(s.closesAt).toEqual(kst('2026-10-20T03:00:00'));
  });

  test('holiday uses code 8, missing code 8 is unknown', () => {
    const s = status({ dutyTime5s: '0900', dutyTime5c: '1800' }, '2026-12-25T10:00:00');
    expect(s.state).toBe('unknown');
    expect(s.basis).toBe('holiday');
  });

  test('holiday with code 8 open', () => {
    const s = status({ dutyTime5s: '0900', dutyTime5c: '1800', dutyTime8s: '1000', dutyTime8c: '1400' }, '2026-12-25T12:00:00');
    expect(s.state).toBe('open');
    expect(s.closesAt).toEqual(kst('2026-12-25T14:00:00'));
  });

  test('spillover from previous weekday into holiday', () => {
    // 12-24(목) 2000-0300, 12-25(금, 공휴일) 01:00, 코드 8 없음
    const s = status({ dutyTime4s: '2000', dutyTime4c: '0300' }, '2026-12-25T01:00:00');
    expect(s.state).toBe('open');
    expect(s.closesAt).toEqual(kst('2026-12-25T03:00:00'));
  });

  test('spillover from previous holiday into weekday', () => {
    // 2027-02-09(화, 대체공휴일) 코드 8 2000-0300, 02-10(수) 01:00
    const s = status({ dutyTime8s: '2000', dutyTime8c: '0300' }, '2027-02-10T01:00:00');
    expect(s.state).toBe('open');
  });

  test('previous day weekday hours do not apply when previous day was a holiday', () => {
    // 02-09(화)는 공휴일이므로 화요일 2000-0300은 쓰지 않는다
    const s = status({ dutyTime2s: '2000', dutyTime2c: '0300', dutyTime3s: '0900', dutyTime3c: '1800' }, '2027-02-10T01:00:00');
    expect(s.state).toBe('closed');
    expect(s.opensAt).toEqual(kst('2027-02-10T09:00:00'));
  });

  test('24h open at any minute', () => {
    const s = status({ dutyTime1s: '0000', dutyTime1c: '2400' }, '2026-10-19T23:59:00');
    expect(s.state).toBe('open');
    expect(s.closesAt).toEqual(kst('2026-10-20T00:00:00'));
  });

  test('spillover after previous close but today unknown is unknown', () => {
    const s = status({ dutyTime1s: '2000', dutyTime1c: '0300' }, '2026-10-20T04:00:00');
    expect(s.state).toBe('unknown');
  });
});

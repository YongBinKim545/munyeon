import { describe, expect, test } from 'vitest';
import { hasAnyHours, parseDayRange, parseWeeklyHours } from './hours.ts';

describe('parseDayRange', () => {
  test('plain range', () => expect(parseDayRange('0900', '1800')).toEqual({ open: 540, close: 1080 }));
  test('2500 style crosses midnight', () =>
    expect(parseDayRange('0900', '2500')).toEqual({ open: 540, close: 1500 }));
  test('close < open crosses midnight', () =>
    expect(parseDayRange('2000', '0300')).toEqual({ open: 1200, close: 1620 }));
  test('24h', () => expect(parseDayRange('0000', '2400')).toEqual({ open: 0, close: 1440 }));
  test('2359 treated as end of day', () => expect(parseDayRange('0000', '2359')).toEqual({ open: 0, close: 1440 }));
  test('missing start or close is unknown', () => {
    expect(parseDayRange(undefined, '1800')).toBeNull();
    expect(parseDayRange('0900', '')).toBeNull();
  });
  test('malformed is unknown', () => {
    expect(parseDayRange('9시', '1800')).toBeNull();
    expect(parseDayRange('0960', '1800')).toBeNull();
    expect(parseDayRange('2400', '0300')).toBeNull();
    expect(parseDayRange('0900', '4900')).toBeNull();
  });
  test('open == close is unknown', () => expect(parseDayRange('0900', '0900')).toBeNull());
  test('trims whitespace', () => expect(parseDayRange(' 0900', '1800 ')).toEqual({ open: 540, close: 1080 }));
});

describe('parseWeeklyHours', () => {
  test('missing day stays null, not closed', () => {
    const h = parseWeeklyHours({ dutyTime1s: '0900', dutyTime1c: '1800' });
    expect(h[1]).toEqual({ open: 540, close: 1080 });
    expect(h[7]).toBeNull();
    expect(h[8]).toBeNull();
  });
  test('holiday code 8 parsed', () => {
    const h = parseWeeklyHours({ dutyTime8s: '1000', dutyTime8c: '1400' });
    expect(h[8]).toEqual({ open: 600, close: 840 });
  });
  test('hasAnyHours', () => {
    expect(hasAnyHours(parseWeeklyHours({}))).toBe(false);
    expect(hasAnyHours(parseWeeklyHours({ dutyTime8s: '1000', dutyTime8c: '1400' }))).toBe(true);
  });
});

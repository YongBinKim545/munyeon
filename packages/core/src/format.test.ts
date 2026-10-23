import { describe, expect, test } from 'vitest';
import { toTelHref } from './phone.ts';
import { formatRange } from './schedule-format.ts';

describe('toTelHref', () => {
  test('hyphenated', () => expect(toTelHref('02-123-4567')).toBe('tel:021234567'));
  test('050 virtual', () => expect(toTelHref('050-71372-3330')).toBe('tel:050713723330'));
  test('representative number', () => expect(toTelHref('1544-1234')).toBe('tel:15441234'));
  test('range suffix uses first number', () => expect(toTelHref('031-123-4567~8')).toBe('tel:0311234567'));
  test('multiple numbers', () => expect(toTelHref('02-123-4567, 02-123-4568')).toBe('tel:021234567'));
  test('invalid', () => {
    expect(toTelHref('없음')).toBeNull();
    expect(toTelHref('')).toBeNull();
    expect(toTelHref('123')).toBeNull();
  });
});

describe('formatRange', () => {
  test('same day', () => expect(formatRange({ open: 540, close: 1080 })).toBe('09:00~18:00'));
  test('overnight', () => expect(formatRange({ open: 1200, close: 1620 })).toBe('20:00~익일 03:00'));
  test('2500 style shown as next day', () => expect(formatRange({ open: 540, close: 1500 })).toBe('09:00~익일 01:00'));
  test('ends at midnight', () => expect(formatRange({ open: 540, close: 1440 })).toBe('09:00~24:00'));
  test('24h', () => expect(formatRange({ open: 0, close: 1440 })).toBe('24시간'));
  test('unknown', () => expect(formatRange(null)).toBe('정보 없음'));
});

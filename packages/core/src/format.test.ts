import { describe, expect, test } from 'vitest';
import { toTelHref } from './phone.ts';
import { parseRegion } from './region.ts';
import { formatRange } from './schedule-format.ts';

describe('parseRegion', () => {
  test('metropolitan city gu', () =>
    expect(parseRegion('서울특별시 강남구 테헤란로 1')).toEqual({ sido: '서울특별시', sigungu: '강남구' }));
  test('si + gu combined', () =>
    expect(parseRegion('경기도 수원시 영통구 광교로 1')).toEqual({ sido: '경기도', sigungu: '수원시 영통구' }));
  test('gun', () => expect(parseRegion('경기도 가평군 가평읍 1')).toEqual({ sido: '경기도', sigungu: '가평군' }));
  test('si without gu', () => expect(parseRegion('경기도 파주시 금촌로 1')).toEqual({ sido: '경기도', sigungu: '파주시' }));
  test('sejong has no sigungu', () =>
    expect(parseRegion('세종특별자치시 한누리대로 1')).toEqual({ sido: '세종특별자치시', sigungu: '세종특별자치시' }));
  test('extra spaces', () =>
    expect(parseRegion('  부산광역시   해운대구  센텀로 1')).toEqual({ sido: '부산광역시', sigungu: '해운대구' }));
  test('empty or unknown sido', () => {
    expect(parseRegion('')).toBeNull();
    expect(parseRegion('강남구 테헤란로')).toBeNull();
  });
});

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

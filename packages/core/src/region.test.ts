import { describe, expect, test } from 'vitest';
import { CURRENT_SIDO, normalizeSido, parseRegion, regionShortName, sidoShort } from './region.ts';

const JG = '전남광주통합특별시';

describe('normalizeSido', () => {
  test('current names stay', () => {
    expect(normalizeSido('서울특별시')).toBe('서울특별시');
    expect(normalizeSido(JG)).toBe(JG);
  });
  test('Gwangju·Jeonnam old names become the merged sido (2026-07-01)', () => {
    expect(normalizeSido('광주광역시')).toBe(JG);
    expect(normalizeSido('전라남도')).toBe(JG);
  });
  test('other old names', () => {
    expect(normalizeSido('강원도')).toBe('강원특별자치도');
    expect(normalizeSido('전라북도')).toBe('전북특별자치도');
  });
  test('short forms used in some pharmacy addresses', () => {
    expect(normalizeSido('서울')).toBe('서울특별시');
    expect(normalizeSido('경기')).toBe('경기도');
    expect(normalizeSido('광주')).toBe(JG);
    expect(normalizeSido('전남')).toBe(JG);
    expect(normalizeSido('세종')).toBe('세종특별자치시');
  });
  test('unknown is null', () => {
    expect(normalizeSido('없는도')).toBeNull();
    expect(normalizeSido('')).toBeNull();
    expect(normalizeSido(null)).toBeNull();
  });
});

describe('parseRegion', () => {
  test('merged sido address', () => {
    expect(parseRegion(`${JG} 고흥군 고흥읍 터미널길 16`)).toEqual({ sido: JG, sigungu: '고흥군' });
    expect(parseRegion(`${JG} 광산구 하남대로 1`)).toEqual({ sido: JG, sigungu: '광산구' });
  });
  test('old names of the merged area', () => {
    expect(parseRegion('광주광역시 북구 무등로 1')).toEqual({ sido: JG, sigungu: '북구' });
    expect(parseRegion('전라남도 순천시 중앙로 1')).toEqual({ sido: JG, sigungu: '순천시' });
  });
  test('short form sido', () => {
    expect(parseRegion('서울 성동구 독서당로 278 1층  (금호동4가)')).toEqual({ sido: '서울특별시', sigungu: '성동구' });
    expect(parseRegion('경기 수원시 팔달구 중부대로 104')).toEqual({ sido: '경기도', sigungu: '수원시 팔달구' });
    expect(parseRegion('세종 한누리대로 1')).toEqual({ sido: '세종특별자치시', sigungu: '세종특별자치시' });
  });
  test('missing sigungu is null', () => expect(parseRegion('경기도 금빛로 27')).toBeNull());
});

describe('short names (P0-2)', () => {
  test('sido short', () => {
    expect(sidoShort('서울특별시')).toBe('서울');
    expect(sidoShort('강원특별자치도')).toBe('강원');
    expect(sidoShort('제주특별자치도')).toBe('제주');
  });
  test('merged sido: old Gwangju gu is 광주, the rest 전남, sido level both', () => {
    expect(sidoShort(JG, '동구')).toBe('광주');
    expect(sidoShort(JG, '광산구')).toBe('광주');
    expect(sidoShort(JG, '화순군')).toBe('전남');
    expect(sidoShort(JG)).toBe('광주·전남');
  });
  test('region short name', () => {
    expect(regionShortName('서울특별시', '마포구')).toBe('서울 마포구');
    expect(regionShortName(JG, '동구')).toBe('광주 동구');
    expect(regionShortName(JG, '여수시')).toBe('전남 여수시');
    expect(regionShortName('세종특별자치시', '세종특별자치시')).toBe('세종');
  });
});

test('CURRENT_SIDO: 16 current names, no old names', () => {
  expect(CURRENT_SIDO).toHaveLength(16);
  expect(CURRENT_SIDO).toContain(JG);
  for (const old of ['광주광역시', '전라남도', '강원도', '전라북도']) expect(CURRENT_SIDO).not.toContain(old);
});

describe('parseRegion basics', () => {
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

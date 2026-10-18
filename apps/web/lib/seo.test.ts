import { describe, expect, test } from 'vitest';
import { institutionPath, parseRegionParams, regionPath, safeDecode } from './seo';

describe('paths', () => {
  test('institution path', () => expect(institutionPath('pharmacy', 'C1100001')).toBe('/pharmacy/C1100001'));

  test('region path encodes Korean segments', () => {
    expect(regionPath('서울특별시')).toBe(`/${encodeURIComponent('서울특별시')}`);
    expect(regionPath('경기도', '수원시 영통구', 'pharmacy', 'sunday')).toBe(
      `/${encodeURIComponent('경기도')}/${encodeURIComponent('수원시 영통구')}/${encodeURIComponent('약국')}/${encodeURIComponent('일요일')}`,
    );
  });

  test('region path round-trip from encoded or decoded params', () => {
    const encoded = regionPath('경기도', '수원시 영통구', 'hospital', 'holiday').split('/').slice(1);
    const [sido, sigungu, kind, situation] = encoded;
    expect(parseRegionParams({ sido: sido!, sigungu, kind, situation })).toEqual({
      sido: '경기도', sigungu: '수원시 영통구', kind: 'hospital', situation: 'holiday',
    });
    expect(parseRegionParams({ sido: '경기도', sigungu: '수원시 영통구', kind: '병원', situation: '공휴일' })).toEqual({
      sido: '경기도', sigungu: '수원시 영통구', kind: 'hospital', situation: 'holiday',
    });
  });

  test('invalid region params are null', () => {
    expect(parseRegionParams({ sido: '없는도' })).toBeNull();
    expect(parseRegionParams({ sido: '서울특별시', sigungu: '강남구', kind: '한의원' })).toBeNull();
    expect(parseRegionParams({ sido: '서울특별시', sigungu: '강남구', kind: '약국', situation: '새벽' })).toBeNull();
    expect(parseRegionParams({ sido: '서울특별시', sigungu: '' })).toBeNull();
    expect(parseRegionParams({ sido: '%E0%A4%A' })).toBeNull();
  });

  test('safeDecode is idempotent and tolerant', () => {
    expect(safeDecode('%EA%B0%95%EB%82%A8%EA%B5%AC')).toBe('강남구');
    expect(safeDecode('강남구')).toBe('강남구');
    expect(safeDecode('%E0%A4%A')).toBeNull();
  });
});

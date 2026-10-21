import { describe, expect, test } from 'vitest';
import { institutionPath, parseRegionParams, regionPath, safeDecode, siteUrl } from './seo';

describe('siteUrl', () => {
  test('explicit site url wins, trailing slash removed', () =>
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://findmedi.co.kr/', VERCEL_URL: 'x.vercel.app' })).toBe('https://findmedi.co.kr'));

  test('vercel production without a setting uses the official domain', () =>
    expect(siteUrl({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'app.vercel.app', VERCEL_URL: 'app-abc.vercel.app' })).toBe(
      'https://findmedi.co.kr',
    ));

  test('vercel preview uses the branch host, then the deployment host', () => {
    expect(siteUrl({ VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'app-git-x.vercel.app', VERCEL_URL: 'app-abc.vercel.app' })).toBe(
      'https://app-git-x.vercel.app',
    );
    expect(siteUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'app-abc.vercel.app' })).toBe('https://app-abc.vercel.app');
  });

  test('no settings: the official domain (D44)', () => expect(siteUrl({})).toBe('https://findmedi.co.kr'));
});

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

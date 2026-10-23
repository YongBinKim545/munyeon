import { describe, expect, test } from 'vitest';
import { institutionPath, parseRegionParams, regionPath, safeDecode, sidoTitle, siteUrl } from './seo';

test('sidoTitle names the merged sido with its common name (P0-1)', () => {
  expect(sidoTitle('전남광주통합특별시')).toBe('전남광주통합특별시(광주·전남)');
  expect(sidoTitle('서울특별시')).toBe('서울특별시');
});

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

  test('region path (D69): sido, region screen (pharmacy), region screen /병원', () => {
    const e = encodeURIComponent;
    expect(regionPath('서울특별시')).toBe(`/${e('서울특별시')}`);
    expect(regionPath('경기도', '수원시 영통구')).toBe(`/${e('경기도')}/${e('수원시 영통구')}`);
    expect(regionPath('경기도', '수원시 영통구', 'pharmacy')).toBe(`/${e('경기도')}/${e('수원시 영통구')}`);
    expect(regionPath('경기도', '수원시 영통구', 'hospital')).toBe(`/${e('경기도')}/${e('수원시 영통구')}/${e('병원')}`);
  });

  test('region path round-trip from encoded or decoded params', () => {
    const [sido, sigungu, kind] = regionPath('경기도', '수원시 영통구', 'hospital').split('/').slice(1);
    expect(parseRegionParams({ sido: sido!, sigungu, kind })).toEqual({ sido: '경기도', sigungu: '수원시 영통구', kind: 'hospital' });
    expect(parseRegionParams({ sido: '경기도', sigungu: '수원시 영통구', kind: '병원' })).toEqual({ sido: '경기도', sigungu: '수원시 영통구', kind: 'hospital' });
  });

  test('invalid region params are null', () => {
    expect(parseRegionParams({ sido: '없는도' })).toBeNull();
    expect(parseRegionParams({ sido: '서울특별시', sigungu: '강남구', kind: '한의원' })).toBeNull();
    expect(parseRegionParams({ sido: '서울특별시', sigungu: '강남구', kind: '약국' })).toBeNull(); // 약국은 시군구 주소(301)
    expect(parseRegionParams({ sido: '서울특별시', sigungu: '' })).toBeNull();
    expect(parseRegionParams({ sido: '%E0%A4%A' })).toBeNull();
    // 옛 시도 이름은 페이지가 아니라 301(next.config, P0-1)
    expect(parseRegionParams({ sido: '광주광역시' })).toBeNull();
    expect(parseRegionParams({ sido: '전라남도', sigungu: '여수시' })).toBeNull();
    expect(parseRegionParams({ sido: '전남광주통합특별시', sigungu: '동구' })).toEqual({ sido: '전남광주통합특별시', sigungu: '동구' });
  });

  test('safeDecode is idempotent and tolerant', () => {
    expect(safeDecode('%EA%B0%95%EB%82%A8%EA%B5%AC')).toBe('강남구');
    expect(safeDecode('강남구')).toBe('강남구');
    expect(safeDecode('%E0%A4%A')).toBeNull();
  });
});

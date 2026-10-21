import { describe, expect, test } from 'vitest';
import { buildIndex, buildUrlset, landingUrls, sitemapFileCount, toKstIso } from './sitemap';

describe('sitemap xml', () => {
  test('toKstIso uses +09:00', () => expect(toKstIso(new Date('2026-11-20T05:07:00Z'))).toBe('2026-11-20T14:07:00+09:00'));

  test('buildUrlset escapes and keeps encoded Korean paths', () => {
    const xml = buildUrlset([
      { loc: 'https://example.com/pharmacy/C1', lastmod: new Date('2026-11-01T00:00:00Z') },
      { loc: `https://example.com${encodeURI('/서울특별시/강남구')}?a=1&b=2` },
    ]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://example.com/pharmacy/C1</loc><lastmod>2026-11-01T09:00:00+09:00</lastmod>');
    expect(xml).toContain('%EC%84%9C%EC%9A%B8');
    expect(xml).toContain('a=1&amp;b=2');
    expect(xml).not.toMatch(/[가-힣]/);
  });

  test('buildIndex lists files', () => {
    const xml = buildIndex(['https://example.com/sitemaps/0.xml', 'https://example.com/sitemaps/1.xml'], new Date('2026-11-01T00:00:00Z'));
    expect(xml).toContain('<sitemapindex');
    expect((xml.match(/<sitemap>/g) ?? []).length).toBe(2);
  });

  test('file count = region file + ceil(institutions / 10000)', () => {
    expect(sitemapFileCount(0)).toBe(1);
    expect(sitemapFileCount(10000)).toBe(2);
    expect(sitemapFileCount(10001)).toBe(3);
  });
});

describe('landingUrls', () => {
  test('includes sido, hub and only indexable landings', () => {
    const urls = landingUrls([
      { sido: '서울특별시', sigungu: '중구', kind: 'pharmacy', all: 4, sunday: 3, holiday: 2, night: 0 },
      { sido: '서울특별시', sigungu: '중구', kind: 'hospital', all: 1, sunday: 0, holiday: 0, night: 0 },
    ]).map(decodeURI);
    expect(urls).toEqual([
      '/서울특별시',
      '/서울특별시/중구',
      '/서울특별시/중구/약국/전체',
      '/서울특별시/중구/약국/일요일',
    ]);
  });
});

import { describe, expect, test } from 'vitest';
import { classifySource, TRAFFIC_SOURCES } from './source.ts';

const HOST = 'findmedi.co.kr';
const CHROME = 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36';
const KAKAO = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) KAKAOTALK 11.0.0';
const c = (search: string, referrer = '', ua = CHROME) => classifySource({ search, referrer, ua, host: HOST });

describe('classifySource (P0-11, D72)', () => {
  test('ref=share is share, ahead of every other tag', () => {
    expect(c('?ref=share')).toBe('share');
    expect(c('?utm_medium=cpc&ref=share', 'https://www.google.com/')).toBe('share');
  });

  test('utm_medium decides ad / community / other', () => {
    for (const m of ['cpc', 'ad', 'paid', 'CPC']) expect(c(`?utm_source=x&utm_medium=${m}`)).toBe('ad');
    for (const m of ['blog', 'community', 'cafe', 'social']) expect(c(`?utm_source=naver_blog&utm_medium=${m}`)).toBe('community');
    expect(c('?utm_source=yna&utm_medium=press')).toBe('other');
    expect(c('?utm_source=x')).toBe('other');
  });

  test('a tag wins over the referrer and the KakaoTalk browser', () => {
    expect(c('?utm_medium=blog', 'https://search.naver.com/search.naver?query=x')).toBe('community');
    expect(c('?utm_medium=cpc', '', KAKAO)).toBe('ad');
  });

  test('search engines by referrer host', () => {
    for (const r of [
      'https://www.google.com/',
      'https://www.google.co.kr/',
      'https://search.naver.com/search.naver?query=%EC%95%BD%EA%B5%AD',
      'https://m.search.naver.com/search.naver?query=x',
      'https://search.daum.net/search?q=x',
      'https://m.search.daum.net/search?q=x',
      'https://www.bing.com/',
      'https://search.zum.com/search.zum?query=x',
      'https://duckduckgo.com/',
    ]) {
      expect(c('', r)).toBe('search');
    }
  });

  test('blogs, cafes and communities by referrer host', () => {
    for (const r of [
      'https://blog.naver.com/abc/123',
      'https://m.cafe.naver.com/ca-fe/web/cafes/1',
      'https://cafe.daum.net/x',
      'https://abc.tistory.com/1',
      'https://gall.dcinside.com/board',
      'https://theqoo.net/1',
      'https://www.clien.net/service',
      'https://www.fmkorea.com/1',
      'https://www.instagram.com/',
      'https://band.us/band/1',
    ]) {
      expect(c('', r)).toBe('community');
    }
  });

  test('other sites are other, our own site is direct', () => {
    expect(c('', 'https://news.example.com/a')).toBe('other');
    expect(c('', 'https://findmedi.co.kr/about')).toBe('direct');
    expect(c('', 'not a url')).toBe('direct');
  });

  test('no tag and no referrer: KakaoTalk browser is share, otherwise direct', () => {
    expect(c('', '', KAKAO)).toBe('share');
    expect(c('')).toBe('direct');
    expect(c('?날짜=2026-12-25')).toBe('direct');
  });

  test('a search engine referrer inside KakaoTalk is still search', () => {
    expect(c('', 'https://m.search.daum.net/search?q=x', KAKAO)).toBe('search');
  });

  test('always one of the six values', () => {
    expect(TRAFFIC_SOURCES).toEqual(['search', 'share', 'direct', 'community', 'ad', 'other']);
  });
});

// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { currentSource, rememberSource } from './source';

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, '', '/');
});

test('the landing page decides once and later pages keep it', () => {
  history.replaceState(null, '', '/서울특별시/마포구?ref=share');
  rememberSource();
  history.replaceState(null, '', '/pharmacy/C1100005');
  rememberSource();
  expect(currentSource()).toBe('share');
});

test('stores only the category, not the address', () => {
  history.replaceState(null, '', '/?utm_source=naver_blog&utm_medium=blog');
  rememberSource();
  expect(sessionStorage.getItem('munyeon:source')).toBe('community');
});

test('without a remembered value it decides on the spot', () => {
  expect(currentSource()).toBe('direct');
});

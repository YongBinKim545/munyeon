// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FeedbackFooter } from './FeedbackFooter';
import { Header } from './Header';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
afterEach(cleanup);

describe('Header (D44·D49)', () => {
  test('brand logo links to main, with a white version for dark mode, and the tagline under it', () => {
    render(<Header />);
    const link = screen.getByRole('link', { name: '찾아줘 메디 메인' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.querySelector('img')!.getAttribute('src')).toBe('/logo.svg');
    expect(link.querySelector('source')!.getAttribute('srcset')).toBe('/logo-white.svg');
    expect(screen.getByText('지금 문 연 병원·약국을 찾아드려요')).toBeTruthy();
  });

  test('the top-right button is name search on every page (D69)', () => {
    for (const p of ['/', '/pharmacy/C1', '/about']) {
      pathname = p;
      render(<Header />);
      expect(screen.getByRole('link', { name: /검색/ }).getAttribute('href')).toBe('/search');
      expect(screen.queryByRole('button', { name: /개선의견/ })).toBeNull();
      cleanup();
    }
  });
});

describe('FeedbackFooter (D69)', () => {
  test('개선의견 sits at the bottom and opens the opinion dialog', async () => {
    pathname = '/about';
    render(<FeedbackFooter />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /개선의견/ }));
    });
    expect(screen.getByRole('dialog', { name: '개선의견' })).toBeTruthy();
  });
});

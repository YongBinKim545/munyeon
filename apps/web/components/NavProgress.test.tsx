// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- 라우터 없이 링크 클릭만 흉내 낸다 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NavProgress, SHOW_AFTER_MS, SLOW_AFTER_MS } from './NavProgress';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

// 실제 이동은 막아 두고(라우터 대신) 링크 클릭만 일어나게 한다
const page = () => (
  <>
    <NavProgress />
    <a href="/hospital/A1" onClick={(e) => e.preventDefault()}>
      상세
    </a>
    <a href="tel:0212345678" onClick={(e) => e.preventDefault()}>
      전화
    </a>
    <a href="/#top" onClick={(e) => e.preventDefault()}>
      위로
    </a>
  </>
);

beforeEach(() => {
  vi.useFakeTimers();
  pathname = '/';
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('NavProgress (D50)', () => {
  test('nothing within 1 second, then a loading message, then a retry after 10 seconds', () => {
    render(page());
    fireEvent.click(screen.getByText('상세'));
    act(() => void vi.advanceTimersByTime(SHOW_AFTER_MS - 1));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByRole('status').textContent).toContain('불러오는 중이에요');
    act(() => void vi.advanceTimersByTime(SLOW_AFTER_MS - SHOW_AFTER_MS));
    expect(screen.getByRole('status').textContent).toContain('응답이 늦어요');
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  test('disappears once the page changes, and does not come back on returning', () => {
    const { rerender } = render(page());
    fireEvent.click(screen.getByText('상세'));
    act(() => void vi.advanceTimersByTime(SHOW_AFTER_MS));
    expect(screen.getByRole('status')).toBeTruthy();
    pathname = '/hospital/A1';
    window.history.replaceState(null, '', '/hospital/A1');
    rerender(page());
    expect(screen.queryByRole('status')).toBeNull();
    pathname = '/';
    window.history.replaceState(null, '', '/');
    rerender(page());
    act(() => void vi.advanceTimersByTime(SLOW_AFTER_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('a fast navigation never shows it', () => {
    const { rerender } = render(page());
    fireEvent.click(screen.getByText('상세'));
    act(() => void vi.advanceTimersByTime(300));
    pathname = '/hospital/A1';
    window.history.replaceState(null, '', '/hospital/A1');
    rerender(page());
    act(() => void vi.advanceTimersByTime(SLOW_AFTER_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('phone links and same-page links are ignored', () => {
    render(page());
    fireEvent.click(screen.getByText('전화'));
    fireEvent.click(screen.getByText('위로'));
    act(() => void vi.advanceTimersByTime(SLOW_AFTER_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

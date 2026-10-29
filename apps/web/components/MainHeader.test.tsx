// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MainHeader, nextHeaderState } from './MainHeader';

afterEach(cleanup);

const props = (over = {}) => ({
  areaLabel: '마포구 망원동',
  pcLocationNote: false,
  filter: 'pharmacy' as const,
  onFilter: vi.fn(),
  onCurrentLocation: vi.fn(),
  ...over,
});

describe('MainHeader', () => {
  test('second row is the filter bar (D78); no when select; names are for screen readers', () => {
    render(<MainHeader {...props()} />);
    expect(screen.getByRole('group', { name: '유형' })).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull(); // 약국은 진료과가 없다
    expect(screen.queryByText('유형')).toBeNull();
    expect(screen.queryByRole('link', { name: '검색' })).toBeNull(); // 사이트 헤더로 옮김(D69)
  });

  test('area name is text; the find-location menu has current location / browse by region (D70)', () => {
    render(<MainHeader {...props()} />);
    expect(screen.getByText('마포구 망원동').closest('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /위치 찾기/ }));
    const items = screen.getByRole('list', { name: '위치 찾기' }).querySelectorAll('li');
    expect([...items].map((b) => b.textContent?.trim())).toEqual(['현재 위치', '지역별 보기']);
    expect(screen.getByRole('link', { name: /지역별 보기/ }).getAttribute('href')).toBe('/regions');
  });

  test('menu actions close the menu', () => {
    const p = props();
    render(<MainHeader {...p} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: /위치 찾기/ }));
    open();
    fireEvent.click(screen.getByRole('button', { name: /현재 위치/ }));
    expect(p.onCurrentLocation).toHaveBeenCalled();
  });

  test('Escape closes the menu and returns focus to the button', () => {
    render(<MainHeader {...props()} />);
    const btn = screen.getByRole('button', { name: /위치 찾기/ });
    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('list', { name: '위치 찾기' })).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  test('department change', () => {
    const p = props({ filter: 'hospital' as const });
    render(<MainHeader {...p} />);
    fireEvent.change(screen.getByRole('combobox', { name: '진료과' }), { target: { value: 'pediatric' } });
    expect(p.onFilter).toHaveBeenCalledWith('pediatric');
  });

  test('locating placeholder, no permission warning line', () => {
    render(<MainHeader {...props({ areaLabel: null })} />);
    expect(screen.getByText('위치 찾는 중…')).toBeTruthy();
    expect(screen.queryByText(/위치 권한이 꺼져 있어요/)).toBeNull();
  });
});

describe('nextHeaderState (D52)', () => {
  const run = (ys: number[]) => ys.reduce((s, y) => nextHeaderState(s, y), { hidden: false, base: 0 }).hidden;
  test('hides after scrolling down past the threshold, shows again after scrolling up', () => {
    expect(run([100, 200])).toBe(true);
    expect(run([100, 200, 400, 395])).toBe(true); // 5px 위로: 아직 기준 안
    expect(run([100, 200, 400, 380])).toBe(false); // 20px 위로
  });
  test('small jitters do not toggle it', () => {
    expect(run([500, 600, 595, 600, 596])).toBe(true);
    expect(run([500, 600, 580, 585, 581])).toBe(false);
  });
  test('always shown near the top', () => {
    expect(run([500, 900, 60])).toBe(false);
  });
});

test('hidden header is inert, but never while the menu is open', () => {
  render(<MainHeader {...props()} />);
  const header = document.querySelector('.main-header') as HTMLElement;
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  const scrollTo = (y: number) => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    fireEvent.scroll(window);
  };
  vi.useFakeTimers();
  try {
    act(() => {
      scrollTo(200);
      vi.runAllTimers();
      scrollTo(400);
      vi.runAllTimers();
    });
    expect(header.className).toContain('main-header--hidden');
    expect(header.hasAttribute('inert')).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

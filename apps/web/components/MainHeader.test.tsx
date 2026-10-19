// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MainHeader } from './MainHeader';

afterEach(cleanup);

const props = (over = {}) => ({
  areaLabel: '마포구 망원동',
  pcLocationNote: false,
  kind: 'pharmacy' as const,
  mode: 'open' as const,
  onKind: vi.fn(),
  onMode: vi.fn(),
  onCurrentLocation: vi.fn(),
  onOpenLocationSearch: vi.fn(),
  ...over,
});

describe('MainHeader', () => {
  test('selects show values only; type and status names are for screen readers', () => {
    render(<MainHeader {...props()} />);
    expect(screen.getByRole('combobox', { name: '유형' })).toHaveProperty('value', 'pharmacy');
    expect(screen.getByRole('combobox', { name: '상태' })).toHaveProperty('value', 'open');
    expect(screen.queryByText('유형')).toBeNull();
    expect(screen.queryByText('상태')).toBeNull();
    expect(screen.getByRole('link', { name: '검색' }).getAttribute('href')).toBe('/search');
  });

  test('area name is text; the find-location button opens current location / location search', () => {
    render(<MainHeader {...props()} />);
    expect(screen.getByText('마포구 망원동').closest('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /위치 찾기/ }));
    const items = screen.getByRole('list', { name: '위치 찾기' }).querySelectorAll('button');
    expect([...items].map((b) => b.textContent?.trim())).toEqual(['현재 위치', '위치 검색']);
  });

  test('menu actions close the menu', () => {
    const p = props();
    render(<MainHeader {...p} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: /위치 찾기/ }));
    open();
    fireEvent.click(screen.getByRole('button', { name: /위치 검색/ }));
    expect(p.onOpenLocationSearch).toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: '위치 찾기' })).toBeNull();
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

  test('kind and mode changes', () => {
    const p = props();
    render(<MainHeader {...p} />);
    fireEvent.change(screen.getByRole('combobox', { name: '유형' }), { target: { value: 'hospital' } });
    expect(p.onKind).toHaveBeenCalledWith('hospital');
    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'all' } });
    expect(p.onMode).toHaveBeenCalledWith('all');
  });

  test('locating placeholder, no permission warning line', () => {
    render(<MainHeader {...props({ areaLabel: null })} />);
    expect(screen.getByText('위치 찾는 중…')).toBeTruthy();
    expect(screen.queryByText(/위치 권한이 꺼져 있어요/)).toBeNull();
  });
});

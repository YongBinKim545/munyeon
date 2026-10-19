// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MainHeader } from './MainHeader';

afterEach(cleanup);

const props = (over = {}) => ({
  areaLabel: '마포구 망원동',
  pcLocationNote: false,
  locateDenied: false,
  recent: [{ label: '중구 명동', lat: 37.56, lon: 126.98 }, { label: '강남구 역삼동', lat: 37.5, lon: 127.03 }],
  kind: 'pharmacy' as const,
  mode: 'open' as const,
  onKind: vi.fn(),
  onMode: vi.fn(),
  onPickArea: vi.fn(),
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

  test('area menu order: location search, current location, recent areas', () => {
    render(<MainHeader {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /마포구 망원동/ }));
    const items = screen.getByRole('list', { name: '지역 선택' }).querySelectorAll('button');
    expect([...items].map((b) => b.textContent)).toEqual(['위치 검색', '현재 위치', '중구 명동', '강남구 역삼동']);
  });

  test('menu actions', () => {
    const p = props();
    render(<MainHeader {...p} />);
    const open = () => fireEvent.click(screen.getByRole('button', { name: /마포구 망원동/ }));
    open();
    fireEvent.click(screen.getByRole('button', { name: '위치 검색' }));
    expect(p.onOpenLocationSearch).toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: '지역 선택' })).toBeNull();
    open();
    fireEvent.click(screen.getByRole('button', { name: '현재 위치' }));
    expect(p.onCurrentLocation).toHaveBeenCalled();
    open();
    fireEvent.click(screen.getByRole('button', { name: '강남구 역삼동' }));
    expect(p.onPickArea).toHaveBeenCalledWith(p.recent[1]);
  });

  test('kind and mode changes', () => {
    const p = props();
    render(<MainHeader {...p} />);
    fireEvent.change(screen.getByRole('combobox', { name: '유형' }), { target: { value: 'hospital' } });
    expect(p.onKind).toHaveBeenCalledWith('hospital');
    fireEvent.change(screen.getByRole('combobox', { name: '상태' }), { target: { value: 'all' } });
    expect(p.onMode).toHaveBeenCalledWith('all');
  });

  test('locating and denied notes', () => {
    render(<MainHeader {...props({ areaLabel: null, locateDenied: true })} />);
    expect(screen.getByText('위치 찾는 중…')).toBeTruthy();
    expect(screen.getByText(/위치 권한이 꺼져 있어요/)).toBeTruthy();
  });
});

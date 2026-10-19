// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';
import { encodeGrid, type GridPayload } from '@/lib/grid';
import { MainScreen } from './MainScreen';

const center = { lat: 37.5637, lon: 126.9838 };
const near = (km: number) => ({ lat: center.lat + km / 111.32, lon: center.lon });
const OPEN = { dutyTime1s: '0900', dutyTime1c: '2300' };
const SOON = { dutyTime1s: '2100', dutyTime1c: '2300' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T20:00:00+09:00')); // 월요일 20시
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ holidays: [], lastSync: { hospital: null, pharmacy: null } }))) as typeof fetch;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: center.lat, longitude: center.lon } } as GeolocationPosition) },
  });
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 1km 칸(f 접두)과 5km 칸을 따로 응답하는 가짜 서버. 5km 응답은 release()를 부를 때까지 기다린다. */
function server(fine: ReturnType<typeof makeRecord>[], coarse: ReturnType<typeof makeRecord>[]) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const urls: string[] = [];
  const fetchJson = async (url: string): Promise<GridPayload> => {
    urls.push(url);
    if (url.split('/').pop()!.startsWith('f')) return encodeGrid(fine);
    await gate;
    return encodeGrid(coarse);
  };
  return { fetchJson, release, urls };
}

const ids = () => [...document.querySelectorAll('[data-id]')].map((el) => el.getAttribute('data-id'));
const flush = () => act(async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
});

describe('MainScreen', () => {
  test('server HTML has no list and no live status', () => {
    const html = renderToString(<MainScreen />);
    expect(html).not.toMatch(/영업 중 ·|곧 영업|곧 마감|전화 확인 필요|영업 종료/);
    expect(html).toContain('가까운 곳을 찾고 있어요');
  });

  test('starts at current location with remembered kind and status always open-only', async () => {
    localStorage.setItem('munyeon:kind', 'hospital');
    const s = server([makeRecord({ id: 'A', kind: 'hospital', category: 'general', hours: OPEN, ...near(0.2) })], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(screen.getByRole('combobox', { name: '유형' })).toHaveProperty('value', 'hospital');
    expect(screen.getByRole('combobox', { name: '상태' })).toHaveProperty('value', 'open');
    expect(s.urls[0]).toMatch(/^\/api\/grid\/hospital\/f\d+_\d+$/);
    expect(ids()).toEqual(['A']);
    expect(screen.getByRole('button', { name: /중구 태평로1가/ })).toBeTruthy();
  });

  test('a manual area pick is not overridden by a pending location result', async () => {
    let resolveGeo!: (p: GeolocationPosition) => void;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => { resolveGeo = ok; } },
    });
    localStorage.setItem('munyeon:areas', JSON.stringify([{ label: '마포구 망원동', lat: 37.556, lon: 126.905 }]));
    const s = server([], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    fireEvent.click(screen.getByRole('button', { name: /위치 찾는 중/ }));
    fireEvent.click(screen.getByRole('button', { name: '마포구 망원동' }));
    await flush();
    await act(async () => {
      resolveGeo({ coords: { latitude: center.lat, longitude: center.lon } } as GeolocationPosition);
    });
    await flush();
    expect(screen.getByRole('button', { name: /마포구 망원동/ })).toBeTruthy();
  });

  test('late arrivals keep order and anchor', async () => {
    const s = server(
      [
        makeRecord({ id: 'A', hours: OPEN, ...near(0.3) }),
        makeRecord({ id: 'B', hours: SOON, ...near(0.5) }),
        makeRecord({ id: 'D', hours: SOON, ...near(0.8) }),
      ],
      [
        makeRecord({ id: 'A', hours: OPEN, ...near(0.3) }),
        makeRecord({ id: 'B', hours: SOON, ...near(0.5) }),
        makeRecord({ id: 'D', hours: SOON, ...near(0.8) }),
        makeRecord({ id: 'C', hours: OPEN, ...near(2) }),
      ],
    );
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(ids()).toEqual(['A', 'B', 'D']);

    // 카드 높이 100px, 사용자가 150px 내려 D(세 번째)를 보고 있다
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 150 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = ids().indexOf(this.getAttribute('data-id'));
      return { top: i * 100 - 150 } as DOMRect;
    });
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});

    s.release();
    await flush();
    // 늦게 온 영업 중 C는 곧 영업 B·D보다 앞, 보던 D는 한 칸 밀린 만큼 스크롤 보정
    expect(ids()).toEqual(['A', 'C', 'B', 'D']);
    expect(scrollBy).toHaveBeenCalledWith(0, 100);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  test('show all switches the status select to all and appends closed places', async () => {
    const s = server([], [
      makeRecord({ id: 'O', hours: OPEN, ...near(0.3) }),
      makeRecord({ id: 'X', hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, ...near(0.1) }),
      ...[1, 2, 3, 4, 5].map((i) => makeRecord({ id: `O${i}`, hours: OPEN, ...near(0.5 + i * 0.1) })),
    ]);
    s.release();
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(ids()).not.toContain('X');
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(screen.getByRole('combobox', { name: '상태' })).toHaveProperty('value', 'all');
    expect(ids().at(-1)).toBe('X');
    expect(ids()[0]).toBe('O');
  });
});

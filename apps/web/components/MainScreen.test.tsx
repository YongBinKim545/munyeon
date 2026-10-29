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
let permission: PermissionState = 'granted';
let geoCalls = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T20:00:00+09:00')); // 월요일 20시
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ holidays: [], lastSync: { hospital: null, pharmacy: null } }))) as typeof fetch;
  permission = 'granted';
  geoCalls = 0;
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: permission }) } });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback, err: PositionErrorCallback) => {
        geoCalls += 1;
        if (permission === 'denied') err({ code: 1 } as GeolocationPositionError);
        else ok({ coords: { latitude: center.lat, longitude: center.lon } } as GeolocationPosition);
      },
    },
  });
  // 모달은 history.back()으로 닫히므로, 테스트에서는 바로 popstate를 보낸다
  vi.spyOn(history, 'back').mockImplementation(() => window.dispatchEvent(new PopStateEvent('popstate')));
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  sessionStorage.clear();
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

  test('already-granted browsers start at current location with the remembered type, no status select', async () => {
    localStorage.setItem('munyeon:kind', 'hospital');
    const s = server([makeRecord({ id: 'A', kind: 'hospital', category: 'general', hours: OPEN, ...near(0.2) })], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(screen.getByRole('button', { name: '병원' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('combobox', { name: '진료과' })).toHaveProperty('value', 'hospital');
    expect(s.urls[0]).toMatch(/^\/api\/grid\/hospital\/f\d+_\d+$/);
    expect(ids()).toEqual(['A']);
    expect(screen.getByText('중구 태평로1가')).toBeTruthy();
  });

  test('without granted permission it does not ask on entry and starts at the recent area or myeongdong', async () => {
    permission = 'prompt';
    const s = server([], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(geoCalls).toBe(0);
    expect(screen.getByText('중구 명동')).toBeTruthy();
    expect(screen.queryByText(/위치 권한이 꺼져 있어요/)).toBeNull();
    cleanup();
    localStorage.setItem('munyeon:areas', JSON.stringify([{ label: '강남구 신사동', lat: 37.52, lon: 127.02 }]));
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(screen.getByText('강남구 신사동')).toBeTruthy();
  });

  test('refresh without granted permission starts at the area last seen by current location (D45)', async () => {
    permission = 'prompt';
    const s = server([makeRecord({ id: 'A', hours: OPEN, ...near(0.2) })], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(screen.getByText('중구 명동')).toBeTruthy();
    // [현재 위치]로 찾으면 그 지역 이름이 붙고, 마지막으로 보던 지역으로 저장된다
    permission = 'granted';
    fireEvent.click(screen.getByRole('button', { name: /위치 찾기/ }));
    fireEvent.click(screen.getByRole('button', { name: /현재 위치/ }));
    await flush();
    expect(screen.getByText('중구 태평로1가')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('munyeon:lastArea')!)).toMatchObject({ label: '중구 태평로1가' });
    expect(localStorage.getItem('munyeon:areas')).toBeNull();
    // 새로고침: 사파리처럼 권한이 '이번만 허용'이라 다시 묻지 않으면, 명동이 아니라 마지막으로 보던 지역
    cleanup();
    permission = 'prompt';
    geoCalls = 0;
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(geoCalls).toBe(0);
    expect(screen.getByText('중구 태평로1가')).toBeTruthy();
  });

  test('find-location menu: current location asks, denied shows the guide, guide can open location search', async () => {
    permission = 'prompt';
    const s = server([], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    const menu = () => screen.getByRole('list', { name: '위치 찾기' }).querySelectorAll('button');
    fireEvent.click(screen.getByRole('button', { name: /위치 찾기/ }));
    expect([...menu()].map((b) => b.textContent?.trim())).toEqual(['현재 위치']); // 지역 검색은 헤더 [검색](D70)
    permission = 'denied';
    fireEvent.click(screen.getByRole('button', { name: /현재 위치/ }));
    await flush();
    expect(geoCalls).toBe(1);
    expect(screen.getByRole('dialog', { name: '위치 권한이 꺼져 있어요' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /지역 검색으로 찾기/ }));
    });
    await flush();
    expect(screen.queryByRole('dialog', { name: '위치 권한이 꺼져 있어요' })).toBeNull();
    expect(screen.getByRole('dialog', { name: '지역 검색' })).toBeTruthy();
  });

  test('an area picked in header search comes before current location (D70)', async () => {
    sessionStorage.setItem('munyeon:viewArea', JSON.stringify({ label: '마포구 망원동', lat: 37.556, lon: 126.905, gps: false }));
    const s = server([], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(screen.getByText('마포구 망원동')).toBeTruthy();
    expect(geoCalls).toBe(0);
  });

  test('coming back to main in the same tab keeps the picked area, not current location (D73)', async () => {
    sessionStorage.setItem('munyeon:viewArea', JSON.stringify({ label: '마포구 망원동', lat: 37.556, lon: 126.905, gps: false }));
    const s = server([], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    cleanup(); // 상세로 갔다가
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />); // 뒤로가기
    });
    await flush();
    expect(screen.getByText('마포구 망원동')).toBeTruthy();
    expect(geoCalls).toBe(0);
  });

  test('current location is also kept for the tab, without asking the position again (D73)', async () => {
    const s = server([], []);
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(geoCalls).toBe(1);
    expect(JSON.parse(sessionStorage.getItem('munyeon:viewArea')!)).toMatchObject({ lat: center.lat, lon: center.lon, gps: true });
    cleanup();
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(geoCalls).toBe(1);
  });

  test('holidays come with the page HTML, so a failed meta request still shows holiday rules', async () => {
    vi.setSystemTime(new Date('2026-12-25T10:00:00+09:00')); // 공휴일(금)
    globalThis.fetch = vi.fn(async () => new Response('down', { status: 503 })) as typeof fetch;
    const s = server([], [makeRecord({ id: 'U', hours: { dutyTime5s: '0900', dutyTime5c: '1800' }, ...near(0.3) })]);
    s.release();
    // 앞 테스트에서 받아 둔 /api/meta 결과를 지우려고 모듈을 새로 불러온다
    vi.resetModules();
    const { MainScreen: Fresh } = await import('./MainScreen');
    await act(async () => {
      render(<Fresh fetchJson={s.fetchJson} holidays={['2026-12-25']} />);
    });
    await flush();
    expect(screen.getByText('오늘은 공휴일 · 공휴일 진료시간 기준')).toBeTruthy();
    expect(screen.getByText('전화 확인 필요')).toBeTruthy();
    expect(screen.queryByText(/영업 중 ·/)).toBeNull();
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

  test('show all appends closed places; changing the type returns to open-only', async () => {
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
    expect(screen.queryByRole('button', { name: '전체 보기' })).toBeNull();
    expect(ids().at(-1)).toBe('X');
    expect(ids()[0]).toBe('O');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '병원' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '약국' }));
    });
    await flush();
    expect(ids()).not.toContain('X');
    expect(screen.getByRole('button', { name: '전체 보기' })).toBeTruthy();
  });

  test('pediatric shows pediatric hospitals only; few open ones offer nearby hospitals, which switches the type', async () => {
    const hosp = (id: string, pediatricName: boolean, km: number) =>
      makeRecord({ id, kind: 'hospital', category: 'general', pediatricName, hours: OPEN, ...near(km) });
    const rows = [hosp('P', true, 0.4), hosp('H1', false, 0.2), hosp('H2', false, 0.3)];
    const s = server(rows, rows);
    s.release();
    localStorage.setItem('munyeon:kind', 'pediatric');
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(screen.getByRole('combobox', { name: '진료과' })).toHaveProperty('value', 'pediatric');
    expect(ids()).toEqual(['P']);
    expect(s.urls.every((u) => u.includes('/hospital/'))).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /가까운 병원 보기/ }));
    });
    await flush();
    expect(screen.getByRole('combobox', { name: '진료과' })).toHaveProperty('value', 'hospital');
    expect(ids()).toEqual(['H1', 'H2', 'P']);
    expect(localStorage.getItem('munyeon:kind')).toBe('hospital');
  });

  test('obgyn: obgyn hospitals only (D78)', async () => {
    const rows = [
      makeRecord({ id: 'OB', kind: 'hospital', category: 'general', name: '봄산부인과의원', hours: OPEN, ...near(0.4) }),
      makeRecord({ id: 'H', kind: 'hospital', category: 'general', name: '봄내과의원', hours: OPEN, ...near(0.2) }),
    ];
    const s = server(rows, rows);
    s.release();
    localStorage.setItem('munyeon:kind', 'obgyn');
    await act(async () => {
      render(<MainScreen fetchJson={s.fetchJson} />);
    });
    await flush();
    expect(ids()).toEqual(['OB']);
    expect(screen.getByText('가까운 곳에 지금 문 연 산부인과가 적어요')).toBeTruthy();
  });

  test('emergency: nationwide ER list nearest first as 24h, no show-all; area name from nearby cells (D78)', async () => {
    const closedNow = { dutyTime1s: '0900', dutyTime1c: '1700' };
    const er = [
      makeRecord({ id: 'E2', kind: 'hospital', category: 'general', name: '먼병원', hours: closedNow, ...near(30) }),
      makeRecord({ id: 'E1', kind: 'hospital', category: 'general', name: '가까운병원', hours: closedNow, ...near(2) }),
    ];
    const urls: string[] = [];
    const fetchJson = async (url: string): Promise<GridPayload> => {
      urls.push(url);
      if (url === '/api/emergency') return encodeGrid(er);
      return encodeGrid([makeRecord({ id: 'N', kind: 'hospital', category: 'general', ...near(0.1) })]);
    };
    localStorage.setItem('munyeon:kind', 'emergency');
    await act(async () => {
      render(<MainScreen fetchJson={fetchJson} />);
    });
    await flush();
    expect(ids()).toEqual(['E1', 'E2']);
    expect(screen.getAllByText('응급실 24시간')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '전체 보기' })).toBeNull();
    expect(screen.getByText('중구 태평로1가')).toBeTruthy();
    expect(urls.filter((u) => u.startsWith('/api/grid/')).every((u) => u.includes('/hospital/f'))).toBe(true);
  });
});

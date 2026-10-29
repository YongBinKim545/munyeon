// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';
import { encodeGrid } from '@/lib/grid';
import { RegionScreen } from './RegionScreen';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/x' }));

const center = { lat: 37.56, lon: 126.9 };
const payload = encodeGrid([
  makeRecord({ id: 'A', name: '가약국', hours: { dutyTime1s: '0900', dutyTime1c: '2300', dutyTime7s: '1000', dutyTime7c: '1400' }, lat: 37.561, lon: 126.9 }),
  makeRecord({ id: 'B', name: '나약국', hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, lat: 37.562, lon: 126.9 }),
]);
const props = {
  sido: '서울특별시', sigungu: '마포구', kind: 'pharmacy' as const, payload, center, holidays: [],
  paths: { pharmacy: '/서울특별시/마포구', hospital: '/서울특별시/마포구/병원' },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T20:00:00+09:00')); // 월요일 20시
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ holidays: [], lastSync: { hospital: null, pharmacy: null } }))) as typeof fetch;
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RegionScreen (D69)', () => {
  test('server HTML has no open status (D23); the list is drawn in the browser', () => {
    const html = renderToString(<RegionScreen {...props} />);
    expect(html).not.toContain('영업 중');
    expect(html).toContain('목록을 준비하고 있어요');
  });

  test('same list as main: open now first, distance from the region center', async () => {
    await act(async () => render(<RegionScreen {...props} />));
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.textContent).toContain('가약국');
    expect(screen.getByText(/거리는 마포구 중심 기준이에요/)).toBeTruthy();
  });

  test('an old ?날짜= link opens the now list (date removed, D78)', async () => {
    window.history.replaceState(null, '', '/?%EB%82%A0%EC%A7%9C=2026-10-25');
    await act(async () => render(<RegionScreen {...props} />));
    expect(screen.queryByRole('combobox', { name: '언제' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  test('hospital page reads #산부인과 and moves to pharmacy by path (D78)', async () => {
    const hp = encodeGrid([
      makeRecord({ id: 'OB', kind: 'hospital', category: 'general', name: '봄산부인과의원', hours: { dutyTime1s: '0900', dutyTime1c: '2300' }, lat: 37.561, lon: 126.9 }),
      makeRecord({ id: 'H', kind: 'hospital', category: 'general', name: '봄내과의원', hours: { dutyTime1s: '0900', dutyTime1c: '2300' }, lat: 37.561, lon: 126.9 }),
    ]);
    window.history.replaceState(null, '', '/x#%EC%82%B0%EB%B6%80%EC%9D%B8%EA%B3%BC');
    await act(async () => render(<RegionScreen {...props} kind="hospital" payload={hp} />));
    expect(screen.getByRole('combobox', { name: '진료과' })).toHaveProperty('value', 'obgyn');
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-id'))).toEqual(['OB']);
    act(() => screen.getByRole('button', { name: '약국' }).click());
    expect(push).toHaveBeenCalledWith('/서울특별시/마포구');
  });
});

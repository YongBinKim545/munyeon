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

  test('a shared link with ?날짜= opens that day', async () => {
    window.history.replaceState(null, '', '/?%EB%82%A0%EC%A7%9C=2026-10-25');
    await act(async () => render(<RegionScreen {...props} />));
    expect(screen.getByRole('combobox', { name: '언제' })).toHaveProperty('value', '2026-10-25');
    expect(screen.getByText('10/25(일) 10:00~14:00')).toBeTruthy();
  });
});

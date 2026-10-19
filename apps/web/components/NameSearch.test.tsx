// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NameSearch } from './NameSearch';

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/search',
  useSearchParams: () => search,
}));

const hits = {
  items: [
    { id: 'C1', kind: 'pharmacy', name: '망원온누리약국', sido: '서울특별시', sigungu: '마포구', tel: '02-111-2222', lat: 37.5563, lon: 126.9055, badge: '약국' },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => new Response(JSON.stringify(hits)));
  vi.stubGlobal('fetch', fetchMock);
  navigator.sendBeacon = vi.fn(() => true);
  localStorage.clear();
  search = new URLSearchParams();
  replace.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function type(q: string) {
  await act(async () => {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: q } });
  });
}
const settle = () => act(async () => {
  await vi.advanceTimersByTimeAsync(300);
});

describe('NameSearch', () => {
  test('one character does not search; two characters search once after 0.3s', async () => {
    await act(async () => {
      render(<NameSearch />);
    });
    await type('망');
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    await type('망원');
    expect(fetchMock).not.toHaveBeenCalled();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/search?q=${encodeURIComponent('망원')}`);
    expect(replace).toHaveBeenLastCalledWith(`/search?q=${encodeURIComponent('망원')}`, { scroll: false });
  });

  test('sends only the grid id of the last main center and shows distance', async () => {
    localStorage.setItem('munyeon:lastCenter', JSON.stringify({ lat: 37.5563, lon: 126.9105 }));
    await act(async () => {
      render(<NameSearch />);
    });
    await type('망원');
    await settle();
    const url = fetchMock.mock.calls.at(-1)![0] as string;
    expect(url).toMatch(/&g=\d+_\d+$/);
    expect(url).not.toMatch(/\d+\.\d+/);
    expect(screen.getByText(/약국 · 마포구 · 440m/)).toBeTruthy();
  });

  test('re-sorts by distance from the last main center', async () => {
    localStorage.setItem('munyeon:lastCenter', JSON.stringify({ lat: 37.5, lon: 127.03 }));
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [
      { ...hits.items[0], id: 'FAR', name: '먼약국', lat: 37.52, lon: 127.03 },
      { ...hits.items[0], id: 'NOGEO', name: '좌표없는약국', lat: null, lon: null },
      { ...hits.items[0], id: 'NEAR', name: '가까운약국', lat: 37.501, lon: 127.03 },
    ] })));
    await act(async () => {
      render(<NameSearch />);
    });
    await type('약국');
    await settle();
    const names = [...document.querySelectorAll('.search__row > a[href^="/"]')].map((a) => a.textContent?.split(' ')[0]);
    expect(names).toEqual(['가까운약국', '먼약국', '좌표없는약국']);
  });

  test('restores the query from the address', async () => {
    search = new URLSearchParams('q=온누리');
    await act(async () => {
      render(<NameSearch />);
    });
    expect(screen.getByRole('searchbox')).toHaveProperty('value', '온누리');
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /^망원온누리약국 약국/ }).getAttribute('href')).toBe('/pharmacy/C1');
  });
});

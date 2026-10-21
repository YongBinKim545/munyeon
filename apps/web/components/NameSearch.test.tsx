// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NameSearch } from './NameSearch';

const replace = vi.fn();
const back = vi.fn();
const push = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, back, push }),
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
  fetchMock = vi.fn(async () => new Response(JSON.stringify(hits)));
  vi.stubGlobal('fetch', fetchMock);
  navigator.sendBeacon = vi.fn(() => true);
  localStorage.clear();
  search = new URLSearchParams();
  replace.mockReset();
  back.mockReset();
  push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 검색어를 넣고 [검색]을 누른다(D43: 입력 중에는 찾지 않는다) */
async function type(q: string) {
  await act(async () => {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: q } });
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
  });
}
const settle = () => act(async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
});

describe('NameSearch', () => {
  test('typing does not search; one character asks for two; the button searches once', async () => {
    await act(async () => {
      render(<NameSearch />);
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: '망원' } });
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await type('망');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('두 글자 이상 입력하세요')).toBeTruthy();
    await type('망원');
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

  test('shows the loader while searching', async () => {
    let release!: () => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (release = () => r(new Response(JSON.stringify(hits))))));
    await act(async () => {
      render(<NameSearch />);
    });
    await type('망원');
    expect(screen.getByRole('status').textContent).toContain('찾는 중');
    await act(async () => {
      release();
    });
    await settle();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('망원온누리약국')).toBeTruthy();
  });

  test('close goes back when there is an in-app page before, otherwise to the main page', async () => {
    const nav = await import('@/lib/navHistory');
    nav.resetNavigation();
    await act(async () => {
      render(<NameSearch />);
    });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(push).toHaveBeenCalledWith('/');
    nav.noteNavigation('/');
    nav.noteNavigation('/search');
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(back).toHaveBeenCalled();
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

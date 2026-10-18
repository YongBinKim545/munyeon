// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { encodeNeighborhoods } from '@/lib/search';
import { SearchBox } from './SearchBox';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const neighborhoods = encodeNeighborhoods([
  { name: '망원동', sido: '서울특별시', sigungu: '마포구', lat: null, lon: null },
  { name: '마포구', sido: '서울특별시', sigungu: '마포구', lat: null, lon: null },
]);
const hits = { items: [{ id: 'C1', kind: 'pharmacy', name: '망원온누리약국', sido: '서울특별시', sigungu: '마포구', tel: '02-111-2222', badge: '약국' }] };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.startsWith('/api/neighborhoods') ? neighborhoods : hits)));
  vi.stubGlobal('fetch', fetchMock);
  navigator.sendBeacon = vi.fn(() => true);
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function typeQuery(q: string) {
  const input = screen.getByRole('searchbox');
  await act(async () => { fireEvent.focus(input); });
  await act(async () => { fireEvent.change(input, { target: { value: q } }); });
}

describe('SearchBox', () => {
  test('loads neighborhoods once on focus and debounces institution search', async () => {
    render(<SearchBox />);
    await typeQuery('망');
    await typeQuery('망원');
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/search'))).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    const searchCalls = fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/search'));
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0]![0]).toBe(`/api/search?q=${encodeURIComponent('망원')}`);
    expect(fetchMock.mock.calls.filter(([u]) => String(u) === '/api/neighborhoods')).toHaveLength(1);
  });

  test('neighborhood row links to region landing with dong, institution row to detail', async () => {
    render(<SearchBox />);
    await typeQuery('망원');
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    const pharmacyLink = screen.getAllByRole('link', { name: '약국' })[0]!;
    expect(decodeURI(pharmacyLink.getAttribute('href')!)).toBe('/서울특별시/마포구/약국/전체?동=망원동');
    const hrefs = screen.getAllByRole('link', { name: /망원온누리약국/ }).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/pharmacy/C1', 'tel:021112222']);
    await act(async () => { fireEvent.click(pharmacyLink); });
    expect(JSON.parse(localStorage.getItem('munyeon:recent')!)[0].label).toBe('망원동 약국');
  });

  test('sigungu row has no dong query', async () => {
    render(<SearchBox />);
    await typeQuery('마포');
    const hospitalLink = screen.getAllByRole('link', { name: '병원' })[0]!;
    expect(decodeURI(hospitalLink.getAttribute('href')!)).toBe('/서울특별시/마포구/병원/전체');
  });
});

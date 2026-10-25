// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SearchTabs } from './SearchTabs';

const push = vi.fn();
let query = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
  usePathname: () => '/search',
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  query = '';
  push.mockClear();
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ sido: ['서울특별시'], items: [['망원동', 0, '마포구', 37.556, 126.905]] })),
  ) as typeof fetch;
});
afterEach(cleanup);

describe('SearchTabs (D70)', () => {
  test('opens on the area tab first; picking an area goes to main with it', async () => {
    await act(async () => render(<SearchTabs />));
    expect(screen.getByRole('tab', { name: '지역' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByRole('searchbox', { name: '동네 이름' }), { target: { value: '망원' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '검색' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /망원동/ })));
    expect(push).toHaveBeenCalledWith('/');
    expect(JSON.parse(sessionStorage.getItem('munyeon:pickedArea')!).label).toBe('마포구 망원동');
  });

  test('remembers the last tab; ?q= opens the name tab', async () => {
    await act(async () => render(<SearchTabs />));
    fireEvent.click(screen.getByRole('tab', { name: '기관 이름' }));
    expect(screen.getByRole('searchbox', { name: '병원·약국 이름' })).toBeTruthy();
    cleanup();
    await act(async () => render(<SearchTabs />));
    expect(screen.getByRole('tab', { name: '기관 이름' }).getAttribute('aria-selected')).toBe('true');
    cleanup();
    localStorage.clear();
    query = 'q=온누리';
    await act(async () => render(<SearchTabs />));
    expect(screen.getByRole('tab', { name: '기관 이름' }).getAttribute('aria-selected')).toBe('true');
  });
});

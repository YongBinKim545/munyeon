// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { DetailPreview } from '@/lib/detailPreview';
import { closeInstantDetail, markDetailReady } from '@/lib/instantDetail';
import { DetailError } from './DetailError';
import { InstantDetailLayer } from './InstantDetailLayer';
import { PreviewLink } from './PreviewLink';

let pathname = '/';
const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => pathname, useRouter: () => ({ push, refresh }) }));
// 실제 이동 없이 클릭만 일어나게 한다
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    className,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    className?: string;
    'data-instant'?: string;
  }) => (
    <a
      href={href}
      className={className}
      data-instant={rest['data-instant']}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock('@/lib/meta', () => ({ useMeta: () => null }));
vi.mock('@/lib/track', () => ({ track: () => {} }));

const preview: DetailPreview = {
  kind: 'pharmacy', id: 'C1', name: '온누리약국', badge: '약국', pediatric: false, tel: '02-777-0000',
  hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, sido: '서울특별시', sigungu: '중구', area: '서울특별시 중구', lat: 37.5, lon: 127, holidays: [],
};

const page = () => (
  <>
    <InstantDetailLayer />
    <ul>
      <li>
        <PreviewLink preview={preview}>온누리약국 카드</PreviewLink>
      </li>
    </ul>
  </>
);

beforeEach(() => {
  pathname = '/';
  window.history.replaceState(null, '', '/');
  push.mockClear();
  refresh.mockClear();
});
afterEach(() => {
  act(() => closeInstantDetail());
  cleanup();
});

describe('instant detail (D51)', () => {
  test('a click shows the detail right away from the card data, with the call button', () => {
    render(page());
    fireEvent.click(screen.getByText('온누리약국 카드'));
    expect(screen.getByRole('heading', { name: '온누리약국' })).toBeTruthy();
    expect(screen.getByText('나머지 정보를 불러오고 있어요…')).toBeTruthy();
    expect(document.querySelector('.instant-detail a[href^="tel:"]')).toBeTruthy();
  });

  test('goes away once the server detail is on screen', () => {
    const { rerender } = render(page());
    fireEvent.click(screen.getByText('온누리약국 카드'));
    pathname = '/pharmacy/C1';
    rerender(page());
    expect(document.querySelector('.instant-detail')).toBeTruthy();
    act(() => markDetailReady('/pharmacy/C1'));
    expect(document.querySelector('.instant-detail')).toBeNull();
  });

  test('if the server fails, the error screen keeps the detail and offers a retry in one line', () => {
    render(page());
    fireEvent.click(screen.getByText('온누리약국 카드'));
    cleanup();
    // Next가 실패한 이동을 페이지 통째 불러오기로 바꾼 경우: 메모리는 없고 탭 저장소만 남는다
    act(() => closeInstantDetail());
    pathname = '/pharmacy/C1';
    const reset = vi.fn();
    render(<DetailError reset={reset} />);
    expect(screen.getByRole('heading', { name: '온누리약국' })).toBeTruthy();
    expect(screen.getByText(/일부 정보를 불러오지 못했어요/)).toBeTruthy();
    expect(document.querySelector('a[href^="tel:"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refresh).toHaveBeenCalled();
  });

  test('error screen without a remembered detail shows the plain message', () => {
    sessionStorage.clear();
    pathname = '/pharmacy/C9';
    render(<DetailError reset={() => {}} />);
    expect(screen.getByRole('heading', { name: '정보를 불러오지 못했어요' })).toBeTruthy();
  });

  test('back button closes it and leaves the list as it was', () => {
    render(page());
    fireEvent.click(screen.getByText('온누리약국 카드'));
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(document.querySelector('.instant-detail')).toBeNull();
    expect(screen.getByText('온누리약국 카드')).toBeTruthy();
  });

  test('moving somewhere else closes it', () => {
    const { rerender } = render(page());
    fireEvent.click(screen.getByText('온누리약국 카드'));
    pathname = '/about';
    rerender(page());
    expect(document.querySelector('.instant-detail')).toBeNull();
  });

  test('a ctrl-click (new tab) does not cover the page', () => {
    render(page());
    fireEvent.click(screen.getByText('온누리약국 카드'), { ctrlKey: true });
    expect(document.querySelector('.instant-detail')).toBeNull();
  });
});

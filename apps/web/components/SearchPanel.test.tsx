// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SearchPanel } from './SearchPanel';

afterEach(cleanup);

const props = (over = {}) => ({
  inputId: 'q',
  label: '이름',
  placeholder: '예: 온누리약국',
  value: '온누리',
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  onClose: vi.fn(),
  loading: false,
  ...over,
});

describe('SearchPanel (D43)', () => {
  test('input and search button on top, full-width close at the bottom', () => {
    render(<SearchPanel {...props()}><p>결과</p></SearchPanel>);
    const buttons = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['검색', '닫기']);
    expect(document.querySelector('.search-panel__foot button')!.textContent).toContain('닫기');
    expect(screen.getByText('결과')).toBeTruthy();
  });

  test('search runs on the button or Enter only, not while typing', () => {
    const p = props();
    render(<SearchPanel {...p} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '온누리약' } });
    expect(p.onChange).toHaveBeenCalledWith('온누리약');
    expect(p.onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    fireEvent.submit(screen.getByRole('search'));
    expect(p.onSubmit).toHaveBeenCalledTimes(2);
  });

  test('loading shows the loader instead of results', () => {
    render(<SearchPanel {...props({ loading: true })}><p>결과</p></SearchPanel>);
    expect(screen.getByRole('status').textContent).toContain('찾는 중');
    expect(screen.queryByText('결과')).toBeNull();
  });

  test('on phones the close button moves under the form while the keyboard is up, and back only after it goes down (D45)', () => {
    const vv = Object.assign(new EventTarget(), { height: 800 });
    vi.stubGlobal('visualViewport', vv);
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('coarse'), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(<SearchPanel {...props()} />);
    const where = () => (document.querySelector('.search-panel__close-top button') ? 'top' : document.querySelector('.search-panel__foot button') ? 'bottom' : 'none');
    expect(where()).toBe('bottom');
    fireEvent.pointerDown(screen.getByRole('searchbox'));
    expect(where()).toBe('top');
    // 키보드가 올라와 화면이 줄었다가
    vv.height = 450;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(where()).toBe('top');
    // 결과를 누르는 순간(포커스가 빠져도) 배치는 그대로
    fireEvent.blur(screen.getByRole('searchbox'));
    expect(where()).toBe('top');
    // 키보드가 내려가 화면이 돌아오면 맨 아래로
    vv.height = 800;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(where()).toBe('bottom');
    expect(screen.getAllByRole('button', { name: '닫기' })).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  test('a keyboard opened without a tap (autofocus) also moves the close button up', () => {
    const vv = Object.assign(new EventTarget(), { height: 800 });
    vi.stubGlobal('visualViewport', vv);
    window.matchMedia = vi.fn((q: string) => ({ matches: q.includes('coarse'), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(<SearchPanel {...props()} />);
    screen.getByRole('searchbox').focus();
    vv.height = 450;
    act(() => {
      vv.dispatchEvent(new Event('resize'));
    });
    expect(document.querySelector('.search-panel__close-top button')).not.toBeNull();
    vi.unstubAllGlobals();
  });

  test('on desktop (no touch) the close button stays at the bottom', () => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    render(<SearchPanel {...props()} />);
    fireEvent.pointerDown(screen.getByRole('searchbox'));
    expect(document.querySelector('.search-panel__foot button')).not.toBeNull();
  });

  test('close button', () => {
    const p = props();
    render(<SearchPanel {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(p.onClose).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  test('close button', () => {
    const p = props();
    render(<SearchPanel {...p} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(p.onClose).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ScrollTopButton } from './ScrollTopButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

describe('ScrollTopButton', () => {
  test('appears only when scrolling up after one screen, hides when scrolling down', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    render(<ScrollTopButton />);
    expect(screen.queryByRole('button', { name: '맨 위로' })).toBeNull();
    scrollTo(500);
    scrollTo(400); // 위로 올렸지만 한 화면 안
    expect(screen.queryByRole('button', { name: '맨 위로' })).toBeNull();
    scrollTo(2000);
    expect(screen.queryByRole('button', { name: '맨 위로' })).toBeNull();
    scrollTo(1900);
    expect(screen.getByRole('button', { name: '맨 위로' })).toBeTruthy();
    scrollTo(2100);
    expect(screen.queryByRole('button', { name: '맨 위로' })).toBeNull();
  });

  test('click scrolls to top', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const to = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<ScrollTopButton />);
    scrollTo(3000);
    scrollTo(2900);
    fireEvent.click(screen.getByRole('button', { name: '맨 위로' }));
    expect(to).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });
});

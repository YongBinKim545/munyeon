// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Header } from './Header';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
afterEach(cleanup);

describe('Header (D44)', () => {
  test('brand logo links to main, with a white version for dark mode', () => {
    render(<Header />);
    const link = screen.getByRole('link', { name: '찾아줘 메디 메인' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.querySelector('img')!.getAttribute('src')).toBe('/logo.svg');
    expect(link.querySelector('img')!.getAttribute('alt')).toBe('찾아줘 메디');
    expect(link.querySelector('source')!.getAttribute('media')).toBe('(prefers-color-scheme: dark)');
    expect(link.querySelector('source')!.getAttribute('srcset')).toBe('/logo-white.svg');
  });

  test('search icon only off the main page', () => {
    render(<Header />);
    expect(screen.queryByRole('link', { name: '병원·약국 이름 검색' })).toBeNull();
    cleanup();
    pathname = '/about';
    render(<Header />);
    expect(screen.getByRole('link', { name: '병원·약국 이름 검색' })).toBeTruthy();
  });
});

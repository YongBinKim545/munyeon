// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CallButton } from './CallButton';

function mockPointer(fine: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: fine && q.includes('pointer: fine'), media: q, addEventListener() {}, removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CallButton', () => {
  test('touch device shows tel link and tracks tel_tap', async () => {
    mockPointer(false);
    await act(async () => { render(<CallButton tel="02-777-0000" institutionId="C1100005" page="detail" />); });
    const link = screen.getByRole('link', { name: /전화하기/ });
    expect(link.getAttribute('href')).toBe('tel:027770000');
    fireEvent.click(link);
    const body = JSON.parse(String((navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0]![1]));
    expect(body).toEqual({ type: 'tel_tap', institutionId: 'C1100005', page: 'detail' });
  });

  test('CallButton shows copy on fine pointer', async () => {
    mockPointer(true);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await act(async () => { render(<CallButton tel="02-777-0000" institutionId="C1100005" page="detail" />); });
    expect(screen.getByText('02-777-0000')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '번호 복사' })); });
    expect(writeText).toHaveBeenCalledWith('02-777-0000');
    const body = JSON.parse(String((navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0]![1]));
    expect(body.type).toBe('tel_copy');
    expect(screen.getByRole('button', { name: '복사했어요' })).toBeTruthy();
  });

  test('missing or invalid number', async () => {
    mockPointer(false);
    await act(async () => { render(<CallButton tel={null} institutionId="X" page="detail" />); });
    expect(screen.getByText('전화번호 정보 없음')).toBeTruthy();
  });
});

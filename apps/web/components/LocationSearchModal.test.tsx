// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { encodeNeighborhoods } from '@/lib/search';
import { LocationSearchModal } from './LocationSearchModal';

const payload = encodeNeighborhoods([
  { name: '망원동', sido: '서울특별시', sigungu: '마포구', lat: 37.556, lon: 126.905 },
  { name: '중앙동', sido: '부산광역시', sigungu: '중구', lat: 35.104, lon: 129.036 },
  { name: '좌표없는동', sido: '서울특별시', sigungu: '마포구', lat: null, lon: null },
]);

beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(payload))) as typeof fetch;
  history.replaceState(null, '');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function open() {
  const onPick = vi.fn();
  const onClose = vi.fn();
  await act(async () => {
    render(<LocationSearchModal onPick={onPick} onClose={onClose} />);
  });
  return { onPick, onClose };
}

describe('LocationSearchModal', () => {
  test('back closes modal only: opening adds one history entry and popstate closes', async () => {
    const before = history.length;
    const { onClose } = await open();
    expect(history.length).toBe(before + 1);
    expect(history.state).toEqual({ modal: 'location' });
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(onClose).toHaveBeenCalled();
  });

  test('close button and Escape go back in history', async () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    await open();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(2);
  });

  test('picking a neighborhood passes its area after history goes back', async () => {
    vi.spyOn(history, 'back').mockImplementation(() => window.dispatchEvent(new PopStateEvent('popstate')));
    const { onPick, onClose } = await open();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '중앙' } });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /중앙동/ }));
    });
    expect(onPick).toHaveBeenCalledWith({ label: '부산 중구 중앙동', lat: 35.104, lon: 129.036 });
    expect(onClose).toHaveBeenCalled();
  });

  test('neighborhoods without coordinates are not offered', async () => {
    await open();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '좌표없' } });
    expect(screen.queryByRole('button', { name: /좌표없는동/ })).toBeNull();
    expect(screen.getByText('찾는 동네가 없어요')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LocationGuideModal } from './LocationGuideModal';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

beforeEach(() => {
  history.replaceState(null, '');
  vi.spyOn(history, 'back').mockImplementation(() => window.dispatchEvent(new PopStateEvent('popstate')));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function open(reason: 'denied' | 'unavailable', ua = '') {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  const onClosed = vi.fn();
  await act(async () => {
    render(<LocationGuideModal reason={reason} onClosed={onClosed} />);
  });
  return onClosed;
}

describe('LocationGuideModal', () => {
  test('denied: title, only this device steps, three buttons', async () => {
    await open('denied', IPHONE);
    expect(screen.getByRole('dialog', { name: '위치 권한이 꺼져 있어요' })).toBeTruthy();
    expect(screen.getByText('아이폰(사파리)')).toBeTruthy();
    expect(screen.queryByText('안드로이드(크롬)')).toBeNull();
    expect(screen.getByText('허용한 뒤 [다시 시도]를 눌러 주세요.')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['다시 시도', '지역 검색으로 찾기', '닫기']);
  });

  test('unknown device shows every guide', async () => {
    await open('denied', '');
    for (const t of ['아이폰(사파리)', '안드로이드(크롬)', 'PC(크롬·엣지)', '카카오톡·네이버 앱 안에서 보고 있다면']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  test('unavailable: location services message', async () => {
    await open('unavailable', IPHONE);
    expect(screen.getByRole('dialog', { name: '위치를 찾지 못했어요' })).toBeTruthy();
    expect(screen.getByText('휴대폰의 위치 서비스가 켜져 있는지 확인해 주세요.')).toBeTruthy();
  });

  test('buttons report their action after history goes back', async () => {
    const onClosed = await open('denied', IPHONE);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }));
    });
    expect(onClosed).toHaveBeenLastCalledWith('retry');
  });

  test('close and back report null', async () => {
    const onClosed = await open('denied', IPHONE);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(onClosed).toHaveBeenLastCalledWith(null);
  });
});

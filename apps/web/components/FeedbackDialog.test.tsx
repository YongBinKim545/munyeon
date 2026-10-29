// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FeedbackDialog, resetFeedbackDrafts } from './FeedbackDialog';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  history.replaceState(null, '');
  vi.spyOn(history, 'back').mockImplementation(() => window.dispatchEvent(new PopStateEvent('popstate')));
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  resetFeedbackDrafts();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const sent = () => JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));

describe('FeedbackDialog (D49)', () => {
  test('opinion: title with X at the top, send at the bottom, empty text is not sent', async () => {
    render(<FeedbackDialog target={{ type: 'opinion' }} path="/about" onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: '개선의견' });
    expect(dialog.querySelector('.sheet-head button')?.getAttribute('aria-label')).toBe('닫기');
    expect(dialog.querySelector('.sheet-foot button')?.textContent).toContain('보내기');
    expect(screen.queryByRole('group')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /보내기/ }));
    });
    expect(screen.getByRole('alert').textContent).toBe('내용을 적어 주세요');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '글씨를 키워 주세요' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /보내기/ }));
    });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/feedback');
    expect(sent()).toEqual({ type: 'opinion', text: '글씨를 키워 주세요', path: '/about' });
    expect(screen.getByText('감사합니다')).toBeTruthy();
  });

  test('correction: chips with hospital wording, at least one chip, 기타 needs text', async () => {
    render(<FeedbackDialog target={{ type: 'correction', kind: 'hospital', institutionId: 'A1', name: '부민병원' }} path="/hospital/A1" onClose={vi.fn()} />);
    expect(screen.getByText('부민병원')).toBeTruthy();
    const chips = [...screen.getByRole('group', { name: '틀린 항목' }).querySelectorAll('button')].map((b) => b.textContent);
    expect(chips).toEqual(['전화번호', '진료시간', '상호', '주소', '폐업', '기타']);
    const send = () => act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /보내기/ }));
    });
    await send();
    expect(screen.getByRole('alert').textContent).toBe('틀린 항목을 골라 주세요');
    fireEvent.click(screen.getByRole('button', { name: '기타' }));
    expect(screen.getByRole('button', { name: '기타' }).getAttribute('aria-pressed')).toBe('true');
    await send();
    expect(screen.getByRole('alert').textContent).toBe('기타 내용을 적어 주세요');
    fireEvent.click(screen.getByRole('button', { name: '기타' }));
    fireEvent.click(screen.getByRole('button', { name: '진료시간' }));
    await send();
    expect(sent()).toEqual({ type: 'correction', kind: 'hospital', institutionId: 'A1', fields: ['hours'], text: '', path: '/hospital/A1' });
  });

  test('a draft survives closing and reopening; sending clears it', async () => {
    const { unmount } = render(<FeedbackDialog target={{ type: 'opinion' }} path="/" onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '쓰던 글' } });
    unmount();
    render(<FeedbackDialog target={{ type: 'opinion' }} path="/" onClose={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveProperty('value', '쓰던 글');
  });

  test('one send per minute per browser; server failure shows a retry message', async () => {
    localStorage.setItem('munyeon:feedbackAt', String(Date.now()));
    render(<FeedbackDialog target={{ type: 'opinion' }} path="/" onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '또 보냄' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /보내기/ }));
    });
    expect(screen.getByRole('alert').textContent).toBe('잠시 뒤 다시 보내 주세요');
    expect(fetchMock).not.toHaveBeenCalled();
    localStorage.clear();
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /보내기/ }));
    });
    expect(screen.getByRole('alert').textContent).toBe('보내지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  });

  test('X closes through history like the other modals', async () => {
    const onClose = vi.fn();
    render(<FeedbackDialog target={{ type: 'opinion' }} path="/" onClose={onClose} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

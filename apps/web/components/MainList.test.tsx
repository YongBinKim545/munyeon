// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';
import { decodeGrid, encodeGrid } from '@/lib/grid';
import { buildView } from '@/lib/nearby';
import { MainList, PAGE_SIZE } from './MainList';

beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
});
afterEach(cleanup);

const center = { lat: 37.5637, lon: 126.9838 };
const now = new Date('2026-10-19T20:00:00+09:00'); // 월요일 20시
const ctx = { holidays: new Set<string>() };
const at = (i: number) => ({ lat: center.lat + i * 0.001, lon: center.lon });
const entries = decodeGrid(encodeGrid([
  makeRecord({ id: 'CLOSED', name: '닫은약국', hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, ...at(1) }),
  makeRecord({ id: 'SOON', name: '곧여는약국', hours: { dutyTime1s: '2100', dutyTime1c: '2300' }, ...at(2) }),
  makeRecord({ id: 'OPEN_FAR', name: '먼약국', hours: { dutyTime1s: '0900', dutyTime1c: '2300' }, ...at(5) }),
  makeRecord({ id: 'OPEN_NEAR', name: '가까운약국', hours: { dutyTime1s: '0900', dutyTime1c: '2300' }, ...at(3) }),
  makeRecord({ id: 'NOINFO', name: '정보없는약국', hours: {}, ...at(4) }),
]), 'pharmacy');

const ids = () => [...document.querySelectorAll('[data-id]')].map((el) => el.getAttribute('data-id'));

function renderList(mode: 'open' | 'all', onShowAll = vi.fn()) {
  const items = buildView(entries, center, 3, now, ctx, mode);
  return render(<MainList items={items} mode={mode} now={now} ctx={ctx} holidayToday={false} loadingMore={false} onShowAll={onShowAll} />);
}

describe('MainList', () => {
  test('open mode: open by distance, then soon; show-all button at the end', () => {
    const onShowAll = vi.fn();
    renderList('open', onShowAll);
    expect(ids()).toEqual(['OPEN_NEAR', 'OPEN_FAR', 'SOON']);
    expect(screen.getByText(/곧 영업 · 1시간 뒤 오후 9시/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
    expect(onShowAll).toHaveBeenCalled();
  });

  test('all mode appends closed and no-info after, no show-all button, no divider text', () => {
    renderList('all');
    expect(ids()).toEqual(['OPEN_NEAR', 'OPEN_FAR', 'SOON', 'CLOSED', 'NOINFO']);
    expect(screen.queryByRole('button', { name: '전체 보기' })).toBeNull();
    expect(screen.queryByText(/전체 보기로/)).toBeNull();
  });

  test('call and directions sit in the same row', () => {
    renderList('open');
    const card = document.querySelector('[data-id="OPEN_NEAR"]')!;
    const row = card.querySelector('.actions')!;
    expect(row.textContent).toContain('전화하기');
    expect(row.textContent).toContain('길찾기');
  });

  test('empty open list shows the message, emergency note and show-all', () => {
    render(<MainList items={[]} mode="open" now={now} ctx={ctx} holidayToday={false} loadingMore={false} onShowAll={vi.fn()} />);
    expect(screen.getByText('등록 기준으로 지금 문 연 곳이 없어요')).toBeTruthy();
    expect(screen.getByText(/119에 연락하세요/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '전체 보기' })).toBeTruthy();
    expect(document.querySelector('a[href^="tel:119"]')).toBeNull();
  });

  test('holiday strip and holidayUsual badge', () => {
    const hctx = { holidays: new Set(['2026-12-25']) };
    const hnow = new Date('2026-12-25T10:00:00+09:00');
    const e = decodeGrid(encodeGrid([makeRecord({ id: 'U', hours: { dutyTime5s: '0900', dutyTime5c: '1800' }, ...at(1) })]), 'pharmacy');
    render(<MainList items={buildView(e, center, 3, hnow, hctx, 'open')} mode="open" now={hnow} ctx={hctx} holidayToday loadingMore={false} onShowAll={vi.fn()} />);
    expect(screen.getByText('오늘은 공휴일 · 공휴일 진료시간 기준')).toBeTruthy();
    expect(screen.getByText('전화 확인 필요')).toBeTruthy();
    expect(screen.getByText('평소 금요일엔 이 시간 영업')).toBeTruthy();
  });

  test('renders in pages of 50', () => {
    const many = decodeGrid(encodeGrid(Array.from({ length: 120 }, (_, i) =>
      makeRecord({ id: `M${i}`, hours: { dutyTime1s: '0900', dutyTime1c: '2300' }, lat: center.lat + i * 0.0001, lon: center.lon }))), 'pharmacy');
    render(<MainList items={buildView(many, center, 3, now, ctx, 'open')} mode="open" now={now} ctx={ctx} holidayToday={false} loadingMore={false} onShowAll={vi.fn()} />);
    expect(ids()).toHaveLength(PAGE_SIZE);
    expect(screen.queryByRole('button', { name: '전체 보기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    expect(ids()).toHaveLength(PAGE_SIZE * 2);
  });

  test('loading placeholder has no status text', () => {
    render(<MainList items={null} mode="open" now={now} ctx={ctx} holidayToday={false} loadingMore={false} onShowAll={vi.fn()} />);
    expect(screen.getByText('가까운 곳을 찾고 있어요…')).toBeTruthy();
  });
});

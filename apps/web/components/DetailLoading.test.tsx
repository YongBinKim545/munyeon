// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HospitalLoading from '@/app/hospital/[id]/loading';
import PharmacyLoading from '@/app/pharmacy/[id]/loading';
import { clearPreviews, rememberPreview } from '@/lib/detailPreview';

let params: { id?: string } = { id: 'C1' };
vi.mock('next/navigation', () => ({ useParams: () => params }));

afterEach(() => {
  cleanup();
  clearPreviews();
});

describe('detail loading', () => {
  test.each([['hospital', HospitalLoading], ['pharmacy', PharmacyLoading]])('%s without a preview shows a status line right away, no live status', (_, Loading) => {
    render(<Loading />);
    expect(screen.getByRole('status').textContent).toContain('정보를 불러오고 있어요');
    expect(document.body.textContent).not.toMatch(/영업 중|영업 종료|등록 기준/);
  });

  test('with a preview from the list it draws the detail at once (D45)', () => {
    params = { id: 'C1' };
    rememberPreview({
      kind: 'pharmacy', id: 'C1', name: '명동온누리약국', badge: '약국', pediatric: false, tel: '02-777-0000',
      hours: { dutyTime1s: '0900', dutyTime1c: '1800' }, sido: '서울특별시', sigungu: '중구', area: '중구 명동',
      lat: 37.56, lon: 126.98, holidays: [],
    });
    render(<PharmacyLoading />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('명동온누리약국');
    expect(screen.getByText('중구 명동')).toBeTruthy();
    expect(document.querySelector('a[href="tel:027770000"]')).not.toBeNull();
    expect(screen.getAllByText('길찾기').length).toBeGreaterThan(0);
    expect(document.querySelector('table.hours')).not.toBeNull();
    expect(screen.getByText('나머지 정보를 불러오고 있어요…')).toBeTruthy();
  });

  test('a preview of another kind or id is not used', () => {
    params = { id: 'C2' };
    rememberPreview({
      kind: 'pharmacy', id: 'C1', name: '다른약국', badge: '약국', pediatric: false, tel: null, hours: null,
      sido: null, sigungu: null, area: '', lat: null, lon: null, holidays: [],
    });
    render(<PharmacyLoading />);
    expect(screen.queryByText('다른약국')).toBeNull();
    cleanup();
    params = { id: 'C1' };
    render(<HospitalLoading />);
    expect(screen.queryByText('다른약국')).toBeNull();
  });
});

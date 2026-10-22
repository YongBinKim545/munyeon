// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { saveLastArea } from '@/lib/prefs';
import { RegionTable } from './RegionTable';

const rows = ['강원특별자치도', '경기도', '서울특별시'].map((name, i) => ({ name, href: `/${name}`, pharmacy: 100 + i, hospital: 200 + i }));
const names = () => screen.getAllByRole('rowheader').map((h) => h.textContent);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('RegionTable (D53)', () => {
  test('alphabetical with column headings when nothing is remembered', () => {
    render(<RegionTable rows={rows} />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['시도', '약국', '병원']);
    expect(names()).toEqual(['강원특별자치도', '경기도', '서울특별시']);
  });

  test('the sido last seen on the main page goes to the top, marked as mine', () => {
    saveLastArea({ label: '중구 명동', lat: 37.56, lon: 126.98, sido: '서울특별시', sigungu: '중구' });
    render(<RegionTable rows={rows} />);
    expect(names()).toEqual(['서울특별시내 지역', '강원특별자치도', '경기도']);
  });

  test('on a sido page, the sigungu is mine only inside the same sido', () => {
    saveLastArea({ label: '중구 명동', lat: 37.56, lon: 126.98, sido: '서울특별시', sigungu: '중구' });
    const sg = ['강남구', '중구'].map((name) => ({ name, href: `/x/${name}`, pharmacy: 1, hospital: 2 }));
    render(<RegionTable rows={sg} sido="서울특별시" />);
    expect(names()).toEqual(['중구내 지역', '강남구']);
    cleanup();
    render(<RegionTable rows={sg} sido="부산광역시" />);
    expect(names()).toEqual(['강남구', '중구']);
  });

  test('old saved areas without sido change nothing', () => {
    localStorage.setItem('munyeon:lastArea', JSON.stringify({ label: '중구 명동', lat: 37.56, lon: 126.98 }));
    render(<RegionTable rows={rows} />);
    expect(names()).toEqual(['강원특별자치도', '경기도', '서울특별시']);
  });
});

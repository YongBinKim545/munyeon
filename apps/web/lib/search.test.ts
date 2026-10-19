import { describe, expect, test } from 'vitest';
import { decodeNeighborhoods, encodeNeighborhoods, matchNeighborhoods, normalizeQuery } from './search';

const list = decodeNeighborhoods(encodeNeighborhoods([
  { name: '망원동', sido: '서울특별시', sigungu: '마포구', lat: null, lon: null },
  { name: '망원1동', sido: '서울특별시', sigungu: '마포구', lat: null, lon: null },
  { name: '중앙동', sido: '부산광역시', sigungu: '중구', lat: null, lon: null },
  { name: '중앙동', sido: '경기도', sigungu: '안산시 단원구', lat: null, lon: null },
  { name: '강남구', sido: '서울특별시', sigungu: '강남구', lat: null, lon: null },
  { name: '신망원동', sido: '경기도', sigungu: '가상시', lat: null, lon: null },
]));

describe('normalizeQuery', () => {
  test('trims and collapses spaces', () => expect(normalizeQuery('  망원  ')).toBe('망원'));
});

describe('matchNeighborhoods', () => {
  test('prefix matches first, then contains', () =>
    expect(matchNeighborhoods(list, '망원').map((n) => n.name)).toEqual(['망원동', '망원1동', '신망원동']));
  test('same name in different regions stays distinct', () =>
    expect(matchNeighborhoods(list, '중앙동').map((n) => n.sigungu)).toEqual(['중구', '안산시 단원구']));
  test('sigungu row', () => expect(matchNeighborhoods(list, '강남')[0]).toMatchObject({ name: '강남구', isSigungu: true }));
  test('one character returns nothing', () => expect(matchNeighborhoods(list, '망')).toEqual([]));
  test('limit', () => expect(matchNeighborhoods(list, '망원', 1)).toHaveLength(1));
});

describe('encode/decode', () => {
  test('round trip keeps sido and sigungu', () => {
    const [n] = decodeNeighborhoods(encodeNeighborhoods([{ name: '역삼동', sido: '서울특별시', sigungu: '강남구', lat: 37.5, lon: 127 }]));
    expect(n).toEqual({ name: '역삼동', sido: '서울특별시', sigungu: '강남구', isSigungu: false, lat: 37.5, lon: 127 });
  });
});

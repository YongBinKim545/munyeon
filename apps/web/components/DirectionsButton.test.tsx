import { describe, expect, test } from 'vitest';
import { directionLinks } from './DirectionsButton';

const NAME = '미연세치과의원';
const ADDR = '서울특별시 강서구 공항대로 382';

describe('directionLinks', () => {
  test('with coordinates both maps open a pin at the place (not a route or a name search)', () => {
    const links = directionLinks(NAME, ADDR, 37.5563945811198, 126.849546722022, false);
    expect(links.map((l) => l.label)).toEqual(['네이버지도', '카카오맵', '티맵(앱)']);
    // 네이버는 이름 검색이 여러 곳을 띄우거나 실패해서 좌표로 찾는다(그 지점에 핀 + 출발·도착)
    expect(links[0]!.href).toBe('https://map.naver.com/p/search/37.5563946,126.8495467');
    expect(links[1]!.href).toBe(`https://map.kakao.com/link/map/${encodeURIComponent(NAME)},37.5563945811198,126.849546722022`);
  });

  test('PC (mouse) has no T map, which is a phone app', () => {
    expect(directionLinks(NAME, ADDR, 37.55, 126.84, true).map((l) => l.label)).toEqual(['네이버지도', '카카오맵']);
  });

  test('without coordinates both maps search name and address', () => {
    const q = encodeURIComponent(`${NAME} ${ADDR}`);
    expect(directionLinks(NAME, ADDR, null, null, false)).toEqual([
      { label: '네이버지도', href: `https://map.naver.com/p/search/${q}` },
      { label: '카카오맵', href: `https://map.kakao.com/link/search/${q}` },
    ]);
  });
});

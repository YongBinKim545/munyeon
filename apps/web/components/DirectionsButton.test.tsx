import { afterEach, describe, expect, test, vi } from 'vitest';
import { deviceOf, directionLinks, openNaverApp } from './DirectionsButton';

const NAME = '미연세치과의원';
const ADDR = '서울특별시 강서구 공항대로 382';
const LAT = 37.5563945811198;
const LON = 126.849546722022;
const N = encodeURIComponent(NAME);
// A안: 이름 검색 + 지도 중심을 기관 좌표로(그 근처 후보가 뜬다)
const NAVER_WEB = `https://map.naver.com/p/search/${N}?c=126.849547,37.556395,17,0,0,0,dh`;
const NAVER_APP = `nmap://place?lat=37.5563946&lng=126.8495467&name=${N}&appname=findmedi.co.kr`;

describe('directionLinks', () => {
  test('Kakao always opens a pin at the place', () => {
    for (const d of ['pc', 'ios', 'android', 'mobile'] as const) {
      expect(directionLinks(NAME, ADDR, LAT, LON, d)[1]).toEqual({ label: '카카오맵', href: `https://map.kakao.com/link/map/${N},${LAT},${LON}` });
    }
  });

  test('PC: Naver web search near the place, no T map', () => {
    const links = directionLinks(NAME, ADDR, LAT, LON, 'pc');
    expect(links.map((l) => l.label)).toEqual(['네이버지도', '카카오맵']);
    expect(links[0]).toEqual({ label: '네이버지도', href: NAVER_WEB });
  });

  test('Android: Naver app pin via intent, Chrome falls back to the web search when the app is missing', () => {
    const [naver, , tmap] = directionLinks(NAME, ADDR, LAT, LON, 'android');
    expect(naver!.href).toBe(
      `intent://place?lat=37.5563946&lng=126.8495467&name=${N}&appname=findmedi.co.kr#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
        `category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(NAVER_WEB)};end`,
    );
    expect(naver!.appUrl).toBeUndefined();
    expect(tmap!.label).toBe('티맵(앱)');
  });

  test('iPhone: the link is the web search, and a tap tries the Naver app first', () => {
    const [naver] = directionLinks(NAME, ADDR, LAT, LON, 'ios');
    expect(naver).toEqual({ label: '네이버지도', href: NAVER_WEB, appUrl: NAVER_APP });
  });

  test('without coordinates both maps search name and address', () => {
    const q = encodeURIComponent(`${NAME} ${ADDR}`);
    expect(directionLinks(NAME, ADDR, null, null, 'ios')).toEqual([
      { label: '네이버지도', href: `https://map.naver.com/p/search/${q}` },
      { label: '카카오맵', href: `https://map.kakao.com/link/search/${q}` },
    ]);
  });
});

describe('deviceOf', () => {
  test('PC by mouse, then Android / iPhone·iPad by user agent', () => {
    expect(deviceOf({ fine: true, ua: 'Mozilla/5.0 (Windows NT 10.0)', touchPoints: 0 })).toBe('pc');
    expect(deviceOf({ fine: false, ua: 'Mozilla/5.0 (Linux; Android 14)', touchPoints: 5 })).toBe('android');
    expect(deviceOf({ fine: false, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', touchPoints: 5 })).toBe('ios');
    // iPadOS 사파리는 맥으로 자신을 알린다
    expect(deviceOf({ fine: false, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 5 })).toBe('ios');
    expect(deviceOf({ fine: false, ua: 'SomeTablet', touchPoints: 5 })).toBe('mobile');
  });
});

describe('openNaverApp (iPhone)', () => {
  afterEach(() => vi.useRealTimers());

  const fakeDoc = (state: 'visible' | 'hidden') => {
    const listeners: Record<string, () => void> = {};
    return {
      doc: {
        get visibilityState() {
          return state;
        },
        addEventListener: (t: string, f: () => void) => {
          listeners[t] = f;
        },
        removeEventListener: (t: string) => {
          delete listeners[t];
        },
      },
      hide: () => {
        state = 'hidden';
        listeners.visibilitychange?.();
      },
    };
  };

  test('goes to the web search when the app did not open', () => {
    vi.useFakeTimers();
    const go = vi.fn();
    const { doc } = fakeDoc('visible');
    openNaverApp(NAVER_APP, NAVER_WEB, { go, doc });
    expect(go).toHaveBeenCalledWith(NAVER_APP);
    vi.advanceTimersByTime(1500);
    expect(go).toHaveBeenLastCalledWith(NAVER_WEB);
  });

  test('stays when the app opened (page went to the background)', () => {
    vi.useFakeTimers();
    const go = vi.fn();
    const { doc, hide } = fakeDoc('visible');
    openNaverApp(NAVER_APP, NAVER_WEB, { go, doc });
    hide();
    vi.advanceTimersByTime(3000);
    expect(go).toHaveBeenCalledTimes(1);
  });
});

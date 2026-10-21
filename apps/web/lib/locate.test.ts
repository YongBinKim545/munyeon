// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { locate, MYEONGDONG, startArea } from './locate';

type Ok = (p: { coords: { latitude: number; longitude: number } }) => void;
type Err = (e: { code: number }) => void;

function fakeGeo(impl: (ok: Ok, err: Err) => void) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: impl } });
}

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

describe('locate', () => {
  test('success', async () => {
    fakeGeo((ok) => ok({ coords: { latitude: 37.55, longitude: 126.91 } }));
    expect(await locate()).toEqual({ ok: true, lat: 37.55, lon: 126.91 });
  });

  test('denied', async () => {
    fakeGeo((_ok, err) => err({ code: 1 }));
    expect(await locate()).toEqual({ ok: false, reason: 'denied' });
  });

  test('unsupported', async () => {
    expect(await locate()).toEqual({ ok: false, reason: 'unsupported' });
  });

  test('times out while the permission prompt is open, then reports a late success', async () => {
    vi.useFakeTimers();
    let later: Ok = () => {};
    fakeGeo((ok) => {
      later = ok;
    });
    const onLate = vi.fn();
    const p = locate(8000, onLate);
    vi.advanceTimersByTime(8000);
    expect(await p).toEqual({ ok: false, reason: 'timeout' });
    later({ coords: { latitude: 37.5, longitude: 127 } });
    expect(onLate).toHaveBeenCalledWith({ lat: 37.5, lon: 127 });
  });
});

describe('startArea', () => {
  const recent = [{ label: '마포구 망원동', lat: 37.556, lon: 126.905 }];
  test('gps first', () =>
    expect(startArea({ ok: true, lat: 1, lon: 2 }, recent)).toEqual({ center: { lat: 1, lon: 2 }, label: null, source: 'gps' }));
  test('then the last viewed area, even one found by current location (D45)', () => {
    const last = { label: '강서구 화곡동', lat: 37.541, lon: 126.84 };
    expect(startArea({ ok: false, reason: 'denied' }, recent, last)).toEqual({ center: { lat: 37.541, lon: 126.84 }, label: '강서구 화곡동', source: 'last' });
    expect(startArea({ ok: true, lat: 1, lon: 2 }, recent, last).source).toBe('gps');
  });
  test('then the most recent area', () =>
    expect(startArea({ ok: false, reason: 'denied' }, recent)).toEqual({ center: { lat: 37.556, lon: 126.905 }, label: '마포구 망원동', source: 'recent' }));
  test('then myeongdong', () =>
    expect(startArea({ ok: false, reason: 'timeout' }, [])).toEqual({ center: { lat: MYEONGDONG.lat, lon: MYEONGDONG.lon }, label: '중구 명동', source: 'default' }));
});

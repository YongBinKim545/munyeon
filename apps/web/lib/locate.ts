import type { Area } from './prefs';

/** 위치를 못 잡고 최근 지역도 없을 때의 시작점(D34). 공공데이터 주소에는 '명동1가·2가'로 들어 있어 고정 좌표로 둔다. */
export const MYEONGDONG: Area = { label: '중구 명동', lat: 37.5637, lon: 126.9838 };

export const LOCATE_TIMEOUT_MS = 8000;

export type LocateResult =
  | { ok: true; lat: number; lon: number }
  | { ok: false; reason: 'denied' | 'timeout' | 'unsupported' | 'error' };

/**
 * 현재 위치를 한 번 잡는다. 좌표는 브라우저 안에서만 쓴다(D21).
 * 권한 창을 띄운 채 기다리면 브라우저 타임아웃이 시작되지 않으므로 자체 타이머로 timeoutMs 뒤 'timeout'을 낸다.
 * 그 뒤에 위치가 잡히면 onLate로 알려준다(첫 방문에 권한 창을 늦게 허용한 경우).
 */
export function locate(timeoutMs = LOCATE_TIMEOUT_MS, onLate?: (pos: { lat: number; lon: number }) => void): Promise<LocateResult> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      resolve({ ok: false, reason: 'unsupported' });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve({ ok: false, reason: 'timeout' });
    }, timeoutMs);
    geo.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        if (settled) {
          onLate?.(pos);
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({ ok: true, ...pos });
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: err.code === 1 ? 'denied' : 'error' });
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: timeoutMs },
    );
  });
}

export type AreaSource = 'gps' | 'recent' | 'default';

/** 시작 지점: 현재 위치 → 최근 지역 → 명동(D34). gps일 때 이름은 목록 데이터를 받은 뒤 붙인다. */
export function startArea(result: LocateResult, recent: Area[]): { center: { lat: number; lon: number }; label: string | null; source: AreaSource } {
  if (result.ok) return { center: { lat: result.lat, lon: result.lon }, label: null, source: 'gps' };
  const r = recent[0];
  if (r) return { center: { lat: r.lat, lon: r.lon }, label: r.label, source: 'recent' };
  return { center: { lat: MYEONGDONG.lat, lon: MYEONGDONG.lon }, label: MYEONGDONG.label, source: 'default' };
}

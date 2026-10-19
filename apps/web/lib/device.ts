/** 위치 권한 안내에 쓸 기기 구분(D38). 모르면 'unknown'으로 모든 안내를 보여준다. */
export type DeviceKind = 'inapp' | 'ios' | 'android' | 'desktop' | 'unknown';

/** 카카오톡·네이버·인스타그램·페이스북·라인 앱 안의 브라우저 */
const IN_APP = /KAKAOTALK|NAVER\(inapp|NAVER|Instagram|FBAN|FBAV|Line\//i;

export function deviceKind(ua: string): DeviceKind {
  if (!ua) return 'unknown';
  if (IN_APP.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows NT|Macintosh|X11|CrOS/.test(ua)) return 'desktop';
  return 'unknown';
}

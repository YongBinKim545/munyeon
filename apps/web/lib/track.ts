'use client';

import { currentSource } from './source';

export type TrackType = 'tel_tap' | 'tel_copy' | 'directions_tap' | 'search_select' | 'locate_ok' | 'locate_fail' | 'show_all';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * 자체 이벤트(기관 ID·종류·페이지 종류만)를 보내고, GA4에도 같은 이름으로 남긴다.
 * 좌표·검색어·동네 이름은 보내지 않는다. 유입 경로는 큰 분류 값만 함께 보낸다(D72).
 */
export function track(type: TrackType, institutionId: string | null, page: string): void {
  try {
    const body = JSON.stringify({ type, institutionId, page, source: currentSource() });
    if (!navigator.sendBeacon?.('/api/events', body)) {
      void fetch('/api/events', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch {
    // 측정 실패는 사용자 동작을 막지 않는다
  }
  window.gtag?.('event', type, { page_type: page });
}

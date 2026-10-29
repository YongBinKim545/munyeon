'use client';

import { Navigation } from 'lucide-react';
import { useState } from 'react';
import { track } from '@/lib/track';

interface Props {
  institutionId: string;
  name: string;
  addr: string;
  lat: number | null;
  lon: number | null;
  page: string;
  compact?: boolean;
}

export type Device = 'pc' | 'android' | 'ios' | 'mobile';

export interface DirectionLink {
  label: string;
  href: string;
  /** 아이폰: 누르면 이 앱 주소를 먼저 열고, 앱이 안 열리면 href(웹)로 간다 */
  appUrl?: string;
}

const APP_FALLBACK_MS = 1500;

/**
 * 지도 뷰 대신 지도 앱 링크(D20·D77). 좌표가 있으면 기관 위치에 핀을 찍은 지도를 열고, 길찾기는 지도 쪽 [도착]으로 한다
 * (길찾기 화면으로 바로 열면 출발지가 비어 경로가 안 보였다).
 * 카카오는 웹 링크로 핀이 찍힌다. 네이버는 웹으로 핀을 찍을 수 없어(이름은 못 찾거나 여러 곳, 좌표는 휴대폰에서 결과 없음)
 * 휴대폰은 네이버 지도 앱으로 열고, 앱이 없거나 PC면 기관 근처에서 이름을 검색한다.
 * 좌표가 없으면 이름·주소 검색. 티맵은 휴대폰 앱이라 PC에서는 뺀다.
 */
export function directionLinks(name: string, addr: string, lat: number | null, lon: number | null, device: Device): DirectionLink[] {
  const q = encodeURIComponent(`${name} ${addr}`);
  if (lat === null || lon === null) {
    return [
      { label: '네이버지도', href: `https://map.naver.com/p/search/${q}` },
      { label: '카카오맵', href: `https://map.kakao.com/link/search/${q}` },
    ];
  }
  const n = encodeURIComponent(name);
  const naverWeb = `https://map.naver.com/p/search/${n}?c=${lon.toFixed(6)},${lat.toFixed(6)},17,0,0,0,dh`;
  const naverPlace = `place?lat=${lat.toFixed(7)}&lng=${lon.toFixed(7)}&name=${n}&appname=findmedi.co.kr`;
  const naver: DirectionLink =
    device === 'android'
      ? {
          label: '네이버지도',
          href:
            `intent://${naverPlace}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;` +
            `package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(naverWeb)};end`,
        }
      : device === 'ios'
        ? { label: '네이버지도', href: naverWeb, appUrl: `nmap://${naverPlace}` }
        : { label: '네이버지도', href: naverWeb };
  return [
    naver,
    { label: '카카오맵', href: `https://map.kakao.com/link/map/${n},${lat},${lon}` },
    ...(device === 'pc' ? [] : [{ label: '티맵(앱)', href: `tmap://route?goalname=${n}&goalx=${lon}&goaly=${lat}` }]),
  ];
}

/** PC(마우스) → 안드로이드 → 아이폰·아이패드(아이패드 사파리는 맥으로 알린다) */
export function deviceOf({ fine, ua, touchPoints }: { fine: boolean; ua: string; touchPoints: number }): Device {
  if (fine) return 'pc';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  return 'mobile';
}

/** 시트는 누른 뒤에만 그려지므로 브라우저에서만 부른다 */
function currentDevice(): Device {
  return deviceOf({
    fine: window.matchMedia?.('(pointer: fine) and (hover: hover)').matches ?? false,
    ua: navigator.userAgent,
    touchPoints: navigator.maxTouchPoints ?? 0,
  });
}

interface OpenEnv {
  go: (url: string) => void;
  doc: {
    readonly visibilityState: DocumentVisibilityState;
    addEventListener(type: 'visibilitychange', f: () => void): void;
    removeEventListener(type: 'visibilitychange', f: () => void): void;
  };
}

/**
 * 아이폰: 앱 주소를 열고, 잠시 뒤에도 이 화면이 보이면(앱이 안 열림) 웹으로 간다.
 * 앱이 열려 화면이 뒤로 가면 타이머를 끊어, 돌아왔을 때 웹이 겹쳐 열리지 않게 한다.
 */
export function openNaverApp(appUrl: string, webUrl: string, { go, doc }: OpenEnv = { go: (u) => window.location.assign(u), doc: document }) {
  const onHide = () => {
    if (doc.visibilityState !== 'hidden') return;
    clearTimeout(timer);
    doc.removeEventListener('visibilitychange', onHide);
  };
  const timer = setTimeout(() => {
    doc.removeEventListener('visibilitychange', onHide);
    if (doc.visibilityState === 'visible') go(webUrl);
  }, APP_FALLBACK_MS);
  doc.addEventListener('visibilitychange', onHide);
  go(appUrl);
}

export function DirectionsButton({ institutionId, name, addr, lat, lon, page, compact }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={compact ? 'btn btn-secondary btn-call--compact' : 'btn btn-secondary'} onClick={() => setOpen(true)}>
        <Navigation aria-hidden="true" size={16} /> 길찾기
      </button>
      {open ? (
        // 어두운 막으로 뒤 화면과 구분하고, 막을 누르면 닫는다
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="길찾기 앱 선택" onClick={(e) => e.stopPropagation()}>
            {directionLinks(name, addr, lat, lon, currentDevice()).map((l) => (
              <a
                key={l.label}
                href={l.href}
                // 앱 주소(intent·tmap)는 새 탭 없이 연다
                {...(l.href.startsWith('https:') ? { target: '_blank', rel: 'noopener' } : {})}
                onClick={(e) => {
                  track('directions_tap', institutionId, page);
                  if (!l.appUrl) return;
                  e.preventDefault();
                  openNaverApp(l.appUrl, l.href);
                }}
              >
                {l.label}
              </a>
            ))}
            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

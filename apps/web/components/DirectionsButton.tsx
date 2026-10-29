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

/**
 * 지도 뷰 대신 지도 앱 링크(D20). 좌표가 있으면 두 지도 모두 그 지점에 핀을 찍고, 길찾기는 지도 쪽 [도착]으로 한다
 * (길찾기 화면으로 바로 열면 출발지가 비어 경로가 안 보였다). 네이버는 이름 검색이 여러 곳을 띄우거나 못 찾아 좌표로 찾는다.
 * 좌표가 없으면 이름·주소 검색. 티맵은 휴대폰 앱이라 PC(마우스)에서는 뺀다.
 */
export function directionLinks(name: string, addr: string, lat: number | null, lon: number | null, pc: boolean) {
  const q = encodeURIComponent(`${name} ${addr}`);
  if (lat === null || lon === null) {
    return [
      { label: '네이버지도', href: `https://map.naver.com/p/search/${q}` },
      { label: '카카오맵', href: `https://map.kakao.com/link/search/${q}` },
    ];
  }
  return [
    { label: '네이버지도', href: `https://map.naver.com/p/search/${lat.toFixed(7)},${lon.toFixed(7)}` },
    { label: '카카오맵', href: `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lon}` },
    ...(pc ? [] : [{ label: '티맵(앱)', href: `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${lon}&goaly=${lat}` }]),
  ];
}

/** 마우스 기기(PC). 시트는 누른 뒤에만 그려지므로 브라우저에서만 부른다 */
function isPc(): boolean {
  return window.matchMedia?.('(pointer: fine) and (hover: hover)').matches ?? false;
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
            {directionLinks(name, addr, lat, lon, isPc()).map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener" onClick={() => track('directions_tap', institutionId, page)}>
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

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

/** 지도 뷰 대신 길찾기 딥링크(D20). 좌표가 없으면 주소 검색으로. */
export function directionLinks(name: string, addr: string, lat: number | null, lon: number | null) {
  const q = encodeURIComponent(`${name} ${addr}`);
  const hasGeo = lat !== null && lon !== null;
  return [
    { label: '네이버지도', href: `https://map.naver.com/p/search/${q}` },
    {
      label: '카카오맵',
      href: hasGeo
        ? `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lon}`
        : `https://map.kakao.com/link/search/${q}`,
    },
    ...(hasGeo
      ? [{ label: '티맵(앱)', href: `tmap://route?goalname=${encodeURIComponent(name)}&goalx=${lon}&goaly=${lat}` }]
      : []),
  ];
}

export function DirectionsButton({ institutionId, name, addr, lat, lon, page, compact }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={compact ? 'btn btn-secondary btn-call--compact' : 'btn btn-secondary'} onClick={() => setOpen(true)}>
        <Navigation aria-hidden="true" size={16} /> 길찾기
      </button>
      {open ? (
        <div className="sheet" role="dialog" aria-label="길찾기 앱 선택">
          {directionLinks(name, addr, lat, lon).map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener" onClick={() => track('directions_tap', institutionId, page)}>
              {l.label}
            </a>
          ))}
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(false)}>
            닫기
          </button>
        </div>
      ) : null}
    </>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Area } from '@/lib/prefs';
import type { Kind } from '@/lib/seo';

interface Props {
  /** null이면 위치를 찾는 중 */
  areaLabel: string | null;
  /** 현재 위치가 PC에서 잡혔을 때 안내 */
  pcLocationNote: boolean;
  locateDenied: boolean;
  recent: Area[];
  kind: Kind;
  mode: 'open' | 'all';
  onKind: (k: Kind) => void;
  onMode: (m: 'open' | 'all') => void;
  onPickArea: (a: Area) => void;
  onCurrentLocation: () => void;
  onOpenLocationSearch: () => void;
}

/**
 * 메인 전용 헤더(D31): 1줄 [지역 ▾], 2줄 [약국 ▾] [영업 중 ▾] [검색].
 * '유형'·'상태' 글자는 화면에 보이지 않고 화면 낭독기용 이름으로만 둔다.
 */
export function MainHeader(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const choose = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div className="main-header">
      <div className="area" ref={wrap}>
        <button
          type="button"
          id="area-button"
          className="area__button"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span aria-hidden="true">📍</span> <span className="area__label">{p.areaLabel ?? '위치 찾는 중…'}</span> <span aria-hidden="true">▾</span>
        </button>
        {menuOpen ? (
          <ul className="area__menu" aria-label="지역 선택">
            <li>
              <button type="button" onClick={choose(p.onOpenLocationSearch)}>
                위치 검색
              </button>
            </li>
            <li>
              <button type="button" onClick={choose(p.onCurrentLocation)}>
                현재 위치
              </button>
            </li>
            {p.recent.map((a) => (
              <li key={a.label}>
                <button type="button" onClick={choose(() => p.onPickArea(a))}>
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {p.locateDenied ? <p className="muted area__note">위치 권한이 꺼져 있어요. 브라우저 설정에서 켜 주세요</p> : null}
        {p.pcLocationNote ? <p className="muted area__note">PC는 위치가 부정확할 수 있어요</p> : null}
      </div>
      <div className="filters">
        <select aria-label="유형" className="select" value={p.kind} onChange={(e) => p.onKind(e.target.value as Kind)}>
          <option value="pharmacy">약국</option>
          <option value="hospital">병원</option>
        </select>
        <select aria-label="상태" className="select" value={p.mode} onChange={(e) => p.onMode(e.target.value as 'open' | 'all')}>
          <option value="open">영업 중</option>
          <option value="all">전체</option>
        </select>
        <Link className="btn btn-secondary" href="/search" prefetch={false}>
          검색
        </Link>
      </div>
    </div>
  );
}

'use client';

import { ChevronDown, LocateFixed, MapPin, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ListFilter } from '@/lib/nearby';

interface Props {
  /** null이면 위치를 찾는 중 */
  areaLabel: string | null;
  /** 현재 위치가 PC에서 잡혔을 때 안내 */
  pcLocationNote: boolean;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  onCurrentLocation: () => void;
  onOpenLocationSearch: () => void;
}

/**
 * 메인 전용 헤더(D31·D38·D41): 1줄 📍 지역 이름 + [위치 찾기 ▾](현재 위치 / 위치 검색), 2줄 [약국 ▾] [검색].
 * 유형은 약국 / 병원 / 소아과. '유형' 글자는 화면에 보이지 않고 화면 낭독기용 이름으로만 둔다.
 */
export function MainHeader(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      button.current?.focus();
    };
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
        <p className="area__label">
          <MapPin aria-hidden="true" size={18} className="area__pin" />
          <span>{p.areaLabel ?? '위치 찾는 중…'}</span>
        </p>
        <button
          ref={button}
          type="button"
          id="area-button"
          className="btn btn-secondary area__find"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          위치 찾기 <ChevronDown aria-hidden="true" size={16} />
        </button>
        {menuOpen ? (
          <ul className="area__menu" aria-label="위치 찾기">
            <li>
              <button type="button" onClick={choose(p.onCurrentLocation)}>
                <LocateFixed aria-hidden="true" size={18} /> 현재 위치
              </button>
            </li>
            <li>
              <button type="button" onClick={choose(p.onOpenLocationSearch)}>
                <Search aria-hidden="true" size={18} /> 위치 검색
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      {p.pcLocationNote ? <p className="muted area__note">PC는 위치가 부정확할 수 있어요</p> : null}
      <div className="filters">
        <span className="select-wrap">
          <select aria-label="유형" className="select" value={p.filter} onChange={(e) => p.onFilter(e.target.value as ListFilter)}>
            <option value="pharmacy">약국</option>
            <option value="hospital">병원</option>
            <option value="pediatric">소아과</option>
          </select>
          <ChevronDown aria-hidden="true" size={16} className="select-wrap__icon" />
        </span>
        <Link className="btn btn-secondary" href="/search" prefetch={false}>
          검색
        </Link>
      </div>
    </div>
  );
}

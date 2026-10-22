'use client';

import { ChevronDown, List, LocateFixed, MapPin, Search } from 'lucide-react';
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

/** 이만큼 넘게 한 방향으로 움직여야 숨기거나 보인다(조금 흔들릴 때 들락거리지 않게) */
export const HEADER_SCROLL_STEP = 12;
/** 맨 위에서 이 높이 안쪽이면 늘 보인다 */
export const HEADER_TOP_ZONE = 80;

/** 메인 헤더 2·3줄을 숨길지(D52): 아래로 내리면 숨기고 위로 올리면 보인다. 기준점은 방향이 바뀐 곳. */
export function nextHeaderState(s: { hidden: boolean; base: number }, y: number): { hidden: boolean; base: number } {
  if (y <= HEADER_TOP_ZONE) return { hidden: false, base: y };
  if (s.hidden) {
    if (y > s.base) return { hidden: true, base: y }; // 계속 내려가는 중
    return s.base - y > HEADER_SCROLL_STEP ? { hidden: false, base: y } : s;
  }
  if (y < s.base) return { hidden: false, base: y }; // 계속 올라가는 중
  return y - s.base > HEADER_SCROLL_STEP ? { hidden: true, base: y } : s;
}

/**
 * 메인 전용 헤더(D31·D38·D41·D52): 1줄 📍 지역 이름 + [위치 찾기 ▾](현재 위치 / 지역 검색 / 지역별 보기), 2줄 [약국 ▾] [검색].
 * 유형은 약국 / 병원 / 소아과. '유형' 글자는 화면에 보이지 않고 화면 낭독기용 이름으로만 둔다.
 * 사이트 헤더 바로 아래에 붙어 있고, 아래로 스크롤하면 숨었다가 위로 올리면 다시 나온다(메뉴가 열려 있으면 숨지 않음).
 */
export function MainHeader(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scroll, setScroll] = useState({ hidden: false, base: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScroll((s) => nextHeaderState(s, window.scrollY)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  const hidden = scroll.hidden && !menuOpen;

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
    <div className={hidden ? 'main-header main-header--hidden' : 'main-header'} inert={hidden}>
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
                <Search aria-hidden="true" size={18} /> 지역 검색
              </button>
            </li>
            <li>
              {/* 시도·시군구 목록 페이지로 간다(D52) */}
              <Link href="/regions" onClick={() => setMenuOpen(false)}>
                <List aria-hidden="true" size={18} /> 지역별 보기
              </Link>
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

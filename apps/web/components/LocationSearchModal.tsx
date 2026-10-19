'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatArea } from '@/lib/nearby';
import type { Area } from '@/lib/prefs';
import { decodeNeighborhoods, matchNeighborhoods, MIN_QUERY, normalizeQuery, type NeighborhoodItem, type NeighborhoodPayload } from '@/lib/search';
import { track } from '@/lib/track';

let neighborhoodsPending: Promise<NeighborhoodItem[]> | null = null;

/** 동네 목록 JSON은 모달을 처음 열 때 한 번만 받는다(CDN 하루 캐시). */
function loadNeighborhoods(): Promise<NeighborhoodItem[]> {
  neighborhoodsPending ??= fetch('/api/neighborhoods')
    .then((r) => (r.ok ? (r.json() as Promise<NeighborhoodPayload>) : Promise.reject(new Error(String(r.status)))))
    .then(decodeNeighborhoods)
    .catch(() => {
      neighborhoodsPending = null;
      return [];
    });
  return neighborhoodsPending;
}

export function areaOfNeighborhood(n: NeighborhoodItem): Area | null {
  if (n.lat === null || n.lon === null) return null;
  return { label: formatArea(n.sido, n.sigungu, n.isSigungu ? null : n.name), lat: n.lat, lon: n.lon };
}

interface Props {
  onPick: (a: Area) => void;
  onClose: () => void;
}

/**
 * 위치 검색 모달(D33). 휴대폰은 화면 전체, 태블릿·PC는 가운데.
 * 열 때 브라우저 기록에 한 칸을 넣어 휴대폰 뒤로 가기가 모달만 닫게 한다.
 * 닫기 버튼·Esc·선택은 history.back()으로 그 한 칸을 되돌리고, popstate에서 닫는다.
 */
export function LocationSearchModal({ onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<NeighborhoodItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const picked = useRef<Area | null>(null);
  const closeRef = useRef(onClose);
  const pickRef = useRef(onPick);
  useEffect(() => {
    closeRef.current = onClose;
    pickRef.current = onPick;
  }, [onClose, onPick]);

  useEffect(() => {
    // 개발 모드의 effect 두 번 실행에도 기록이 한 칸만 늘게 한다
    if ((history.state as { modal?: string } | null)?.modal !== 'location') history.pushState({ modal: 'location' }, '');
    const onPop = () => {
      const a = picked.current;
      if (a) pickRef.current(a);
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    inputRef.current?.focus();
    void loadNeighborhoods().then(setList);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const term = normalizeQuery(q);
  const results = useMemo(
    () => (list ? matchNeighborhoods(list, term, 20).filter((n) => n.lat !== null && n.lon !== null) : []),
    [list, term],
  );

  const close = () => history.back();

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="위치 검색"
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      >
        <div className="modal__head">
          <label className="sr-only" htmlFor="area-q">
            동네 이름
          </label>
          <input
            ref={inputRef}
            id="area-q"
            type="search"
            className="search__input"
            placeholder="동네 이름 (예: 망원동, 강남구)"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={close}>
            닫기
          </button>
        </div>
        {term.length >= MIN_QUERY && list && results.length === 0 ? <p className="muted">찾는 동네가 없어요</p> : null}
        <ul className="search__list">
          {results.map((n) => {
            const area = areaOfNeighborhood(n);
            return (
              <li key={`${n.sido}/${n.sigungu}/${n.name}`}>
                <button
                  type="button"
                  className="row-btn"
                  onClick={() => {
                    picked.current = area;
                    track('search_select', null, 'location');
                    close();
                  }}
                >
                  {n.name} <span className="muted">· {n.isSigungu ? n.sido : `${n.sido} ${n.sigungu}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

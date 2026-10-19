'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatArea } from '@/lib/nearby';
import type { Area } from '@/lib/prefs';
import { decodeNeighborhoods, matchNeighborhoods, MIN_QUERY, normalizeQuery, type NeighborhoodItem, type NeighborhoodPayload } from '@/lib/search';
import { track } from '@/lib/track';
import { useModal } from '@/lib/useModal';

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
  /** 최근 고른 지역(최대 3개). 검색창이 비어 있을 때 보여준다(D38) */
  recent: Area[];
  onPick: (a: Area) => void;
  onClose: () => void;
}

/**
 * 위치 검색 모달(D33·D38). 휴대폰은 화면 전체, 태블릿·PC는 가운데.
 * 뒤로 가기·Esc·Tab 동작은 useModal. 고른 지역은 모달이 닫힌 뒤(popstate) onPick으로 넘긴다.
 */
export function LocationSearchModal({ recent, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<NeighborhoodItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { dialogRef, close } = useModal<Area>('location', (picked) => {
    if (picked) onPick(picked);
    onClose();
  });

  useEffect(() => {
    inputRef.current?.focus();
    void loadNeighborhoods().then(setList);
  }, []);

  const term = normalizeQuery(q);
  const results = useMemo(
    () => (list ? matchNeighborhoods(list, term, 20).filter((n) => n.lat !== null && n.lon !== null) : []),
    [list, term],
  );

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="위치 검색">
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
          <button type="button" className="btn btn-secondary" onClick={() => close()}>
            <X aria-hidden="true" size={18} /> 닫기
          </button>
        </div>
        {term.length === 0 && recent.length > 0 ? (
          <section aria-label="최근 지역">
            <h2 className="search__title">최근 지역</h2>
            <ul className="search__list">
              {recent.map((a) => (
                <li key={a.label}>
                  <button type="button" className="row-btn" onClick={() => close(a)}>
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
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
                    track('search_select', null, 'location');
                    if (area) close(area);
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

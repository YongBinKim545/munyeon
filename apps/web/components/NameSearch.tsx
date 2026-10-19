'use client';

import { distanceM, gridKey, gridOf, toTelHref } from '@munyeon/core';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { readLastCenter } from '@/lib/prefs';
import { MIN_QUERY, normalizeQuery } from '@/lib/search';
import { institutionPath, type Kind } from '@/lib/seo';
import { track } from '@/lib/track';
import { formatDistance } from './InstitutionCard';

interface Hit {
  id: string;
  kind: Kind;
  name: string;
  sido: string | null;
  sigungu: string | null;
  tel: string | null;
  lat: number | null;
  lon: number | null;
  badge: string;
}

export const DEBOUNCE_MS = 300;

/**
 * 상호 검색(D33): 병원·약국 이름만 찾는다. 결과는 메인에서 보던 지역에서 가까운 순.
 * 서버에는 검색어와 약 5km 격자 번호만 보내고(D21), 거리는 브라우저에서 계산한다.
 * 검색어는 주소(?q=)에 남겨 상세에서 뒤로 가기로 돌아와도 결과가 유지된다. 서버에는 저장하지 않는다.
 */
export function NameSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    // 저장값은 브라우저에만 있으므로 하이드레이션 뒤에 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCenter(readLastCenter());
  }, []);

  const term = normalizeQuery(q);
  useEffect(() => {
    router.replace(term ? `${pathname}?q=${encodeURIComponent(term)}` : pathname, { scroll: false });
    if (term.length < MIN_QUERY) return;
    const ctrl = new AbortController();
    const g = center ? `&g=${gridKey(gridOf(center.lat, center.lon))}` : '';
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}${g}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ items: Hit[] }>) : { items: [] }))
        .then((d) => setHits(d.items))
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, center, router, pathname]);

  const rows = useMemo(
    () =>
      term.length < MIN_QUERY || !hits
        ? []
        : hits
            .map((h, i) => ({
              ...h,
              i,
              distance: center && h.lat !== null && h.lon !== null ? distanceM(center, { lat: h.lat, lon: h.lon }) : null,
            }))
            // 서버는 격자 중심 기준이라, 보던 중심 기준으로 다시 정렬한다(거리 없는 곳은 뒤, 같으면 서버 순서)
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.i - b.i),
    [hits, center, term],
  );

  return (
    <div className="search" role="search">
      <label className="sr-only" htmlFor="name-q">
        병원·약국 이름
      </label>
      <input
        id="name-q"
        type="search"
        className="search__input"
        placeholder="병원·약국 이름 (예: 온누리약국)"
        autoComplete="off"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {term.length >= MIN_QUERY && hits && rows.length === 0 ? <p className="muted">찾는 병원·약국이 없어요</p> : null}
      <ul className="search__list">
        {rows.map((h) => {
          const tel = h.tel ? toTelHref(h.tel) : null;
          return (
            <li key={h.id} className="search__row">
              <Link href={institutionPath(h.kind, h.id)} onClick={() => track('search_select', h.id, 'search')}>
                {h.name}{' '}
                <span className="muted">
                  {[h.badge, h.sigungu, h.distance !== null ? formatDistance(h.distance) : null].filter(Boolean).join(' · ')}
                </span>
              </Link>
              {tel ? (
                <a className="icon-btn" href={tel} aria-label={`${h.name} 전화`} onClick={() => track('tel_tap', h.id, 'search')}>
                  ☎
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

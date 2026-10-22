'use client';

import { distanceM, gridKey, gridOf, toTelHref, type RawHours } from '@munyeon/core';
import { Phone } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { hasPreviousPage } from '@/lib/navHistory';
import { readLastCenter } from '@/lib/prefs';
import { MIN_QUERY, normalizeQuery } from '@/lib/search';
import type { Kind } from '@/lib/seo';
import { track } from '@/lib/track';
import { formatDistance } from './InstitutionCard';
import { PreviewLink } from './PreviewLink';
import { SearchPanel } from './SearchPanel';

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
  /** 이전 배포의 캐시된 응답에는 없을 수 있다 */
  hours?: RawHours;
}

/**
 * 상호 검색(D33·D43): 병원·약국 이름만 찾는다. 결과는 메인에서 보던 지역에서 가까운 순.
 * 서버에는 검색어와 약 5km 격자 번호만 보내고(D21), 거리는 브라우저에서 계산한다.
 * [검색]·엔터로만 찾는다. 검색어는 주소(?q=)에 남겨 상세에서 뒤로 가기로 돌아오면 다시 찾는다. 서버에는 저장하지 않는다.
 */
export function NameSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  /** [검색]을 눌렀을 때의 검색어(주소에서 왔으면 그 값) */
  const [term, setTerm] = useState(() => normalizeQuery(params.get('q') ?? ''));
  const [result, setResult] = useState<{ key: string; hits: Hit[] } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    // 저장값은 브라우저에만 있으므로 하이드레이션 뒤에 읽는다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCenter(readLastCenter());
  }, []);

  const g = center ? `&g=${gridKey(gridOf(center.lat, center.lon))}` : '';
  const requestUrl = term.length >= MIN_QUERY ? `/api/search?q=${encodeURIComponent(term)}${g}` : null;
  useEffect(() => {
    if (!requestUrl) return;
    const ctrl = new AbortController();
    fetch(requestUrl, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: Hit[] }>) : { items: [] }))
      .then((d) => setResult({ key: requestUrl, hits: d.items }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [requestUrl]);

  const hits = result && result.key === requestUrl ? result.hits : null;
  const loading = !!requestUrl && !hits;

  const submit = () => {
    const t = normalizeQuery(q);
    setTerm(t);
    router.replace(t ? `${pathname}?q=${encodeURIComponent(t)}` : pathname, { scroll: false });
  };

  const rows = useMemo(
    () =>
      !hits
        ? []
        : hits
            .map((h, i) => ({
              ...h,
              i,
              distance: center && h.lat !== null && h.lon !== null ? distanceM(center, { lat: h.lat, lon: h.lon }) : null,
            }))
            // 서버는 격자 중심 기준이라, 보던 중심 기준으로 다시 정렬한다(거리 없는 곳은 뒤, 같으면 서버 순서)
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.i - b.i),
    [hits, center],
  );

  return (
    <SearchPanel
      inputId="name-q"
      label="병원·약국 이름"
      placeholder="병원·약국 이름 (예: 온누리약국)"
      autoFocus
      value={q}
      onChange={setQ}
      onSubmit={submit}
      // 직전 화면이 있으면 그리로, 주소로 바로 들어왔으면 메인으로
      onClose={() => (hasPreviousPage() ? router.back() : router.push('/'))}
      loading={loading}
    >
      {term.length > 0 && term.length < MIN_QUERY ? <p className="muted">두 글자 이상 입력하세요</p> : null}
      {hits && rows.length === 0 ? <p className="muted">찾는 병원·약국이 없어요</p> : null}
      <ul className="search__list">
        {rows.map((h) => {
          const tel = h.tel ? toTelHref(h.tel) : null;
          return (
            <li key={h.id} className="search__row">
              <PreviewLink
                // 누르는 즉시 가진 정보로 상세를 그린다(D51)
                preview={{
                  kind: h.kind, id: h.id, name: h.name, badge: h.badge, pediatric: false, tel: h.tel, hours: h.hours ?? null,
                  sido: h.sido, sigungu: h.sigungu, area: [h.sido, h.sigungu].filter(Boolean).join(' '), lat: h.lat, lon: h.lon, holidays: [],
                }}
                onClick={() => track('search_select', h.id, 'search')}
              >
                {h.name}{' '}
                <span className="muted">
                  {[h.badge, h.sigungu, h.distance !== null ? formatDistance(h.distance) : null].filter(Boolean).join(' · ')}
                </span>
              </PreviewLink>
              {tel ? (
                <a className="icon-btn" href={tel} aria-label={`${h.name} 전화`} onClick={() => track('tel_tap', h.id, 'search')}>
                  <Phone aria-hidden="true" size={20} />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </SearchPanel>
  );
}

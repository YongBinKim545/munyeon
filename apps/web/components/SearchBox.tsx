'use client';

import { toTelHref } from '@munyeon/core';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { decodeNeighborhoods, matchNeighborhoods, MIN_QUERY, normalizeQuery, type NeighborhoodItem, type NeighborhoodPayload } from '@/lib/search';
import { institutionPath, KIND_LABEL, regionPath, type Kind } from '@/lib/seo';
import { track } from '@/lib/track';

interface Hit {
  id: string;
  kind: Kind;
  name: string;
  sido: string | null;
  sigungu: string | null;
  tel: string | null;
  badge: string;
}

interface Recent {
  label: string;
  href: string;
}

const RECENT_KEY = 'munyeon:recent';
const DEBOUNCE_MS = 300;

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Recent[];
  } catch {
    return [];
  }
}

function saveRecent(r: Recent) {
  try {
    const next = [r, ...readRecent().filter((x) => x.href !== r.href)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 저장 실패는 무시(사생활 보호 모드 등)
  }
}

function dongHref(n: NeighborhoodItem, kind: Kind): string {
  const base = regionPath(n.sido, n.sigungu, kind, 'all');
  return n.isSigungu ? base : `${base}?동=${encodeURIComponent(n.name)}`;
}

/** 통합 검색(D25): 동네는 브라우저 안에서, 병원·약국 이름은 /api/search. 검색어는 서버에 저장하지 않는다. */
export function SearchBox({ autoFocus }: { autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodItem[] | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const loading = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readRecent());
    if (autoFocus || new URLSearchParams(window.location.search).get('search') === '1') inputRef.current?.focus();
  }, [autoFocus]);

  const loadNeighborhoods = () => {
    if (neighborhoods || loading.current) return;
    loading.current = true;
    fetch('/api/neighborhoods')
      .then((r) => r.json() as Promise<NeighborhoodPayload>)
      .then((p) => setNeighborhoods(decodeNeighborhoods(p)))
      .catch(() => { loading.current = false; });
  };

  const term = normalizeQuery(q);
  const dongs = useMemo(() => (neighborhoods ? matchNeighborhoods(neighborhoods, term) : []), [neighborhoods, term]);

  useEffect(() => {
    if (term.length < MIN_QUERY) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ items: Hit[] }>) : { items: [] }))
        .then((d) => setHits(d.items))
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const select = (label: string, href: string) => {
    saveRecent({ label, href });
    track('search_select', null, 'search');
  };

  return (
    <div className="search" role="search">
      <label className="sr-only" htmlFor="q">
        동네 또는 병원·약국 이름
      </label>
      <input
        ref={inputRef}
        id="q"
        type="search"
        className="search__input"
        placeholder="동네 또는 병원·약국 이름 (예: 망원동)"
        autoComplete="off"
        value={q}
        onFocus={loadNeighborhoods}
        onChange={(e) => setQ(e.target.value)}
      />

      {term.length < MIN_QUERY && recent.length > 0 ? (
        <div className="chips" aria-label="최근 검색">
          {recent.map((r) => (
            <Link key={r.href} className="chip" href={r.href}>
              {r.label}
            </Link>
          ))}
        </div>
      ) : null}

      {dongs.length > 0 ? (
        <section className="search__group">
          <h2 className="search__title">동네</h2>
          <ul className="search__list">
            {dongs.map((n) => (
              <li key={`${n.sido}/${n.sigungu}/${n.name}`} className="search__row">
                <span>
                  {n.name} <span className="muted">{n.isSigungu ? n.sido : `${n.sido} ${n.sigungu}`}</span>
                </span>
                <span className="search__kinds">
                  {(['pharmacy', 'hospital'] as Kind[]).map((k) => (
                    <Link key={k} className="chip" href={dongHref(n, k)} onClick={() => select(`${n.name} ${KIND_LABEL[k]}`, dongHref(n, k))}>
                      {KIND_LABEL[k]}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hits.length > 0 ? (
        <section className="search__group">
          <h2 className="search__title">병원·약국</h2>
          <ul className="search__list">
            {hits.map((h) => {
              const tel = h.tel ? toTelHref(h.tel) : null;
              return (
                <li key={h.id} className="search__row">
                  <Link href={institutionPath(h.kind, h.id)} onClick={() => select(h.name, institutionPath(h.kind, h.id))}>
                    {h.name} <span className="muted">{`${h.badge} · ${h.sigungu ?? ''}`}</span>
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
        </section>
      ) : null}
    </div>
  );
}

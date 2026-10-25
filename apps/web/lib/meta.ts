'use client';

import { useEffect, useState } from 'react';

export interface SiteMeta {
  holidays: string[];
  lastSync: { hospital: string | null; pharmacy: string | null };
}

let pending: Promise<SiteMeta | null> | null = null;

/** /api/meta를 페이지당 한 번만 받는다. 실패하면 null(페이지에 넣어 둔 값을 계속 쓴다). */
export function fetchMeta(): Promise<SiteMeta | null> {
  const p = (pending ??= fetch('/api/meta')
    .then((r) => (r.ok ? (r.json() as Promise<SiteMeta>) : null))
    .catch(() => null));
  // 실패는 기억하지 않아 다음 호출에서 다시 받는다
  void p.then((m) => {
    if (!m && pending === p) pending = null;
  });
  return p;
}

export function useMeta(): SiteMeta | null {
  const [meta, setMeta] = useState<SiteMeta | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchMeta().then((m) => alive && setMeta(m));
    return () => {
      alive = false;
    };
  }, []);
  return meta;
}

/** '10월 25일 오후 2시 5분' (KST). 실제 마지막 갱신 시각 표시용(P0-13) */
export function formatKst(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3_600_000);
  const h = k.getUTCHours();
  const m = k.getUTCMinutes();
  const hour = h === 0 ? '밤 12시' : h < 12 ? `오전 ${h}시` : h === 12 ? '낮 12시' : `오후 ${h - 12}시`;
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${hour}${m ? ` ${m}분` : ''}`;
}

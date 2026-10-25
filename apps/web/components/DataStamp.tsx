'use client';

import { formatKst, useMeta } from '@/lib/meta';

/**
 * "국립중앙의료원 자료 · 10월 25일 오후 2시 기준"(P0-13: '매시간' 같은 고정 문구 대신 실제 마지막 갱신 시각). 서버 HTML에는 페이지를 만든 때의 값이 들어가고,
 * 브라우저가 /api/meta로 최근 동기화 시각을 받아 바꾼다(7일 캐시 페이지 대응).
 */
export function DataStamp({ kind, initial }: { kind: 'hospital' | 'pharmacy'; initial: string | null }) {
  const meta = useMeta();
  const iso = meta?.lastSync[kind] ?? initial;
  if (!iso) return null;
  return <>{`국립중앙의료원 자료 · ${formatKst(new Date(iso))} 기준`}</>;
}

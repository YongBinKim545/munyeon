'use client';

import { formatKst, useMeta } from '@/lib/meta';

/**
 * "데이터 기준: YYYY-MM-DD HH:mm". 서버 HTML에는 페이지를 만든 때의 값이 들어가고,
 * 브라우저가 /api/meta로 최근 동기화 시각을 받아 바꾼다(7일 캐시 페이지 대응).
 */
export function DataStamp({ kind, initial }: { kind: 'hospital' | 'pharmacy'; initial: string | null }) {
  const meta = useMeta();
  const iso = meta?.lastSync[kind] ?? initial;
  if (!iso) return null;
  return <>{`데이터 기준: ${formatKst(new Date(iso))}`}</>;
}

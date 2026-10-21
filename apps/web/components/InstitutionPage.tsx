import { DAY_LABELS, formatRange, hasAnyHours, parseWeeklyHours } from '@munyeon/core';
import type { Kind } from '@munyeon/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { loadHolidays, loadInstitution, loadLastSync, loadNearby } from '@/lib/data';
import { institutionPath, SITE_URL } from '@/lib/seo';
import { InstitutionView, NearbyList, NearbyPending } from './InstitutionView';

/** 근처 기관은 거리 계산 쿼리라 느리다. 기관 정보를 먼저 보내고 이 구역은 나중에 보낸다(D45). */
async function NearbySection({ kind, id }: { kind: Kind; id: string }) {
  return <NearbyList kind={kind} items={await loadNearby(kind, id)} />;
}

/** 기관 상세 메타데이터: 제목·설명·canonical, 진료시간이 없거나 비활성이면 noindex(D6) */
export async function institutionMetadata(kind: Kind, id: string): Promise<Metadata> {
  const rec = await loadInstitution(kind, id);
  if (!rec) return { title: '찾을 수 없는 기관', robots: { index: false } };
  const week = parseWeeklyHours(rec.hours);
  const label = kind === 'pharmacy' ? '영업시간' : '진료시간';
  const summary = `${DAY_LABELS[7]} ${formatRange(week[7])}, ${DAY_LABELS[8]} ${formatRange(week[8])}`;
  const indexable = rec.isActive && hasAnyHours(week);
  return {
    title: `${rec.name} ${label} · 일요일·공휴일`,
    description: `${rec.addr}. ${summary}.${rec.tel ? ` 전화 ${rec.tel}.` : ''} 방문 전 전화로 확인하세요.`,
    alternates: { canonical: institutionPath(kind, rec.id) },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export async function InstitutionPage({ kind, id }: { kind: Kind; id: string }) {
  const rec = await loadInstitution(kind, id);
  if (!rec) notFound();
  const [holidays, lastSyncAt] = await Promise.all([loadHolidays(), loadLastSync(kind)]);
  const nearby = (
    <Suspense fallback={<NearbyPending kind={kind} />}>
      <NearbySection kind={kind} id={rec.id} />
    </Suspense>
  );
  return (
    <InstitutionView rec={rec} nearby={nearby} holidays={holidays} lastSyncAt={lastSyncAt} url={SITE_URL + institutionPath(kind, rec.id)} />
  );
}

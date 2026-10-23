import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionPage, regionMetadata } from '@/components/RegionPage';
import { parseRegionParams } from '@/lib/seo';

// 하루 캐시(D23). 워커가 이 지역 기관의 변경을 알리면 바로 갱신하고(D68), 배포 직후 미리 만든다(D68)
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ sido: string; sigungu: string }> };

/** 지역 화면 — 약국(D69) */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = parseRegionParams(await params);
  if (!r?.sigungu) return { robots: { index: false } };
  return regionMetadata(r.sido, r.sigungu, 'pharmacy');
}

export default async function SigunguPage({ params }: Props) {
  const r = parseRegionParams(await params);
  if (!r?.sigungu) notFound();
  return <RegionPage sido={r.sido} sigungu={r.sigungu} kind="pharmacy" />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionPage, regionMetadata } from '@/components/RegionPage';
import { parseRegionParams } from '@/lib/seo';

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ sido: string; sigungu: string; kind: string }> };

/** 지역 화면 — 병원(D69). 유형 조각은 '병원'만(옛 /…/약국은 next.config에서 301) */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = parseRegionParams(await params);
  if (!r?.sigungu || r.kind !== 'hospital') return { robots: { index: false } };
  return regionMetadata(r.sido, r.sigungu, 'hospital');
}

export default async function SigunguHospitalPage({ params }: Props) {
  const r = parseRegionParams(await params);
  if (!r?.sigungu || r.kind !== 'hospital') notFound();
  return <RegionPage sido={r.sido} sigungu={r.sigungu} kind="hospital" />;
}

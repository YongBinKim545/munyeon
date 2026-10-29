import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionPage, regionMetadata } from '@/components/RegionPage';
import { parseRegionParams } from '@/lib/seo';

// 7일 캐시(D80). 서버 HTML은 요약·이름순 목록뿐이고 목록·상태는 브라우저가 /api/region에서 받는다
export const revalidate = 604800;
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

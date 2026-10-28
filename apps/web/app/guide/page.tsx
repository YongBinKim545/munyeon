import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { guidePath, publishedGuides } from '@/lib/guide';
import { openGraphFor } from '@/lib/seo';

const TITLE = '가이드 — 야간·휴일 병원·약국 찾는 법';
const DESCRIPTION = '휴일지킴이약국·달빛어린이병원·상비약처럼 밤과 휴일에 알아 두면 좋은 제도와 찾는 순서를 정리했어요.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/guide' },
  openGraph: openGraphFor('/guide', TITLE, DESCRIPTION),
};

/** 가이드 목록(P0-12, D74). 게시된 글이 없으면 페이지도 없다 */
export default function GuideIndex() {
  const guides = publishedGuides();
  if (guides.length === 0) notFound();
  return (
    <main className="container">
      <Breadcrumbs items={[{ name: '가이드', href: '/guide' }]} />
      <h1>가이드</h1>
      <ul className="guide-list">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={guidePath(g.slug)}>{g.title}</Link>
            <p className="muted">{g.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { buildGuideJsonLd, guideDateLabel, guidePath, publishedGuides, type Guide } from '@/lib/guide';
import { serializeJsonLd } from '@/lib/jsonld';
import { openGraphFor, safeDecode, SITE_URL } from '@/lib/seo';

// 글은 배포 때만 바뀐다. 빌드 때 모두 만들고 그 밖의 주소는 404
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedGuides().map((g) => ({ slug: g.slug }));
}

async function find(params: Promise<{ slug: string }>): Promise<Guide | undefined> {
  const slug = safeDecode((await params).slug);
  return publishedGuides().find((g) => g.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = await find(params);
  if (!g) return {};
  const path = guidePath(g.slug);
  return { title: g.title, description: g.description, alternates: { canonical: path }, openGraph: openGraphFor(path, g.title, g.description) };
}

/** 가이드 글(P0-12, D74): 첫 문단에 답, 소제목, 맨 아래 출처·기준일 */
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = await find(params);
  if (!g) notFound();
  const path = guidePath(g.slug);
  return (
    <main className="container guide">
      <Breadcrumbs items={[{ name: '가이드', href: '/guide' }, { name: g.title, href: path }]} />
      <article>
        <h1>{g.title}</h1>
        <p className="guide__answer" dangerouslySetInnerHTML={{ __html: g.answerHtml }} />
        <div dangerouslySetInnerHTML={{ __html: g.html }} />
        <h2>출처</h2>
        <ul className="guide__sources">
          {g.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener">
                {s.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="muted">기준일 {guideDateLabel(g.updated)}</p>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildGuideJsonLd(g, SITE_URL + path, SITE_URL)) }} />
    </main>
  );
}

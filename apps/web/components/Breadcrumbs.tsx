import Link from 'next/link';
import { serializeJsonLd } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/seo';

export interface Crumb {
  name: string;
  href: string;
}

/** 경로 표시 + BreadcrumbList 구조화 데이터. 마지막 항목은 현재 페이지. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ name: '홈', href: '/' }, ...items];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE_URL + c.href })),
  };
  return (
    <nav className="breadcrumbs" aria-label="경로">
      <ol>
        {all.map((c, i) => (
          <li key={c.href}>{i < all.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </nav>
  );
}

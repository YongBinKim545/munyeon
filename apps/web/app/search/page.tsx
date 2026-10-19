import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NameSearch } from '@/components/NameSearch';

// 상호 검색(D33). 검색 결과 페이지는 색인하지 않는다(robots도 /search 제외).
export const metadata: Metadata = { title: '병원·약국 이름 검색', robots: { index: false, follow: true } };

export default function SearchPage() {
  return (
    <main className="container">
      <h1>병원·약국 이름 검색</h1>
      <Suspense fallback={null}>
        <NameSearch />
      </Suspense>
    </main>
  );
}

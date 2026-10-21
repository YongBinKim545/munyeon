import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NameSearch } from '@/components/NameSearch';

// 상호 검색(D33). 검색 결과 페이지는 색인하지 않는다(robots도 /search 제외).
export const metadata: Metadata = { title: '병원·약국 이름 검색', robots: { index: false, follow: true } };

/** 페이지는 그대로 두되 위치 검색 모달과 같은 모양으로 그린다(D43): 휴대폰 화면 전체, PC 가운데 창 */
export default function SearchPage() {
  return (
    <main className="modal-backdrop">
      <div className="modal">
        <h1 className="sr-only">병원·약국 이름 검색</h1>
        <Suspense fallback={null}>
          <NameSearch />
        </Suspense>
      </div>
    </main>
  );
}

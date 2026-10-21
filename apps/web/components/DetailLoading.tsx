'use client';

import { useParams } from 'next/navigation';
import { readPreview } from '@/lib/detailPreview';
import { safeDecode, type Kind } from '@/lib/seo';
import { DetailPreview } from './DetailPreview';

/**
 * 기관 상세를 처음 만드는 동안(ISR 첫 요청, 몇 초 걸릴 수 있다) 바로 보이는 화면.
 * 메인 목록·이름 검색에서 눌러 왔으면 그 정보로 상세를 즉시 그리고(D45), 아니면 틀과 안내 문구만 보여준다.
 */
export function DetailLoading({ kind }: { kind: Kind }) {
  const params = useParams<{ id?: string }>();
  const id = params?.id ? safeDecode(params.id) : null;
  const preview = id ? readPreview(kind, id) : null;
  if (preview) return <DetailPreview p={preview} />;
  return (
    <main className="container container--wide">
      <div className="detail-loading" role="status">
        <div className="skeleton skeleton--title" aria-hidden="true" />
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton skeleton--short" aria-hidden="true" />
        <p className="muted">정보를 불러오고 있어요…</p>
      </div>
    </main>
  );
}

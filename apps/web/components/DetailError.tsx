'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { startTransition, useEffect } from 'react';
import { markDetailReady, useStoredPreview } from '@/lib/instantDetail';
import { DetailPreview } from './DetailPreview';

/**
 * 기관 상세를 만들다 DB 조회가 끝내 실패했을 때(D50). 실패한 화면은 캐시되지 않으므로 다시 시도하면 새로 만든다.
 * 서버 컴포넌트 오류라 reset만으로는 다시 받지 않아 refresh를 함께 부른다.
 * 목록에서 눌러 왔으면(D51) 그때 가진 정보로 상세를 그대로 보여 주고 한 줄로만 알린다. Next가 실패한 이동을
 * 페이지 통째 불러오기로 바꾸는 일이 있어, 미리보기는 탭에 남겨 둔 것을 읽는다.
 */
export function DetailError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const preview = useStoredPreview(pathname);
  // 바로 보여 주던 덮개를 걷는다(이 화면이 대신 그린다)
  useEffect(() => {
    if (pathname) markDetailReady(pathname);
  }, [pathname]);
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  if (preview) return <DetailPreview p={preview} failed onRetry={retry} />;
  return (
    <main className="container">
      <h1>정보를 불러오지 못했어요</h1>
      <p>잠시 뒤 다시 시도해 주세요. 계속 안 되면 메인에서 다른 곳을 찾아보세요.</p>
      <p className="actions">
        <button type="button" className="btn btn-secondary" onClick={retry}>
          다시 시도
        </button>
        <Link className="btn btn-secondary" href="/">
          메인으로
        </Link>
      </p>
    </main>
  );
}

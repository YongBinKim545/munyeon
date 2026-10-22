'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

/**
 * 기관 상세를 만들다 DB 조회가 끝내 실패했을 때(D50). 실패한 화면은 캐시되지 않으므로 다시 시도하면 새로 만든다.
 * 서버 컴포넌트 오류라 reset만으로는 다시 받지 않아 refresh를 함께 부른다.
 */
export function DetailError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
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

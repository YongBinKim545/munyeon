import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container">
      <h1>페이지를 찾을 수 없어요</h1>
      <p>주소가 바뀌었거나 없는 기관이에요. 메인에서 가까운 곳을 보거나 이름으로 다시 찾아보세요.</p>
      <p className="actions">
        <Link className="btn btn-secondary" href="/">
          메인으로
        </Link>
        <Link className="btn btn-secondary" href="/search">
          병원·약국 이름 검색
        </Link>
      </p>
    </main>
  );
}

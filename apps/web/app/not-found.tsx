import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container">
      <h1>페이지를 찾을 수 없어요</h1>
      <p>주소가 바뀌었거나 없는 기관이에요. 동네나 이름으로 다시 찾아보세요.</p>
      <p>
        <Link className="btn btn-secondary" href="/?search=1">
          동네·병원·약국 검색
        </Link>
      </p>
    </main>
  );
}

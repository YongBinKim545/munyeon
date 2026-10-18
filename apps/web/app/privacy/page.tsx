import type { Metadata } from 'next';

export const metadata: Metadata = { title: '개인정보처리방침', alternates: { canonical: '/privacy' } };

export default function Privacy() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '공개 전 기재';
  return (
    <main className="container">
      <h1>개인정보처리방침</h1>
      <p className="muted">시행일: 2026-11-20</p>
      <p>지금문연(이하 &lsquo;서비스&rsquo;)은 회원가입이 없으며, 이용자를 식별할 수 있는 개인정보를 수집하지 않도록 설계했습니다.</p>

      <h2>1. 수집하는 정보</h2>
      <ul>
        <li>이용 통계: 전화 버튼·길찾기·검색 결과 선택이 일어난 기관 ID, 페이지 종류, 분 단위 시각. IP 주소·기기 정보·위치는 함께 저장하지 않습니다.</li>
        <li>
          방문 분석: Google Analytics 4가 쿠키로 방문 페이지·유입 경로 같은 통계를 수집합니다. 위치 좌표·검색어·동네 이름은 보내지 않습니다.
          브라우저 설정에서 쿠키를 차단할 수 있습니다.
        </li>
      </ul>

      <h2>2. 수집하지 않는 정보</h2>
      <ul>
        <li>위치: &lsquo;내 주변&rsquo; 기능의 좌표는 이용자의 기기 안에서만 쓰고 서버로 보내지 않습니다.</li>
        <li>검색어: 서버에 저장하지 않습니다. 최근 검색은 이용자의 브라우저에만 저장되며 언제든 지울 수 있습니다.</li>
        <li>이름·연락처·건강 정보 등 개인을 식별하거나 민감한 정보.</li>
      </ul>

      <h2>3. 이용 목적과 보관 기간</h2>
      <p>서비스 개선과 이용 통계(예: 주간 전화 연결 수) 산출에만 쓰며, 이용 통계는 수집일로부터 2년이 지나면 삭제합니다.</p>

      <h2>4. 제3자 제공·처리 위탁</h2>
      <p>법령에 따른 경우를 빼고 제3자에게 제공하지 않습니다. 서비스 운영을 위해 Vercel(웹 호스팅), Supabase(데이터베이스), Google(방문 분석)의 인프라를 이용합니다.</p>

      <h2>5. 문의</h2>
      <p>개인정보 관련 문의: {contact}</p>
    </main>
  );
}

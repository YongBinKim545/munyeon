import type { Metadata } from 'next';
import { DataStamp } from '@/components/DataStamp';
import { openGraphFor, SITE_NAME, SITE_TAGLINE } from '@/lib/seo';

const DESCRIPTION = '찾아줘 메디는 민간이 만든 서비스예요. 데이터 출처와 정보의 한계, 운영 주체를 안내합니다.';

export const metadata: Metadata = {
  title: '소개',
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: openGraphFor('/about', '소개', DESCRIPTION),
};

/**
 * 소개(P0-13·A-2): 운영 주체(서비스 이름 + 문의 메일, 개인 이름 없음), 민간 서비스 명시, 데이터 출처, 한계, 실제 마지막 갱신 시각.
 * 문의 메일은 이 페이지와 개인정보처리방침에만 둔다(환경변수 NEXT_PUBLIC_CONTACT_EMAIL).
 */
export default function About() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <main className="container">
      <h1>{SITE_NAME} 소개</h1>
      <p>{SITE_TAGLINE}.</p>
      <p>야간·휴일·명절에 지금 문 연 병원·약국을 찾고, 한 번에 전화해 확인할 수 있게 돕는 서비스예요.</p>
      <p>
        <strong>민간이 만든 서비스예요. 정부나 국립중앙의료원이 운영하지 않아요.</strong>
      </p>

      <h2>데이터 출처</h2>
      <ul>
        <li>병·의원: 국립중앙의료원 &lsquo;전국 병·의원 찾기 서비스&rsquo;(공공데이터포털)</li>
        <li>약국: 국립중앙의료원 &lsquo;전국 약국 정보 조회 서비스&rsquo;(공공데이터포털)</li>
        <li>공휴일: 한국천문연구원 &lsquo;특일 정보&rsquo;(공공데이터포털)</li>
      </ul>
      <p className="muted">
        <DataStamp kind="pharmacy" initial={null} />
      </p>

      <h2>정보의 한계</h2>
      <p>
        영업시간은 각 기관이 등록한 정보라 실제와 다를 수 있어요. 일요일·공휴일 시간을 등록하지 않은 곳이 많아, 등록되지 않은 날은 휴무가 아니라
        &lsquo;정보 없음&rsquo;으로 보여드려요. 방문 전 꼭 전화로 확인하세요.
      </p>

      <h2>노출 순서</h2>
      <p>기관은 거리순(지역 전체 목록은 이름순)으로만 보여드리며, 어떤 기관도 돈을 내고 순서를 바꿀 수 없어요.</p>

      <h2>운영</h2>
      <p>{contact ? `${SITE_NAME} · 문의 ${contact}` : SITE_NAME}</p>
    </main>
  );
}

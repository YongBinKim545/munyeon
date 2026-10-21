import type { Metadata } from 'next';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo';

export const metadata: Metadata = { title: '소개', alternates: { canonical: '/about' } };

export default function About() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <main className="container">
      <h1>{SITE_NAME} 소개</h1>
      <p>{SITE_TAGLINE}.</p>
      <p>{SITE_NAME}는 야간·휴일·명절에 지금 문 연 병원·약국을 찾고, 한 번의 탭으로 전화해 확인할 수 있게 돕는 서비스입니다.</p>
      <h2>데이터 출처</h2>
      <p>
        병·의원과 약국의 위치·전화번호·요일별 진료시간은 국립중앙의료원이 공공데이터포털에 제공하는 &lsquo;전국 병·의원 찾기 서비스&rsquo;와
        &lsquo;전국 약국 정보 조회 서비스&rsquo;를 매시간 받아 보여드립니다. 공휴일은 한국천문연구원 특일 정보를 따릅니다.
      </p>
      <h2>정보의 한계</h2>
      <p>
        진료시간은 각 기관이 등록한 정보입니다. 일요일·공휴일 진료시간을 등록하지 않은 기관이 많고, 등록된 정보도 실제와 다를 수 있어요.
        그래서 &lsquo;정보 없음&rsquo;을 휴무로 표시하지 않고, 방문 전 전화 확인을 가장 먼저 권합니다.
      </p>
      <h2>노출 순서</h2>
      <p>기관은 이름순 또는 거리순으로만 보여드리며, 어떤 기관도 돈을 내고 순서를 바꿀 수 없습니다.</p>
      {contact ? (
        <>
          <h2>문의</h2>
          <p>{contact}</p>
        </>
      ) : null}
    </main>
  );
}

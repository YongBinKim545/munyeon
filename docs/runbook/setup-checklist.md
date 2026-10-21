# 계정·자원 준비 체크리스트 (사용자 작업)

> 작성: 2026-10-18 · Phase 1a 공개(2026-11-20 전후) 전 사용자가 직접 할 일. 계정 생성·결제·로그인·키 입력은 사용자만 한다.
> **키·비밀번호·접속 문자열은 채팅이나 다른 세션에 붙여 넣지 말고 아래 위치에만 직접 입력하세요.**

## 1. 지금 (로컬 실데이터 확인)

> 2026-10-18 변경: Supabase 대신 로컬 DB(PGlite, `.pglite/`)로 먼저 확인한다. Supabase·도메인은 배포 단계로 옮겼다.
> 2026-10-21 변경: Supabase dev·prod를 만들고, 로컬 확인(`npm run local`)은 dev DB를 기본으로 쓴다. 로컬 DB는 `--pglite`로 남긴다.

| # | 할 일 | 어디서 | 상태 |
|---|---|---|---|
| 2 | **공공데이터포털 키 입력** | 저장소 루트 `.env`(또는 `.env.local`)에 `DATA_GO_KR_KEY=` + **Decoding 키** | 완료(10-18, probe 성공) |
| 3 | **특일 정보 API 활용신청** | data.go.kr에서 '한국천문연구원_특일 정보' 활용신청(자동승인, 같은 키 사용). 없으면 기본 공휴일 목록만 씀 | 완료(10-19, 로컬에서 2026·2027년 46일 수신) |

| 4 | **Supabase 가입, 프로젝트 2개 생성** | supabase.com 무료 플랜(조직당 2개), `munyeon-dev`·`munyeon-prod`, **Region: Northeast Asia (Seoul)**. Security: **Data API 끄기**, Automatically expose new tables 끄기, **automatic RLS 켜기**. Extensions의 `postgis`·`pg_trgm`은 마이그레이션이 켠다 | 완료(10-21) |
| 4-1 | **dev 접속 문자열** | `munyeon-dev` → Connect → Direct(Connection string) → Method **Session pooler**(포트 5432) URI. 저장소 루트 `.env.local`에 `DATABASE_URL=`로 입력. 비밀번호 자리의 `[ ]`는 지우고, 특수문자는 URL 인코딩 | `npm run local`이 dev DB 사용 |

로컬 확인(2026-10-21부터 Supabase dev): `npm run db:migrate` → `npm run sync -- all` → `npm run sync -- holidays` → `npm run local`. 인터넷 없이 로컬 DB로는 `npm run local -- --pglite`([README](../../README.md)).

## 1-1. 배포 단계에 (11월 초~중순)

| # | 할 일 | 어디서 | 결과물 |
|---|---|---|---|
| 1 | **도메인 구매** | 서비스명·도메인을 다시 정한 뒤(D40) 가비아·후이즈 등 .kr 등록업체(연 2만 원 안팎). `munyeon.kr`은 타인이 사용 중이라 쓰지 않는다 | 도메인 소유 |
| 5 | **prod 접속 문자열** | `munyeon-prod` → Connect → **Transaction pooler**(포트 6543) URI. GitHub Secrets·Vercel 환경변수에만 입력(7·8번). 내 PC의 `.env.local`에는 넣지 않는다 | — |

## 2. 배포 준비 (11-05까지)

| # | 할 일 | 어디서 | 결과물 |
|---|---|---|---|
| 6 | **GitHub 공개 저장소** | https://github.com/YongBinKim545/munyeon (Public) | 완료(10-18, main push, CI 통과) |
| 7 | **GitHub Secrets·Variables 입력** | 저장소 → Settings → Secrets and variables → Actions. Secrets: `DATA_GO_KR_KEY`(**완료**, Actions probe 성공), `DATABASE_URL`(**prod** Transaction pooler URI), `REVALIDATE_SECRET`(아무 긴 무작위 문자열, 8번에도 같은 값). Variables: `WEB_BASE_URL` = 우리 웹 주소(정식 도메인 확정 전에는 Vercel 운영 주소 `https://….vercel.app`). **남의 도메인을 넣지 않는다**(워커는 https `*.vercel.app`과 `OWN_DOMAINS`의 자체 도메인에만 보낸다). 그리고 DB가 준비된 뒤 `SYNC_ENABLED` = `true`(매시간 예약 실행 시작) | 매시간 동기화 |
| 8 | **Vercel 가입, 저장소 import** | vercel.com, Hobby(무료). GitHub로 로그인 → Add New Project → 6번 저장소 → Root Directory `apps/web`. 환경변수: `DATABASE_URL`(prod pooler), `REVALIDATE_SECRET`(7번과 같은 값), `NEXT_PUBLIC_GA_ID`(9번) | 배포 주소 생성 |
| 9 | **GA4 속성 생성, 문의 메일 정하기** | analytics.google.com → 속성 만들기 → 웹 스트림(정식 도메인) | 측정 ID(`G-` 로 시작)와 개인정보처리방침에 적을 문의 메일 — 둘 다 공개 값이라 채팅으로 알려줘도 됩니다. Vercel 환경변수 `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CONTACT_EMAIL` |

## 3. 공개 직전 (11-13~11-20)

| # | 할 일 | 어디서 | 결과물 |
|---|---|---|---|
| 10 | **도메인 연결** | Vercel 프로젝트 → Settings → Domains → 정식 도메인과 `www.` 추가 → 안내된 A/CNAME 레코드를 등록업체 DNS에 입력. 이어서 Vercel 환경변수 `NEXT_PUBLIC_SITE_URL`(정식 주소), GitHub 변수 `WEB_BASE_URL`을 정식 주소로 바꾸고, Claude가 워커 `OWN_DOMAINS`에 도메인을 추가 | 정식 주소 접속 |
| 11 | **네이버 서치어드바이저 등록** | searchadvisor.naver.com → 사이트 등록 → HTML 태그 방식 → 메타 태그의 `content` 값을 Vercel 환경변수 `NAVER_SITE_VERIFICATION`에 입력 → 제가 재배포 → 소유 확인 → 사이트맵 `https://<정식 도메인>/sitemap.xml` 제출 | 네이버 색인 시작 |
| 12 | **구글 Search Console 등록** | search.google.com/search-console → URL 접두어 `https://<정식 도메인>` → HTML 태그 → `content` 값을 `GOOGLE_SITE_VERIFICATION`에 입력 → 재배포 → 확인 → 사이트맵 제출 | 구글 색인 시작 |

## 비용 요약

| 항목 | 비용 |
|---|---|
| 도메인(재결정 중) | 연 2만 원 안팎 |
| Supabase Free, Vercel Hobby, GitHub(공개 저장소), GA4 | 0원 |
| 업그레이드 기준 | [DECISIONS D13](../DECISIONS.md): 수익·B2G 시작 또는 Vercel 사용량 80% → Vercel Pro 월 $20, Supabase 일시정지·용량 400MB·설 대비 → Supabase Pro 월 $25 |

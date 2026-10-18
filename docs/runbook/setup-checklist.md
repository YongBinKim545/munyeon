# 계정·자원 준비 체크리스트 (사용자 작업)

> 작성: 2026-10-18 · Phase 1a 공개(2026-11-20 전후) 전 사용자가 직접 할 일. 계정 생성·결제·로그인·키 입력은 사용자만 한다.
> **키·비밀번호·접속 문자열은 채팅이나 다른 세션에 붙여 넣지 말고 아래 위치에만 직접 입력하세요.**

## 1. 지금 바로 (10-22까지) — 로컬 실데이터 확인에 필요

| # | 할 일 | 어디서 | 결과물 |
|---|---|---|---|
| 1 | **도메인 `munyeon.kr` 구매** | 가비아·후이즈 등 .kr 등록업체(연 2만 원 안팎). 2026-10-18에 미등록 확인 | 도메인 소유. DNS 설정은 5번 단계에서 |
| 2 | **공공데이터포털 키를 `.env.local`에 입력** | 저장소 루트에 `.env.local` 파일을 만들고 `DATA_GO_KR_KEY=` 뒤에 **Decoding 키** 입력(.env.example 참고) | 로컬 `npm run sync -- probe` 가능 |
| 3 | **특일 정보 API 활용신청** | data.go.kr에서 '한국천문연구원_특일 정보' 활용신청(자동승인, 같은 키 사용) | 공휴일 자동 동기화 |
| 4 | **Supabase 가입, 프로젝트 2개 생성** | supabase.com, 무료 플랜. 이름 `munyeon-dev`, `munyeon-prod`, **Region: Northeast Asia (Seoul)**. DB 비밀번호는 비밀번호 관리자에 저장 | 각 프로젝트 Database → Extensions에서 **`postgis`, `pg_trgm` 켜기** |
| 5 | **dev 접속 문자열을 `.env.local`에 입력** | Supabase dev → Connect → **Transaction pooler**(포트 6543) URI를 복사해 `DATABASE_URL=` 뒤에 입력 | 로컬 DB 마이그레이션·동기화 가능 |

준비되면 채팅으로 "1~5 끝"이라고만 알려주세요. 그다음 제가 로컬에서 `probe` → 마이그레이션 → 전체 동기화를 돌려 실데이터로 분류표·배지를 확정합니다.

## 2. 웹 구현 중 (11-05까지)

| # | 할 일 | 어디서 | 결과물 |
|---|---|---|---|
| 6 | **GitHub 계정, 공개 저장소 생성** | github.com. 저장소 이름 예: `munyeon`(Public). 생성 후 저장소 주소를 알려주세요(제가 `git remote` 설정과 push 안내) | 코드 업로드, Actions 사용 |
| 7 | **GitHub Secrets 입력** | 저장소 → Settings → Secrets and variables → Actions. Secrets: `DATA_GO_KR_KEY`(Decoding 키), `DATABASE_URL`(**prod** Transaction pooler URI), `REVALIDATE_SECRET`(아무 긴 무작위 문자열, 8번에도 같은 값). Variables: `WEB_BASE_URL` = `https://munyeon.kr` | 매시간 동기화 |
| 8 | **Vercel 가입, 저장소 import** | vercel.com, Hobby(무료). GitHub로 로그인 → Add New Project → 6번 저장소 → Root Directory `apps/web`. 환경변수: `DATABASE_URL`(prod pooler), `REVALIDATE_SECRET`(7번과 같은 값), `NEXT_PUBLIC_GA_ID`(9번) | 배포 주소 생성 |
| 9 | **GA4 속성 생성, 문의 메일 정하기** | analytics.google.com → 속성 만들기 → 웹 스트림 `https://munyeon.kr` | 측정 ID(`G-` 로 시작)와 개인정보처리방침에 적을 문의 메일 — 둘 다 공개 값이라 채팅으로 알려줘도 됩니다. Vercel 환경변수 `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CONTACT_EMAIL` |

## 3. 공개 직전 (11-13~11-20)

| # | 할 일 | 어디서 | 결과물 |
|---|---|---|---|
| 10 | **도메인 연결** | Vercel 프로젝트 → Settings → Domains → `munyeon.kr`, `www.munyeon.kr` 추가 → 안내된 A/CNAME 레코드를 등록업체 DNS에 입력 | `https://munyeon.kr` 접속 |
| 11 | **네이버 서치어드바이저 등록** | searchadvisor.naver.com → 사이트 등록 → HTML 태그 방식 → 메타 태그의 `content` 값을 Vercel 환경변수 `NAVER_SITE_VERIFICATION`에 입력 → 제가 재배포 → 소유 확인 → 사이트맵 `https://munyeon.kr/sitemap.xml` 제출 | 네이버 색인 시작 |
| 12 | **구글 Search Console 등록** | search.google.com/search-console → URL 접두어 `https://munyeon.kr` → HTML 태그 → `content` 값을 `GOOGLE_SITE_VERIFICATION`에 입력 → 재배포 → 확인 → 사이트맵 제출 | 구글 색인 시작 |

## 비용 요약

| 항목 | 비용 |
|---|---|
| 도메인 `munyeon.kr` | 연 2만 원 안팎 |
| Supabase Free, Vercel Hobby, GitHub(공개 저장소), GA4 | 0원 |
| 업그레이드 기준 | [DECISIONS D13](../DECISIONS.md): 수익·B2G 시작 또는 Vercel 사용량 80% → Vercel Pro 월 $20, Supabase 일시정지·용량 400MB·설 대비 → Supabase Pro 월 $25 |

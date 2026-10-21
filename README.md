# 지금문연 — 지금 문 연 병원·약국

야간·휴일·명절에 **지금 영업 중인 병원·약국을 3초 안에 찾고, 한 번의 탭으로 전화 확인**까지 끝내며, **그 확인 결과를 다음 사람에게 남기는** 서비스.

- 폴더명 `open-clinic-now`는 작업용 코드명이다. 서비스명·도메인은 [ROADMAP](docs/ROADMAP.md)의 결정 항목에서 확정한다.
- 기획 원본은 `D:\planning`에 있고, 이 저장소의 [docs/planning](docs/planning/)은 2026-10-18 시점 사본이다.

## 왜 이 서비스인가

- 2026년 추석에도 응급실 내원의 51.3%가 경증이었다. 응급실 밖에서 갈 곳을 못 찾는 수요가 구조적이다.
- 공휴일 진료시간을 등록한 병의원은 전국의 10.6%뿐이고(2026-10 API 실측), 공식 앱(응급똑똑, 구글플레이 평점 2.8)의 2026년 추석 주된 불만은 "진료 중으로 떠서 갔는데 닫혀 있었다"였다.
- 그래서 핵심은 원탭 전화 자체가 아니라 **통화 결과를 데이터로 되돌리는 확인 루프**다: 전화 → 1탭 확인 → "○분 전 통화로 확인됨".

## 핵심 원칙

| 원칙 | 내용 |
|---|---|
| 3초 룰 | 첫 화면부터 전화 버튼까지 3탭·3초 이내 |
| 확인 루프 | 통화 후 1탭 응답(진료 중 / 휴진 / 안 받음)을 모은다. 다음 사용자에게 보여줄지는 소프트 런칭 실측 후 결정(D16) |
| 정직한 상태 표시 | '등록 기준 / 정보 없음 / 통화로 확인됨'을 구분. 정보 없음은 휴무가 아니다 |
| 웹 우선 | 수요 순간의 행동은 검색이다. SEO 반응형 웹 먼저, 앱은 설 연휴 지표 게이트 통과 후 |

## 범위

- **MVP (2027년 설 연휴 전):** 지금 영업 중 필터, 병원/약국·과목 필터, 소아 진료 자체 분류, 카드 리스트(지도 뷰 없음), 원탭 전화, 통화 후 질문(수집만, 표시는 실측 후), 길찾기 딥링크, 동네 이름 검색, SEO 페이지 체계(기관 상세 약 10.4만, 지역 랜딩, 연휴 특집)
- **v1.1:** 확인 루프 고도화, 즐겨찾기·공유, 큰 글씨 모드, PWA 웹 푸시(앱 수요 실험)
- **앱 (게이트 통과 시):** React Native(Expo) — 푸시, 위젯, iOS 통화 결과 감지
- **하지 않는 것:** 예약·접수, 비대면진료, 약 재고, 커뮤니티, 병원 노출 순위에 금전 개입

## 기술 방향

- **웹:** Next.js(SSR/ISR) 반응형 웹 — 정적 정보(진료시간표·전화)는 서버 렌더링, "지금 영업 중"은 요청 시점에 계산
- **데이터:** 국립중앙의료원 전국 병·의원 찾기(15000736)·전국 약국 정보 조회(15000576) API를 수집 워커가 FullData로 매시간 동기화(1회 11호출). 클라이언트는 공공 API를 직접 호출하지 않는다
- **DB:** PostgreSQL + PostGIS (위치 반경 쿼리), 자체 보정 테이블(통화 확인·휴진 제보)
- **구조:** 모노레포 — `apps/web`, `apps/mobile`(앱 단계), `packages/core`, `packages/ui-tokens`
- **인프라(월 0원 시작):** Vercel Hobby(웹) · Supabase Free 서울(DB) · GitHub Actions(수집 워커) · GA4 + 자체 이벤트. 지도 API는 Phase 1b 전에 정한다([DECISIONS](docs/DECISIONS.md) D11~D15)

## 문서

| 문서 | 내용 |
|---|---|
| [docs/ROADMAP.md](docs/ROADMAP.md) | 마일스톤·마감일, 사용자 결정이 필요한 항목 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 지금까지 확정된 결정과 근거 |
| [docs/specs/2026-10-18-mvp-features.md](docs/specs/2026-10-18-mvp-features.md) | MVP 기능 정의서(화면별 동작·규칙) |
| [docs/specs/2026-10-18-architecture-ux.md](docs/specs/2026-10-18-architecture-ux.md) | 구조 설계·UI/UX 계획(캐시, URL, 데이터 모델, 화면 구성) |
| [docs/planning/세부계획-병원약국.md](docs/planning/세부계획-병원약국.md) | 세부 서비스 계획(기능·데이터·SEO·KPI·리스크) — 기획의 기준 문서 |
| [docs/planning/검토-웹우선-앱프레임워크.md](docs/planning/검토-웹우선-앱프레임워크.md) | 웹 우선·앱 프레임워크 검토 |
| [docs/planning/API-검증결과.md](docs/planning/API-검증결과.md) | 공공 API 실호출 검증 결과(필드, 공휴일 필터, 자정 넘김 표기 등) |
| [docs/planning/응급똑똑-리뷰-분석.md](docs/planning/응급똑똑-리뷰-분석.md) | 경쟁 공식 앱 리뷰 54건 분석 |
| [docs/planning/수요-분석-리포트.md](docs/planning/수요-분석-리포트.md), [수요-분석-병원약국-노트.md](docs/planning/수요-분석-병원약국-노트.md) | 수요 분석 리포트와 근거 노트 |
| [scripts/api-verification/](scripts/api-verification/) | API 검증용 PowerShell 스크립트(키는 환경변수로만 읽음) |

## 개발 환경

- Node.js 24, npm 11 (pnpm은 미설치 — 필요하면 corepack으로 활성화)
- 공공데이터포털 인증키는 `.env.local`의 `DATA_GO_KR_KEY`에 **사용자가 직접** 넣는다(Decoding 키). 저장소에 커밋하지 않는다. 형식은 [.env.example](.env.example) 참고

### 로컬에서 확인 (배포 전)

기본은 **Supabase dev DB**를 쓴다(2026-10-21부터). `.env.local`에 `munyeon-dev`의 **Session pooler**(포트 5432) 접속 문자열을 `DATABASE_URL`로 **사용자가 직접** 넣는다. 비밀번호 자리의 `[ ]` 괄호는 지우고, 비밀번호에 `@ : / ? # %` 같은 문자가 있으면 URL 인코딩한다.

처음 한 번 테이블을 만들고 전국 데이터를 받는다(공공 API 13호출, 몇 분).

```bash
npm run db:migrate
```

```bash
npm run sync -- all
```

```bash
npm run sync -- holidays
```

그다음부터는 한 줄로 빌드 → 실행(포트 3001, 같은 와이파이의 휴대폰에서도 접속)까지 된다. 접속 주소가 화면에 나오고, `Ctrl + C`로 꺼진다.

```bash
npm run local
```

- 빌드 없이 다시 띄우기: `npm run local -- --no-build`
- Supabase 무료 프로젝트는 1주일 쓰지 않으면 일시정지된다. 접속이 안 되면 대시보드에서 **Restore**를 누른다.
- 인터넷 없이 로컬 DB(PGlite + PostGIS, `.pglite/`)로 띄우기: `npm run local -- --pglite`. `.env.local`에 `DATABASE_URL`이 없어도 로컬 DB로 뜬다. 로컬 DB에 데이터를 받으려면 `node apps/worker/src/dev-db.ts --real`을 켜 둔 채 다른 터미널에서 `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres npm run sync -- all`(셸에서 준 값이 `.env.local`보다 우선한다).

로컬 DB(`--pglite`)를 쓸 때만 해당:

- 끌 때는 `Ctrl + C` 한 번. 로컬 DB는 정상적으로 닫힌 뒤 꺼진다(강제로 끄면 `.pglite/`가 손상될 수 있다). 이미 켜져 있으면 두 번째 DB는 데이터 폴더를 열지 않고 멈춘다.
- 로컬 DB(PGlite)는 세션이 하나라, 연결이 둘 이상 동시에 붙으면 쿼리가 섞인다(`bind message supplies … parameters` 오류). 웹 서버는 연결 하나만 쓰도록 되어 있으니, `npm run sync`처럼 다른 연결을 여는 작업은 웹을 끄고 실행한다. 실서비스 DB(진짜 Postgres)에는 이 제약이 없다.
- 로컬 DB가 `RuntimeError: Aborted()`로 열리지 않으면 폴더가 손상된 것이다. `.pglite/`를 다른 이름(예: `.pglite.broken-날짜`)으로 바꾸고, 처음 받을 때처럼 `npm run sync -- all`과 `npm run sync -- holidays`로 다시 받는다(공공 API 13호출).
- 표본 16곳만으로 빠르게 보기: `node apps/worker/src/dev-db.ts`(인메모리) + `npm run dev -w @munyeon/web`
- 응답 코드·noindex·격자 JSON 점검: `node scripts/check-routes.mjs http://localhost:3001`
- **휴대폰의 '현재 위치'는 `https://` 주소에서만 된다.** 같은 와이파이의 `http://192.168.x.x:3001`로는 위치 권한이 막혀 최근 지역 또는 서울 중구 명동으로 시작한다. PC의 `http://localhost:3001`에서는 위치를 쓸 수 있다. 휴대폰 위치 확인은 배포 주소(또는 Vercel 미리보기 주소)에서 한다.
- 실데이터 DB를 켜 둔 채 표본 DB를 따로 띄우기: `node apps/worker/src/dev-db.ts --port=54330`

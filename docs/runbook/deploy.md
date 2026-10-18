# 배포·운영 런북 — 지금문연

> 사용자 준비 항목은 [setup-checklist.md](setup-checklist.md). 이 문서는 그 뒤의 첫 배포, 점검, 운영 절차다.
> **키·비밀번호·접속 문자열은 채팅·커밋·로그에 남기지 않는다.**

## 1. 첫 배포 순서

| 단계 | 누가 | 명령·작업 | 확인 |
|---|---|---|---|
| 1 | 사용자 | 체크리스트 1~5(도메인, `.env.local` 키, 특일 API, Supabase dev·prod + `postgis`·`pg_trgm`, dev 접속 문자열) | — |
| 2 | Claude | `npm run sync -- probe` (로컬, 소스당 1호출) | 두 소스 `ok`, totalCount 약 79,006 / 25,435 |
| 3 | Claude | `npm run db:migrate` (dev) → `npm run sync -- all` → `npm run sync -- holidays` | `sync_runs` 두 소스 `ok`, 기관 약 10.4만 행, `neighborhoods` 생성 |
| 4 | Claude | 실데이터로 종별 값 목록 확인 → `categoryOf` 표 확정, 진료과 배지 표본 200곳 점검 | 분류 누락 0, 배지 오판 비율 기록 |
| 5 | 사용자 | 체크리스트 6~9(GitHub 공개 저장소, Secrets, Vercel import, GA4) | — |
| 6 | Claude | `git push` → Vercel 배포, prod에 `DATABASE_URL=… npm run db:migrate` (사용자가 터미널에서 실행하거나 일회성 Actions) | 배포 URL 200 |
| 7 | Claude | Actions에서 `sync` 수동 실행: `probe` → `all` → `holidays` | 해외 러너에서 1만 행 페이지가 180초 안. 실패 시 D13(국내 VM 이전) 결정 요청 |
| 8 | 사용자 | 체크리스트 10(도메인 연결) | `https://munyeon.kr` 200 |
| 9 | Claude | 공개 점검(2절) | 모두 통과 |
| 10 | 사용자 | 체크리스트 11~12(서치어드바이저·Search Console 소유 확인, 사이트맵 제출) | 사이트맵 '성공' |

## 2. 공개 점검

```bash
node scripts/check-routes.mjs https://munyeon.kr
```

- 무작위 기관 20곳 200 응답, 없는 기관 404, 진료시간 없는 기관 `noindex`
- HTML에 '영업 중'·'영업 종료'·'곧 마감'이 없음(스크립트가 `LIVE-STATUS!`로 표시)
- `/sitemap.xml` → 파일 수 = 1 + ceil(색인 기관 수 / 10000), 각 파일 URL 수
- 구글 리치 결과 테스트로 기관 상세 JSON-LD(Pharmacy/MedicalClinic) 유효
- 휴대폰·태블릿·PC 폭에서 상세·지역·홈 화면, PC에서 [번호 복사]
- 모바일 Lighthouse 성능 80 이상
- 개인정보처리방침의 문의 연락처(`NEXT_PUBLIC_CONTACT_EMAIL`)가 채워져 있음

## 3. 운영

| 항목 | 주기 | 방법 |
|---|---|---|
| 동기화 실패 | 수시 | GitHub Actions 실패 메일(동기화 오류 또는 6시간 이상 미성공) → Actions 로그의 건수·오류 확인 |
| Vercel 사용량 | 주 1회 | Usage 화면의 Active CPU(한도 월 4시간), Fast Origin Transfer(10GB). 80%에 가까우면 Pro 검토(D13) |
| Supabase 용량 | 주 1회 | Database size(한도 500MB). 400MB면 Pro 검토 |
| 색인 현황 | 주 1회 | 서치어드바이저·Search Console 색인 페이지 수(KPI) |
| 공개 저장소 Actions | 60일 | 저장소에 60일간 커밋이 없으면 GitHub가 예약 실행을 멈춘다. 멈추면 Actions 화면에서 다시 켠다 |

## 4. 키 교체

1. 공공데이터포털에서 키 재발급
2. 사용자가 GitHub Secrets `DATA_GO_KR_KEY`와 로컬 `.env.local`을 새 값으로 바꾼다
3. Actions `sync`를 `probe`로 수동 실행해 확인

`REVALIDATE_SECRET`을 바꿀 때는 GitHub Secrets와 Vercel 환경변수를 같은 값으로 함께 바꾸고 Vercel을 재배포한다.

## 5. 롤백

- 웹: Vercel Deployments에서 직전 배포를 'Promote to Production'
- 데이터: 동기화는 매시간 전체를 다시 받으므로, 잘못 들어간 데이터는 다음 실행에서 고쳐진다. 비활성화가 잘못 퍼졌으면 `update institutions set is_active = true where updated_at = '<잘못된 실행 시각>'` 후 다음 동기화를 기다린다(Supabase SQL 편집기, 사용자가 실행)
- 스키마: 마이그레이션은 앞으로만 간다. 되돌릴 때는 새 마이그레이션을 추가한다

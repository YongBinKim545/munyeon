# 배포·운영 런북 — 찾아줘 메디

> 사용자 준비 항목은 [setup-checklist.md](setup-checklist.md). 이 문서는 그 뒤의 첫 배포, 점검, 운영 절차다.
> **키·비밀번호·접속 문자열은 채팅·커밋·로그에 남기지 않는다.**

## 1. 첫 배포 순서

| 단계 | 누가 | 명령·작업 | 확인 |
|---|---|---|---|
| 1 | 사용자 | 체크리스트 1~5(도메인, `.env.local` 키, 특일 API, Supabase dev·prod + `postgis`·`pg_trgm`, dev 접속 문자열) | — |
| 2 | Claude | `npm run sync -- probe` (로컬, 소스당 1호출) | **완료(10-18)**: 79,006 / 25,435 |
| 3 | Claude | 로컬 DB(`dev-db.ts --real`)에 `npm run sync -- all` | **완료(10-18)**: 실패 페이지 0, 동네 3,285개. `holidays`도 완료(10-19): 2026·2027년 46일, 설 2027-02-06~09 확인 |
| 4 | Claude | 실데이터로 종별 값 목록 확인 → `categoryOf` 표 확정, 진료과 배지 표본 200곳 점검 | 분류 누락 0, 배지 오판 비율 기록 |
| 5 | 사용자 | 체크리스트 6~9(GitHub 공개 저장소, Secrets, Vercel import, GA4) | — |
| 6 | Claude | `git push` → Vercel 배포(**완료 10-21**, `findmedi.co.kr`). prod 테이블은 Actions `sync` 수동 실행 `migrate`로 만든다(2026-10-21 추가, Secret `DATABASE_URL`=prod Transaction pooler 사용. 이미 적용된 마이그레이션은 건너뛴다) | 배포 URL 200 |
| 7 | Claude·사용자 | Actions `sync` 수동 실행: `probe`(**완료 10-18, 해외 러너 정상 응답**) → `migrate` → `all` → `holidays`. 이어서 Vercel Production의 `DATABASE_URL`을 prod로 바꾸고 다시 배포, 저장소 변수 `SYNC_ENABLED=true`로 매시간 실행 시작 | 1만 행 페이지가 150초 안 |
| 8 | 사용자 | 체크리스트 10(도메인 연결, `findmedi.co.kr`) | `https://findmedi.co.kr` 200 |
| 9 | Claude | 공개 점검(2절) | 모두 통과 |
| 10 | 사용자 | 체크리스트 11~12(서치어드바이저·Search Console 소유 확인, 사이트맵 제출) | 사이트맵 '성공' |

## 2. 공개 점검

```bash
node scripts/check-routes.mjs https://findmedi.co.kr
```

- 무작위 기관 20곳 200 응답, 없는 기관 404, 진료시간 없는 기관 `noindex`
- HTML·격자 JSON에 카드 상태 문구('영업 중 ·', '영업 종료', '곧 마감', '곧 영업 ·', '전화 확인 필요')가 없음(스크립트가 `LIVE-STATUS!`로 표시)
- 메인: 휴대폰에서 위치 허용 → 현재 위치 목록, 거부 → 최근 지역·명동. 지역 드롭다운 순서(위치 검색 → 현재 위치 → 최근 3개), 위치 검색 모달이 뒤로 가기로 닫힘, [전체 보기], 맨 위로 버튼
- `/search`는 `noindex`, 결과가 보던 지역에서 가까운 순. `/api/grid/...`는 `s-maxage=3600`
- 서울 도심(강남역) 병원 메인의 격자 전송량: 1km 단계 50KB, 3km 160KB 안(압축 후, 브라우저 개발자 도구 Network)
- `/sitemap.xml` → 파일 수 = 1 + ceil(색인 기관 수 / 10000), 각 파일 URL 수
- 구글 리치 결과 테스트로 기관 상세 JSON-LD(Pharmacy/MedicalClinic) 유효
- 휴대폰·태블릿·PC 폭에서 상세·지역·메인 화면, PC에서 [번호 복사]
- 모바일 Lighthouse 성능 80 이상
- 개인정보처리방침의 문의 연락처(`NEXT_PUBLIC_CONTACT_EMAIL`)가 채워져 있음

## 3. 운영

| 항목 | 주기 | 방법 |
|---|---|---|
| 동기화 실패 | 수시 | GitHub Actions 실패 메일(동기화 오류 또는 6시간 이상 미성공) → Actions 로그의 건수·오류 확인. 공휴일(`holidays`)은 7일 안에 성공이 있으면 실패해도 `holidays: WARN`만 남고 메일이 오지 않는다(D46) |
| 예약 실행 간격 | 매일(10월 말까지) | Actions → sync의 schedule 실행 시각과 `/api/meta`의 `lastSync`. 3~5시간 넘게 벌어지는 일이 잦으면 외부 예약 서비스나 국내 VM 이전을 결정(D46) |
| Vercel 사용량 | 주 1회 | Usage 화면의 Active CPU(한도 월 4시간), Fast Origin Transfer(10GB). 80%에 가까우면 Pro 검토(D13) |
| Supabase 용량 | 주 1회 | Database size(한도 500MB). 400MB면 Pro 검토 |
| 배포 횟수 | 배포마다 | 공개 후 배포는 하루 한 번 이하, 이용이 적은 시간대(새벽)에 묶는다. 배포마다 상세 페이지 캐시가 지워지기 때문이다(P0-10) |
| 배포 직후 미리 만들기 | 배포마다 | Actions → warm 로그의 `warm: N개, 실패 M개`. 실패가 5%를 넘으면 실패 메일. 수동 실행도 된다(D68) |
| 공개 후 2주 집중 점검 | 매일(11-20~12-04) | Search Console 설정 → 크롤링 통계(평균 응답 시간·서버 오류), Vercel Logs에서 응답 5xx와 3초 넘는 요청. 상세가 느리다고 나오면 미리 만들기를 상세 일부(수도권 약국 등)로 넓힌다(P0-10 방식 B) |
| 카카오톡 미리보기 | 제목·설명·이미지를 바꾼 뒤 | 카카오톡은 링크 미리보기를 캐시한다. 카카오 개발자 사이트의 공유 디버거(developers.kakao.com/tool/debugger/sharing)에 주소를 넣고 '캐시 초기화'를 누른다(로그인 필요, 사용자) |
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

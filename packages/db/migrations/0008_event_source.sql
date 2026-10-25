-- 유입 경로 큰 분류(P0-11, D60·D72): search·share·direct·community·ad·other 중 하나.
-- 브라우저가 처음 들어온 페이지의 꼬리표·출처로 정한 값만 받고, 출처 주소·검색어 원문은 저장하지 않는다.
-- 이 칸 이전 기록과 이전 화면에서 온 기록은 비어 있다.
alter table events add column source text;

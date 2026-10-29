-- D76에서 목록·통계 쿼리에 dup_of is null을 더하자, 지역 색인(where is_active)만으로는 답할 수 없어
-- 전국 지역 집계(listRegions·listSido)가 색인 대신 표 전체를 읽게 됐다(개발 DB 0.2초 → 0.9초, 처음 실행 10초).
-- 색인 조건에 dup_of is null을 넣어 다시 색인만으로 답하게 한다.
drop index if exists institutions_region_idx;
create index institutions_region_idx on institutions (sido, sigungu, kind) where is_active and dup_of is null;
analyze institutions;

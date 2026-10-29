-- 원본 중복 기관(D76): 같은 기관이 다른 ID로 여러 번 등록된 경우.
-- dup_of: 대표가 아닌 행에 대표 ID. 목록·검색·사이트맵·통계는 dup_of가 없는 행만 쓴다.
-- merged_hours: 대표 행에 묶음 전체 진료시간을 합친 값(원본 hours는 그대로 두어 다음 수집이 '바뀜'으로 보지 않게).
-- 둘 다 수집 끝마다 워커가 다시 계산한다.
alter table institutions add column dup_of text;
alter table institutions add column merged_hours jsonb;

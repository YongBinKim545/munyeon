-- 2글자 기관 이름 검색 색인. 이름 색인(pg_trgm, 0003)은 3글자 단위라 '정신'·'약국' 같은 2글자 검색어에는 쓰이지 않고
-- 표 전체를 읽어 0.2~10초가 걸렸다(개발 DB 2026-10-29, 조회 제한 3초 초과 → 검색 결과 없음).
-- 이름을 2글자씩 쪼갠 목록을 자동 계산 칸으로 두고 GIN 색인을 건다. 2글자 검색어는 이 색인으로 후보를 고른다.
-- (칸 없이 함수 색인만 두면 후보마다 함수를 다시 계산해 '의원'처럼 흔한 말은 5초가 넘었다)
create or replace function name_bigrams(n text) returns text[]
language sql immutable parallel safe as $$
  select coalesce(array_agg(distinct substr(lower(n), i, 2)), '{}')
  from generate_series(1, char_length(n) - 1) as i
$$;

alter table institutions add column name_bi text[] generated always as (name_bigrams(name)) stored;
create index institutions_name_bi_idx on institutions using gin (name_bi) where is_active and dup_of is null;
analyze institutions;

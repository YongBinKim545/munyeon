-- 메인 목록용 약 5km 격자 번호(D21·D35). core의 gridOf(GRID_LAT 0.045, GRID_LON 0.056)와 같은 계산이다.
-- 좌표가 한국 범위 밖이거나 없으면 NULL(geom 생성 조건과 같다).
alter table institutions
  add column grid_y int generated always as (
    case when lat between 33 and 39 and lon between 124 and 132 then floor(lat / 0.045::float8)::int end
  ) stored,
  add column grid_x int generated always as (
    case when lat between 33 and 39 and lon between 124 and 132 then floor(lon / 0.056::float8)::int end
  ) stored;

create index institutions_grid_idx on institutions (kind, grid_y, grid_x) where is_active;

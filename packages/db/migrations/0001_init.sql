-- 지금문연 초기 스키마. 공공 API 원본은 raw에 보관하고, 영업 판정은 hours(dutyTime*)로 앱에서 계산한다.
-- 매시간 동기화는 content_hash가 바뀐 행만 갱신한다(무료 DB의 쓰기·WAL 절약). 마지막 동기화 시각은 sync_runs에서 읽는다.
create extension if not exists postgis;

create table institutions (
  id            text primary key,              -- hpid
  kind          text not null check (kind in ('hospital', 'pharmacy')),
  name          text not null,
  div_name      text,                          -- dutyDivNam (종별)
  addr          text not null,
  sido          text,
  sigungu       text,
  tel           text,
  lat           double precision,
  lon           double precision,
  geom          geography(Point, 4326) generated always as (
                  case when lat between 33 and 39 and lon between 124 and 132
                       then ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography end
                ) stored,
  hours         jsonb not null,                -- dutyTime1s~8c 원문
  raw           jsonb not null,                -- API item 원문 전체
  content_hash  text not null,
  has_hours     boolean not null,
  first_seen_at timestamptz not null,
  updated_at    timestamptz not null,          -- content_hash가 바뀐 시각 (사이트맵 lastmod)
  is_active     boolean not null default true
);

create index institutions_geom_idx on institutions using gist (geom);
create index institutions_region_idx on institutions (sido, sigungu, kind) where is_active;
create index institutions_updated_idx on institutions (updated_at);

create table sync_runs (
  id          bigserial primary key,
  source      text not null,
  started_at  timestamptz not null,
  finished_at timestamptz,
  status      text not null check (status in ('running', 'ok', 'failed')),
  pages       int,
  rows        int,
  changed     int,
  deactivated int,
  error       text
);

create table holidays (
  ymd    date primary key,
  name   text not null,
  source text not null                         -- 'seed' | 'kasi'
);

-- 개인 식별 정보(IP·UA·쿠키·좌표)는 저장하지 않는다. 시각은 분 단위로 자른다.
create table events (
  id             bigserial primary key,
  type           text not null,
  institution_id text,
  page           text,
  created_minute timestamptz not null default date_trunc('minute', now())
);
create index events_created_idx on events (created_minute);

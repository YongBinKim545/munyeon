-- 기관 분류·주 진료과·동, 동네 검색, 기관 이름 검색 (D25·D26)
create extension if not exists pg_trgm;

alter table institutions
  add column category text not null default 'general'
    check (category in ('pharmacy', 'general', 'oriental', 'dental', 'other')),
  add column specialty text,
  add column dong text,
  add column pediatric_name boolean not null default false;

create index institutions_name_trgm_idx on institutions using gin (name gin_trgm_ops);

-- 동네 검색용. 동기화가 끝날 때마다 다시 계산한다. 시군구 자체도 한 행(name = sigungu)으로 넣는다.
create table neighborhoods (
  name    text not null,
  sido    text not null,
  sigungu text not null,
  lat     double precision,
  lon     double precision,
  n       int not null,
  primary key (sido, sigungu, name)
);

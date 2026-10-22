-- 개선의견·수정요청(D49). 개인 식별 정보(IP·UA·쿠키·좌표)는 저장하지 않는다. 시각은 분 단위로 자른다.
create table feedback (
  id             bigserial primary key,
  type           text not null check (type in ('opinion', 'correction')),
  body           text not null default '',
  fields         text[] not null default '{}',
  kind           text check (kind in ('hospital', 'pharmacy')),
  institution_id text,
  path           text,
  created_minute timestamptz not null default date_trunc('minute', now())
);
create index feedback_created_idx on feedback (created_minute);

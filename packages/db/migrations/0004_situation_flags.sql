-- 지역 랜딩 상황 플래그(일요일·공휴일·야간). 워커가 core의 situationFlags로 계산해 저장하고,
-- 사이트맵 집계와 웹 noindex 판정이 같은 기준을 쓰게 한다(리뷰 #6).
alter table institutions
  add column has_sunday boolean not null default false,
  add column has_holiday boolean not null default false,
  add column has_night boolean not null default false;

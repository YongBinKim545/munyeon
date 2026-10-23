-- 광주광역시·전라남도 → 전남광주통합특별시(2026-07-01, P0-1). 병원 주소는 새 이름이라 시도가 비어 있었고,
-- 약국 주소는 옛 이름이거나 '서울 성동구…' 같은 줄임말이었다. core parseRegion과 같은 규칙으로 다시 계산한다.
-- 이미 맞는 행은 건드리지 않는다(시도가 비었거나 옛 이름인 행만).
with alias(name, sido) as (values
  ('광주광역시', '전남광주통합특별시'), ('전라남도', '전남광주통합특별시'), ('전남광주통합특별시', '전남광주통합특별시'),
  ('강원도', '강원특별자치도'), ('전라북도', '전북특별자치도'),
  ('서울', '서울특별시'), ('부산', '부산광역시'), ('대구', '대구광역시'), ('인천', '인천광역시'),
  ('광주', '전남광주통합특별시'), ('대전', '대전광역시'), ('울산', '울산광역시'), ('세종', '세종특별자치시'),
  ('경기', '경기도'), ('강원', '강원특별자치도'), ('충북', '충청북도'), ('충남', '충청남도'),
  ('전북', '전북특별자치도'), ('전남', '전남광주통합특별시'), ('경북', '경상북도'), ('경남', '경상남도'),
  ('제주', '제주특별자치도')
), tok as (
  select id, regexp_split_to_array(btrim(addr), '\s+') t from institutions
  where sido is null or sido in ('광주광역시', '전라남도', '강원도', '전라북도')
), parsed as (
  select tok.id, a.sido,
    case
      when a.sido = '세종특별자치시' then a.sido
      when t[2] is null or t[2] !~ '[시군구]$' then null
      when t[2] ~ '시$' and t[3] ~ '구$' then t[2] || ' ' || t[3]
      else t[2]
    end as sigungu
  from tok join alias a on a.name = tok.t[1]
)
update institutions i set sido = p.sido, sigungu = p.sigungu
from parsed p
where i.id = p.id and p.sigungu is not null;

-- 동 목록도 새 시도로(refreshNeighborhoods와 같은 계산)
delete from neighborhoods;
insert into neighborhoods (name, sido, sigungu, lat, lon, n)
select name, sido, sigungu,
       percentile_cont(0.5) within group (order by lat), percentile_cont(0.5) within group (order by lon), count(*)
from (
  select dong as name, sido, sigungu, lat, lon from institutions
  where is_active and dong is not null and sido is not null and sigungu is not null
  union all
  select sigungu as name, sido, sigungu, lat, lon from institutions
  where is_active and sido is not null and sigungu is not null
) x
group by name, sido, sigungu;

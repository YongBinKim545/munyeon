-- 응급실 목록(D78, listEmergency) 색인. 응급실 운영 여부는 원본(raw)에만 있어 조건으로 거르면 표 전체를 읽어
-- 조회 제한 3초를 넘었다(개발 DB 2026-10-29). 응급실 운영 병원(약 520곳)만 담은 작은 부분 색인을 둔다.
create index institutions_emergency_idx on institutions (id)
  where kind = 'hospital' and is_active and dup_of is null and (raw->>'dutyEryn') = '1' and geom is not null;
analyze institutions;

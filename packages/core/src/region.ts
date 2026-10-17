export interface Region {
  sido: string;
  sigungu: string;
}

const SIDO = new Set([
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '경기도', '강원특별자치도', '강원도', '충청북도', '충청남도', '전북특별자치도',
  '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]);

/** 주소 앞부분에서 시도·시군구를 뽑는다. '수원시 영통구'처럼 시 아래 구는 합친다. */
export function parseRegion(addr: string): Region | null {
  const [sido, t2, t3] = addr.trim().split(/\s+/);
  if (!sido || !SIDO.has(sido)) return null;
  if (sido === '세종특별자치시') return { sido, sigungu: sido };
  if (!t2 || !/[시군구]$/.test(t2)) return null;
  if (t2.endsWith('시') && t3 && t3.endsWith('구')) return { sido, sigungu: `${t2} ${t3}` };
  return { sido, sigungu: t2 };
}

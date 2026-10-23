export interface Region {
  sido: string;
  sigungu: string;
}

/** 광주광역시·전라남도가 2026-07-01 합쳐진 시도(P0-1) */
export const JEONNAM_GWANGJU = '전남광주통합특별시';

/**
 * 지금 쓰는 시도 이름 16개. 표시 순서는 행정 관례 순.
 * 광주·전남은 통합특별시 하나다(2026-07-01).
 */
export const CURRENT_SIDO: readonly string[] = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', JEONNAM_GWANGJU, '경상북도', '경상남도',
  '제주특별자치도',
];

/**
 * 격자 JSON이 시도를 번호로 싣는 표(옛 이름 포함). 캐시된 JSON과 번호가 어긋나지 않게 뒤에 덧붙이기만 한다.
 */
export const SIDO_NAMES: readonly string[] = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시',
  '세종특별자치시', '경기도', '강원특별자치도', '강원도', '충청북도', '충청남도', '전북특별자치도',
  '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도', JEONNAM_GWANGJU,
];

/** 옛 이름·줄임말 → 지금 이름. 일부 약국 주소는 '서울 성동구…'처럼 줄임말로 시작한다 */
const SIDO_ALIAS: Record<string, string> = {
  광주광역시: JEONNAM_GWANGJU, 전라남도: JEONNAM_GWANGJU, 강원도: '강원특별자치도', 전라북도: '전북특별자치도',
  서울: '서울특별시', 부산: '부산광역시', 대구: '대구광역시', 인천: '인천광역시', 광주: JEONNAM_GWANGJU,
  대전: '대전광역시', 울산: '울산광역시', 세종: '세종특별자치시', 경기: '경기도', 강원: '강원특별자치도',
  충북: '충청북도', 충남: '충청남도', 전북: '전북특별자치도', 전남: JEONNAM_GWANGJU, 경북: '경상북도',
  경남: '경상남도', 제주: '제주특별자치도',
};

const CURRENT = new Set(CURRENT_SIDO);

/** 시도 이름을 지금 이름으로. 모르는 이름은 null */
export function normalizeSido(name: string | null | undefined): string | null {
  if (!name) return null;
  if (CURRENT.has(name)) return name;
  return SIDO_ALIAS[name] ?? null;
}

/** 주소 앞부분에서 시도·시군구를 뽑는다. '수원시 영통구'처럼 시 아래 구는 합친다. */
export function parseRegion(addr: string): Region | null {
  const [t1, t2, t3] = addr.trim().split(/\s+/);
  const sido = normalizeSido(t1);
  if (!sido) return null;
  if (sido === '세종특별자치시') return { sido, sigungu: sido };
  if (!t2 || !/[시군구]$/.test(t2)) return null;
  if (t2.endsWith('시') && t3 && t3.endsWith('구')) return { sido, sigungu: `${t2} ${t3}` };
  return { sido, sigungu: t2 };
}

const SHORT: Record<string, string> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 대전광역시: '대전',
  울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북',
  충청남도: '충남', 전북특별자치도: '전북', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주',
};

/** 옛 광주광역시의 구. 통합특별시 안에서 '광주'로 부른다(전남의 시군에는 구가 없다) */
const GWANGJU_GU = new Set(['동구', '서구', '남구', '북구', '광산구']);

/**
 * 사람들이 검색하는 시도 약칭(P0-2). 통합특별시는 옛 광주 5개 구면 '광주', 그 밖은 '전남',
 * 시군구 없이 시도 전체면 '광주·전남'.
 */
export function sidoShort(sido: string, sigungu?: string | null): string {
  const s = normalizeSido(sido) ?? sido;
  if (s === JEONNAM_GWANGJU) return sigungu ? (GWANGJU_GU.has(sigungu) ? '광주' : '전남') : '광주·전남';
  return SHORT[s] ?? s;
}

/** 제목·H1용 지역 이름: '서울 마포구', '광주 동구', 세종은 '세종' */
export function regionShortName(sido: string, sigungu: string): string {
  const short = sidoShort(sido, sigungu);
  return sigungu === sido ? short : `${short} ${sigungu}`;
}

export type Category = 'pharmacy' | 'general' | 'oriental' | 'dental' | 'other';

/** 종별(dutyDivNam)로 목록 구역을 나눈다. 종별이 비면 이름으로 추정한다. */
export function categoryOf(kind: 'hospital' | 'pharmacy', divName: string | null, name: string): Category {
  if (kind === 'pharmacy') return 'pharmacy';
  const key = divName?.trim() || name;
  if (/한의원|한방/.test(key)) return 'oriental';
  if (/치과/.test(key)) return 'dental';
  if (/요양병원|정신병원|조산원/.test(key)) return 'other';
  return 'general';
}

/** 정식 진료과명과 이름에 쓰이는 별칭. 긴 단어부터 찾는다(정형외과가 외과보다 먼저). */
const SPECIALTY_ALIASES: [string, string][] = [
  ['정신건강의학과', '정신건강의학과'],
  ['마취통증의학과', '마취통증의학과'],
  ['소아청소년과', '소아청소년과'],
  ['재활의학과', '재활의학과'],
  ['영상의학과', '영상의학과'],
  ['가정의학과', '가정의학과'],
  ['비뇨의학과', '비뇨의학과'],
  ['이비인후과', '이비인후과'],
  ['정형외과', '정형외과'],
  ['신경외과', '신경외과'],
  ['성형외과', '성형외과'],
  ['비뇨기과', '비뇨의학과'],
  ['산부인과', '산부인과'],
  ['소아과', '소아청소년과'],
  ['신경과', '신경과'],
  ['정신과', '정신건강의학과'],
  ['피부과', '피부과'],
  ['안과', '안과'],
  ['내과', '내과'],
  ['외과', '외과'],
];

export const SPECIALTIES: readonly string[] = [...new Set(SPECIALTY_ALIASES.map(([, s]) => s))];

/** 기관 이름에서 주 진료과를 판정한다. 등록 과목은 부정확해 이름을 기준으로 한다(D26). */
export function specialtyOf(name: string): string | null {
  for (const [alias, canonical] of SPECIALTY_ALIASES) {
    if (name.includes(alias)) return canonical;
  }
  return null;
}

export function isPediatricByName(name: string): boolean {
  return /소아|아동|어린이|키즈/.test(name);
}

const DONG = /^[가-힣0-9·.]+(동|읍|면|가|리)$/;

/** 도로명 주소 끝 괄호의 법정동 이름. '(망원동, 망원빌딩)' → '망원동' */
export function dongOf(addr: string): string | null {
  const m = /\(([^()]*)\)\s*$/.exec(addr.trim());
  if (!m) return null;
  for (const part of m[1]!.split(',')) {
    const t = part.trim();
    if (DONG.test(t)) return t;
  }
  return null;
}

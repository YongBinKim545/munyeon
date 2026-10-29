/**
 * 원본 데이터의 중복 기관(D76). 같은 기관이 다른 ID로 두 번 이상 등록되고 요일 칸이 한쪽만 채워진 경우가 있다
 * (예: 수내봄산부인과의원 A2121617·A2121621, 2026-10 전국 127묶음).
 * 묶음은 DB에서 정규화한 이름·전화·주소로 찾고, 여기서는 대표 고르기와 진료시간 합치기만 한다.
 */
export type RawHourFields = Record<string, string | undefined>;

const DAYS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function dayPair(h: RawHourFields, d: number): string | null {
  const s = h[`dutyTime${d}s`];
  const c = h[`dutyTime${d}c`];
  return s || c ? `${s ?? ''}-${c ?? ''}` : null;
}

function filledDays(h: RawHourFields): number {
  return DAYS.filter((d) => dayPair(h, d) !== null).length;
}

/**
 * 요일(시작·끝 한 쌍) 단위로 합친다. 한쪽만 값이 있으면 그 값(빈칸은 휴무가 아니라 정보 없음),
 * 값이 서로 다르면 그 요일을 비워 '정보 없음'으로 둔다. 따로 문구를 붙이지 않는다(D67).
 */
export function mergeDuplicateHours(list: RawHourFields[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of DAYS) {
    const pairs = new Set(list.map((h) => dayPair(h, d)).filter((p): p is string => p !== null));
    if (pairs.size !== 1) continue;
    const src = list.find((h) => dayPair(h, d) !== null)!;
    for (const k of [`dutyTime${d}s`, `dutyTime${d}c`]) if (src[k]) out[k] = src[k]!;
  }
  return out;
}

/**
 * 대표 기관: 진료시간이 채워진 요일이 많은 곳 → ID가 작은 곳.
 * 갱신 시각은 쓰지 않는다. 묶을 때 updated_at을 올리므로, 쓰면 다음 수집에서 대표가 뒤바뀐다.
 */
export function pickRepresentative<T extends { id: string; hours: RawHourFields }>(list: T[]): T {
  return [...list].sort((a, b) => filledDays(b.hours) - filledDays(a.hours) || a.id.localeCompare(b.id))[0]!;
}

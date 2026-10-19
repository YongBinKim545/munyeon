import { DAY_CODES, primaryBadge, SIDO_NAMES, type Category, type RawHours } from '@munyeon/core';
import type { GridRow } from '@munyeon/db';
import type { Kind } from './seo';

/**
 * 격자 한 칸 JSON(D21·D35). 진료시간 원본만 담고 '영업 중' 같은 현재 상태는 넣지 않는다.
 * 크기를 줄이려고 기관 하나를 배열 하나로 보낸다(도심 병원 반경 3km 압축 약 150KB, 2026-10-19 실측).
 * - 좌표는 소수 5자리(약 1m), 시도는 SIDO_NAMES 순번(-1은 없음)
 * - hours는 요일코드 1~8 순서로 "HHMMHHMM"(시작+종료 원문) 또는 ""(정보 없음)를 쉼표로 이은 문자열. 끝의 빈칸은 뺀다.
 */
export type GridTuple = [
  id: string,
  name: string,
  lat: number,
  lon: number,
  tel: string,
  category: Category,
  badge: string,
  pediatric: 0 | 1,
  sido: number,
  sigungu: string,
  dong: string,
  hours: string,
];

export interface GridPayload {
  v: 1;
  items: GridTuple[];
}

export interface GridEntry {
  id: string;
  kind: Kind;
  name: string;
  lat: number;
  lon: number;
  tel: string | null;
  category: Category;
  badge: string;
  pediatric: boolean;
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  hours: RawHours;
}

const HHMM = /^\d{4}$/;

function packHours(h: RawHours): string {
  return DAY_CODES.map((d) => {
    const s = (h[`dutyTime${d}s`] ?? '').trim();
    const c = (h[`dutyTime${d}c`] ?? '').trim();
    return HHMM.test(s) && HHMM.test(c) ? s + c : '';
  })
    .join(',')
    .replace(/,+$/, '');
}

function unpackHours(packed: string): RawHours {
  const out: RawHours = {};
  const parts = typeof packed === 'string' ? packed.split(',') : [];
  DAY_CODES.forEach((d, i) => {
    const v = parts[i] ?? '';
    if (v.length === 8) {
      out[`dutyTime${d}s`] = v.slice(0, 4);
      out[`dutyTime${d}c`] = v.slice(4);
    }
  });
  return out;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export function encodeGrid(rows: GridRow[]): GridPayload {
  return {
    v: 1,
    items: rows
      .filter((r) => r.lat !== null && r.lon !== null)
      .map((r) => [
        r.id,
        r.name,
        round5(r.lat as number),
        round5(r.lon as number),
        r.tel ?? '',
        r.category,
        primaryBadge({ kind: r.kind, category: r.category, divName: r.divName, specialty: r.specialty }),
        r.kind === 'hospital' && r.category === 'general' && r.pediatricName ? 1 : 0,
        r.sido ? SIDO_NAMES.indexOf(r.sido) : -1,
        r.sigungu ?? '',
        r.dong ?? '',
        packHours(r.hours),
      ]),
  };
}

export function decodeGrid(p: GridPayload, kind: Kind): GridEntry[] {
  if (p?.v !== 1 || !Array.isArray(p.items)) return [];
  return p.items.map(([id, name, lat, lon, tel, category, badge, pediatric, sido, sigungu, dong, hours]) => ({
    id, kind, name, lat, lon, category, badge,
    tel: tel || null,
    pediatric: pediatric === 1,
    sido: SIDO_NAMES[sido] ?? null,
    sigungu: sigungu || null,
    dong: dong || null,
    hours: unpackHours(hours),
  }));
}

import { SIDO_NAMES } from '@munyeon/core';

/**
 * canonical·사이트맵·구조화 데이터에 쓰는 사이트 주소. 정식 도메인은 확정 뒤 NEXT_PUBLIC_SITE_URL로만 넣는다.
 * 없으면 Vercel이 넣어 주는 자기 배포 주소, 그것도 없으면(로컬) localhost. 남의 도메인을 기본값으로 두지 않는다(2026-10-21).
 */
export function siteUrl(env: Record<string, string | undefined>): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const host = env.VERCEL_ENV === 'production' ? env.VERCEL_PROJECT_PRODUCTION_URL : (env.VERCEL_BRANCH_URL ?? env.VERCEL_URL);
  return host ? `https://${host}` : 'http://localhost:3000';
}

export const SITE_URL = siteUrl(process.env);
export const SITE_NAME = '지금문연';

export type Kind = 'pharmacy' | 'hospital';
export const KIND_LABEL: Record<Kind, string> = { pharmacy: '약국', hospital: '병원' };

export const SITUATIONS = { all: '전체', sunday: '일요일', holiday: '공휴일', night: '야간' } as const;
export type Situation = keyof typeof SITUATIONS;

const KIND_BY_LABEL = new Map<string, Kind>(Object.entries(KIND_LABEL).map(([k, v]) => [v, k as Kind]));
const SITUATION_BY_LABEL = new Map<string, Situation>(Object.entries(SITUATIONS).map(([k, v]) => [v, k as Situation]));
const SIDO_SET = new Set(SIDO_NAMES);

/** 경로 조각을 한 번만 디코딩한다. 이미 디코딩된 값은 그대로, 잘못된 인코딩은 null. */
export function safeDecode(seg: string): string | null {
  if (!seg.includes('%')) return seg;
  try {
    return decodeURIComponent(seg);
  } catch {
    return null;
  }
}

export function institutionPath(kind: Kind, id: string): string {
  return `/${kind}/${encodeURIComponent(id)}`;
}

/** 한글 경로(D24): /서울특별시/강남구/약국/일요일 */
export function regionPath(sido: string, sigungu?: string, kind?: Kind, situation?: Situation): string {
  const segs = [sido];
  if (sigungu) segs.push(sigungu);
  if (sigungu && kind) segs.push(KIND_LABEL[kind]);
  if (sigungu && kind && situation) segs.push(SITUATIONS[situation]);
  return '/' + segs.map(encodeURIComponent).join('/');
}

export interface RegionParams {
  sido: string;
  sigungu?: string;
  kind?: Kind;
  situation?: Situation;
}

/** 라우트 params(인코딩 여부 무관)를 검증한다. 시군구 존재 여부는 DB 조회로 따로 확인한다. */
export function parseRegionParams(p: { sido: string; sigungu?: string; kind?: string; situation?: string }): RegionParams | null {
  const sido = safeDecode(p.sido);
  if (!sido || !SIDO_SET.has(sido)) return null;
  const out: RegionParams = { sido };
  if (p.sigungu !== undefined) {
    const sigungu = safeDecode(p.sigungu);
    if (!sigungu) return null;
    out.sigungu = sigungu;
  }
  if (p.kind !== undefined) {
    const label = safeDecode(p.kind);
    const kind = label ? KIND_BY_LABEL.get(label) : undefined;
    if (!kind) return null;
    out.kind = kind;
  }
  if (p.situation !== undefined) {
    const label = safeDecode(p.situation);
    const situation = label ? SITUATION_BY_LABEL.get(label) : undefined;
    if (!situation) return null;
    out.situation = situation;
  }
  return out;
}

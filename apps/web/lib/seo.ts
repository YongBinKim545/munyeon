import { SIDO_NAMES } from '@munyeon/core';

/** 정식 도메인(D44, 2026-10-21 가비아 등록) */
export const DEFAULT_SITE_URL = 'https://findmedi.co.kr';

/**
 * canonical·사이트맵·구조화 데이터에 쓰는 사이트 주소.
 * NEXT_PUBLIC_SITE_URL이 있으면 그 값, Vercel 미리보기는 자기 배포 주소, 그 밖에는 정식 도메인(D44).
 * 남의 도메인을 넣지 않는다(D40).
 */
export function siteUrl(env: Record<string, string | undefined>): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const preview = env.VERCEL_ENV === 'preview' ? (env.VERCEL_BRANCH_URL ?? env.VERCEL_URL) : undefined;
  return preview ? `https://${preview}` : DEFAULT_SITE_URL;
}

export const SITE_URL = siteUrl(process.env);
export const SITE_NAME = '찾아줘 메디';
/** 소개 한 줄(D44) */
export const SITE_TAGLINE = '지금 문 연 병원·약국을 찾아드려요';

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

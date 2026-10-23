import { CURRENT_SIDO, JEONNAM_GWANGJU, regionShortName } from '@munyeon/core';

export { CURRENT_SIDO, regionShortName };

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

/** 주소에는 지금 시도 이름만. 옛 이름(광주광역시·전라남도 등)은 next.config에서 새 주소로 301(P0-1) */
const SIDO_SET = new Set(CURRENT_SIDO);

/** 경로 조각을 한 번만 디코딩한다. 이미 디코딩된 값은 그대로, 잘못된 인코딩은 null. */
export function safeDecode(seg: string): string | null {
  if (!seg.includes('%')) return seg;
  try {
    return decodeURIComponent(seg);
  } catch {
    return null;
  }
}

/** 시도 페이지 제목·H1. 통합특별시는 사람들이 검색하는 통칭을 함께 적는다(P0-1) */
export function sidoTitle(sido: string): string {
  return sido === JEONNAM_GWANGJU ? `${sido}(광주·전남)` : sido;
}

export function institutionPath(kind: Kind, id: string): string {
  return `/${kind}/${encodeURIComponent(id)}`;
}

/**
 * 한글 경로(D24·D69): 시도 /서울특별시, 지역 화면 /서울특별시/마포구(약국), /서울특별시/마포구/병원.
 * 옛 /…/약국[/상황]·/…/병원/상황 주소는 next.config에서 301.
 */
export function regionPath(sido: string, sigungu?: string, kind?: Kind): string {
  const segs = [sido];
  if (sigungu) segs.push(sigungu);
  if (sigungu && kind === 'hospital') segs.push(KIND_LABEL.hospital);
  return '/' + segs.map(encodeURIComponent).join('/');
}

export interface RegionParams {
  sido: string;
  sigungu?: string;
  kind?: Kind;
}

/** 라우트 params(인코딩 여부 무관)를 검증한다. 유형 조각은 '병원'만 있다. 시군구 존재 여부는 DB 조회로 따로 확인한다. */
export function parseRegionParams(p: { sido: string; sigungu?: string; kind?: string }): RegionParams | null {
  const sido = safeDecode(p.sido);
  if (!sido || !SIDO_SET.has(sido)) return null;
  const out: RegionParams = { sido };
  if (p.sigungu !== undefined) {
    const sigungu = safeDecode(p.sigungu);
    if (!sigungu) return null;
    out.sigungu = sigungu;
  }
  if (p.kind !== undefined) {
    if (safeDecode(p.kind) !== KIND_LABEL.hospital) return null;
    out.kind = 'hospital';
  }
  return out;
}

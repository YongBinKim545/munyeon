import { createHash } from 'node:crypto';
import { DAY_CODES, hasAnyHours, parseRegion, parseWeeklyHours, type RawHours } from '@munyeon/core';
import type { InstitutionRow, Kind } from '@munyeon/db';

/** 응답 내 순번(rnum)은 정렬에 따라 바뀌므로 해시와 원문 보관에서 뺀다. */
const VOLATILE = new Set(['rnum']);

export function contentHash(raw: Record<string, string>): string {
  const keys = Object.keys(raw).filter((k) => !VOLATILE.has(k)).sort();
  return createHash('sha256').update(JSON.stringify(keys.map((k) => [k, raw[k]]))).digest('hex');
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toInstitutionRow(kind: Kind, item: Record<string, string>): InstitutionRow | null {
  const id = item.hpid?.trim();
  const name = item.dutyName?.trim();
  if (!id || !name) return null;
  const raw = Object.fromEntries(Object.entries(item).filter(([k]) => !VOLATILE.has(k)));
  const hours: RawHours = {};
  for (const d of DAY_CODES) {
    for (const sc of ['s', 'c'] as const) {
      const k = `dutyTime${d}${sc}` as const;
      if (item[k]) hours[k] = item[k];
    }
  }
  const addr = item.dutyAddr?.trim() ?? '';
  const region = parseRegion(addr);
  return {
    id, kind, name,
    divName: item.dutyDivNam?.trim() || null,
    addr,
    sido: region?.sido ?? null,
    sigungu: region?.sigungu ?? null,
    tel: item.dutyTel1?.trim() || null,
    lat: num(item.wgs84Lat),
    lon: num(item.wgs84Lon),
    hours,
    hasHours: hasAnyHours(parseWeeklyHours(hours)),
    raw,
    contentHash: contentHash(raw),
  };
}

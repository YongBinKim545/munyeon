import type { Kind } from '@munyeon/db';

export const MAX_SYNC_AGE_HOURS = 6;

/**
 * 두 종류 모두 최근 동기화가 성공했는지 확인한다. 오래됐으면 예외를 던져
 * 워크플로를 실패시키고, GitHub가 관리자에게 메일을 보내게 한다(D23).
 */
export async function assertFresh(
  lastSyncAt: (kind: Kind) => Promise<Date | null>,
  now = new Date(),
  maxAgeHours = MAX_SYNC_AGE_HOURS,
): Promise<void> {
  const stale: string[] = [];
  for (const kind of ['hospital', 'pharmacy'] as const) {
    const at = await lastSyncAt(kind);
    const ageH = at ? (now.getTime() - at.getTime()) / 3_600_000 : Infinity;
    if (ageH > maxAgeHours) stale.push(`${kind} ${at ? `${ageH.toFixed(1)}h ago` : 'never'}`);
  }
  if (stale.length) throw new Error(`stale sync (> ${maxAgeHours}h): ${stale.join(', ')}`);
}

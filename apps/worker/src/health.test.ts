import { expect, test } from 'vitest';
import { assertFresh } from './health.ts';

const now = new Date('2026-11-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

test('fresh when both synced within 6h', async () => {
  await expect(assertFresh(async () => hoursAgo(1), now)).resolves.toBeUndefined();
});

test('stale when one kind is older than 6h', async () => {
  await expect(assertFresh(async (k) => (k === 'hospital' ? hoursAgo(7) : hoursAgo(1)), now)).rejects.toThrow(/hospital 7.0h/);
});

test('stale when never synced', async () => {
  await expect(assertFresh(async () => null, now)).rejects.toThrow(/never/);
});

import { describe, expect, test, vi } from 'vitest';
import { withRetry } from './retry';

const noWait = () => Promise.resolve();

describe('withRetry (D47)', () => {
  test('returns the first success and logs each failure with its duration', async () => {
    const log = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })).mockResolvedValue('ok');
    expect(await withRetry('home', fn, { tries: 3, wait: noWait, log })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(/^\[home\] 1\/3 실패 \(\d+ms\) 57014 canceling statement/);
  });

  test('throws the last error after the last try', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(withRetry('home', fn, { tries: 3, wait: noWait, log: vi.fn() })).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

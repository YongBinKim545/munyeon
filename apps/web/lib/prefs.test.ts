// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { pushRecentArea, readKind, readLastCenter, readRecentAreas, saveKind, saveLastCenter } from './prefs';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const area = (label: string) => ({ label, lat: 37.5, lon: 127 });

describe('prefs', () => {
  test('kind defaults to pharmacy and remembers the last choice', () => {
    expect(readKind()).toBe('pharmacy');
    saveKind('hospital');
    expect(readKind()).toBe('hospital');
  });

  test('recent areas keep 3, newest first, no duplicates', () => {
    for (const l of ['가', '나', '다', '라']) pushRecentArea(area(l));
    expect(readRecentAreas().map((a) => a.label)).toEqual(['라', '다', '나']);
    pushRecentArea(area('나'));
    expect(readRecentAreas().map((a) => a.label)).toEqual(['나', '라', '다']);
  });

  test('broken or blocked storage falls back to defaults', () => {
    localStorage.setItem('munyeon:areas', '{bad json');
    expect(readRecentAreas()).toEqual([]);
    localStorage.setItem('munyeon:areas', JSON.stringify([{ label: 'x', lat: 'a' }, area('ok')]));
    expect(readRecentAreas().map((a) => a.label)).toEqual(['ok']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readKind()).toBe('pharmacy');
    expect(() => saveKind('hospital')).not.toThrow();
    expect(() => pushRecentArea(area('x'))).not.toThrow();
    expect(readRecentAreas()).toEqual([]);
  });

  test('last center', () => {
    expect(readLastCenter()).toBeNull();
    saveLastCenter({ lat: 37.5637, lon: 126.9838 });
    expect(readLastCenter()).toEqual({ lat: 37.5637, lon: 126.9838 });
    localStorage.setItem('munyeon:lastCenter', '{"lat":"x"}');
    expect(readLastCenter()).toBeNull();
  });
});

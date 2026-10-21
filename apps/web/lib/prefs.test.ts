// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { pushRecentArea, readFilter, readLastArea, readLastCenter, readRecentAreas, saveFilter, saveLastArea, saveLastCenter } from './prefs';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const area = (label: string) => ({ label, lat: 37.5, lon: 127 });

describe('prefs', () => {
  test('filter defaults to pharmacy and remembers the last choice (pharmacy, hospital, pediatric)', () => {
    expect(readFilter()).toBe('pharmacy');
    saveFilter('hospital');
    expect(readFilter()).toBe('hospital');
    saveFilter('pediatric');
    expect(readFilter()).toBe('pediatric');
    localStorage.setItem('munyeon:kind', 'dental');
    expect(readFilter()).toBe('pharmacy');
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
    expect(readFilter()).toBe('pharmacy');
    expect(() => saveFilter('hospital')).not.toThrow();
    expect(() => pushRecentArea(area('x'))).not.toThrow();
    expect(readRecentAreas()).toEqual([]);
  });

  test('last viewed area (D45)', () => {
    expect(readLastArea()).toBeNull();
    saveLastArea({ label: '강서구 화곡동', lat: 37.541, lon: 126.84 });
    expect(readLastArea()).toEqual({ label: '강서구 화곡동', lat: 37.541, lon: 126.84 });
    expect(readRecentAreas()).toEqual([]); // 최근 지역 목록에는 넣지 않는다
    localStorage.setItem('munyeon:lastArea', '{"label":1}');
    expect(readLastArea()).toBeNull();
  });

  test('last center', () => {
    expect(readLastCenter()).toBeNull();
    saveLastCenter({ lat: 37.5637, lon: 126.9838 });
    expect(readLastCenter()).toEqual({ lat: 37.5637, lon: 126.9838 });
    localStorage.setItem('munyeon:lastCenter', '{"lat":"x"}');
    expect(readLastCenter()).toBeNull();
  });
});

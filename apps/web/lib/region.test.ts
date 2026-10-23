import { expect, test } from 'vitest';
import { regionCenter } from './region';

test('regionCenter is the median of coordinates, ignoring missing ones', () => {
  expect(regionCenter([{ lat: 1, lon: 10 }, { lat: 2, lon: 20 }, { lat: 100, lon: 200 }, { lat: null, lon: null }])).toEqual({ lat: 2, lon: 20 });
  expect(regionCenter([{ lat: 1, lon: 10 }, { lat: 3, lon: 30 }])).toEqual({ lat: 2, lon: 20 });
  expect(regionCenter([])).toBeNull();
});

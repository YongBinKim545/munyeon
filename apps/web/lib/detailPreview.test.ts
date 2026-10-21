import { afterEach, describe, expect, test } from 'vitest';
import { clearPreviews, readPreview, rememberPreview, type DetailPreview } from './detailPreview';

afterEach(clearPreviews);

const p = (id: string): DetailPreview => ({
  kind: 'pharmacy', id, name: `약국${id}`, badge: '약국', pediatric: false, tel: '02-1', hours: null,
  sido: '서울특별시', sigungu: '중구', area: '중구 명동', lat: 37.5, lon: 127, holidays: [],
});

describe('detailPreview (D45)', () => {
  test('remembers by kind and id', () => {
    rememberPreview(p('C1'));
    expect(readPreview('pharmacy', 'C1')?.name).toBe('약국C1');
    expect(readPreview('hospital', 'C1')).toBeNull();
  });

  test('keeps only the latest 20', () => {
    for (let i = 0; i < 25; i++) rememberPreview(p(`C${i}`));
    expect(readPreview('pharmacy', 'C0')).toBeNull();
    expect(readPreview('pharmacy', 'C24')).not.toBeNull();
  });
});

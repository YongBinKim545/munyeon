import { describe, expect, test } from 'vitest';
import { primaryBadge } from './badges.ts';
import { categoryOf, dongOf, isPediatricByName, specialtyOf } from './classify.ts';

describe('categoryOf', () => {
  test('pharmacy', () => expect(categoryOf('pharmacy', null, '시청약국')).toBe('pharmacy'));
  test('general clinic and hospitals', () => {
    expect(categoryOf('hospital', '의원', '튼튼내과의원')).toBe('general');
    expect(categoryOf('hospital', '종합병원', '서울대학교병원')).toBe('general');
    expect(categoryOf('hospital', '상급종합병원', '세브란스병원')).toBe('general');
    expect(categoryOf('hospital', '보건소', '강남구보건소')).toBe('general');
  });
  test('oriental', () => {
    expect(categoryOf('hospital', '한의원', '바른한의원')).toBe('oriental');
    expect(categoryOf('hospital', '한방병원', '자생한방병원')).toBe('oriental');
  });
  test('dental', () => {
    expect(categoryOf('hospital', '치과의원', '미소치과의원')).toBe('dental');
    expect(categoryOf('hospital', '치과병원', '서울치과병원')).toBe('dental');
  });
  test('other', () => {
    expect(categoryOf('hospital', '요양병원', '행복요양병원')).toBe('other');
    expect(categoryOf('hospital', '정신병원', '○○정신병원')).toBe('other');
    expect(categoryOf('hospital', '조산원', '○○조산원')).toBe('other');
  });
  test('missing divName falls back to name', () => {
    expect(categoryOf('hospital', null, '바른한의원')).toBe('oriental');
    expect(categoryOf('hospital', null, '미소치과')).toBe('dental');
    expect(categoryOf('hospital', null, '행복의원')).toBe('general');
  });
});

describe('specialtyOf', () => {
  test.each([
    ['튼튼소아청소년과의원', '소아청소년과'],
    ['우리소아과의원', '소아청소년과'],
    ['밝은안과의원', '안과'],
    ['서울비뇨기과의원', '비뇨의학과'],
    ['바른정형외과의원', '정형외과'],
    ['연세신경외과의원', '신경외과'],
    ['좋은신경과의원', '신경과'],
    ['맑은이비인후과', '이비인후과'],
    ['행복가정의학과의원', '가정의학과'],
    ['마음정신건강의학과의원', '정신건강의학과'],
    ['편한마취통증의학과의원', '마취통증의학과'],
    ['튼튼내과의원', '내과'],
    ['고운피부과의원', '피부과'],
  ])('%s → %s', (name, expected) => expect(specialtyOf(name)).toBe(expected));
  test('no specialty word', () => expect(specialtyOf('행복의원')).toBeNull());
});

describe('isPediatricByName', () => {
  test.each(['키즈아동병원', '우리아이어린이의원', '튼튼소아청소년과의원', '소아과의원'])('%s', (n) =>
    expect(isPediatricByName(n)).toBe(true));
  test('not pediatric', () => expect(isPediatricByName('튼튼내과의원')).toBe(false));
});

describe('dongOf', () => {
  test('trailing parenthesis', () => expect(dongOf('서울특별시 강남구 테헤란로 100, 2층 (역삼동)')).toBe('역삼동'));
  test('dong with building name', () => expect(dongOf('서울특별시 마포구 망원로 1 (망원동, 망원빌딩)')).toBe('망원동'));
  test('numbered dong and eup/myeon/ga', () => {
    expect(dongOf('서울특별시 마포구 월드컵로 1 (망원1동)')).toBe('망원1동');
    expect(dongOf('경기도 가평군 가평읍 1 (가평읍)')).toBe('가평읍');
    expect(dongOf('서울특별시 중구 세종대로 1 (태평로1가)')).toBe('태평로1가');
  });
  test('no parenthesis or not a dong', () => {
    expect(dongOf('세종특별자치시 한누리대로 1')).toBeNull();
    expect(dongOf('서울특별시 중구 세종대로 1 (시청빌딩)')).toBeNull();
  });
});

describe('primaryBadge', () => {
  test('specialty wins for general', () =>
    expect(primaryBadge({ kind: 'hospital', category: 'general', divName: '의원', specialty: '내과' })).toBe('내과'));
  test('falls back to division', () => {
    expect(primaryBadge({ kind: 'hospital', category: 'general', divName: '의원', specialty: null })).toBe('의원');
    expect(primaryBadge({ kind: 'hospital', category: 'general', divName: '상급종합병원', specialty: null })).toBe('종합병원');
    expect(primaryBadge({ kind: 'hospital', category: 'general', divName: null, specialty: null })).toBe('병원');
  });
  test('oriental and dental ignore specialty', () => {
    expect(primaryBadge({ kind: 'hospital', category: 'oriental', divName: '한의원', specialty: '내과' })).toBe('한의원');
    expect(primaryBadge({ kind: 'hospital', category: 'dental', divName: '치과병원', specialty: null })).toBe('치과');
  });
  test('pharmacy', () => expect(primaryBadge({ kind: 'pharmacy', category: 'pharmacy', divName: null, specialty: null })).toBe('약국'));
});

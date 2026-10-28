import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildGuideJsonLd, guidePath, loadGuides, parseGuide } from './guide';

const POST = `---
slug: 달빛어린이병원
title: 달빛어린이병원이란
description: 밤·휴일에 아이를 볼 수 있는 달빛어린이병원을 찾는 법
updated: 2026-11-10
sources:
  - 보건복지부 달빛어린이병원 안내 | https://www.mohw.go.kr/
  - 응급의료포털 E-Gen | https://www.e-gen.or.kr/
---

달빛어린이병원은 평일 밤과 휴일에 소아 경증 환자를 보는 병원이에요.

## 어떻게 찾나

- 응급의료포털에서 찾아요
- 방문 전 [전화](https://example.com)로 확인해요

<script>alert(1)</script>
`;

const draft = (slug: string, updated = '2026-11-01') =>
  POST.replace('slug: 달빛어린이병원', `slug: ${slug}`).replace('updated: 2026-11-10', `updated: ${updated}\ndraft: true`);

describe('parseGuide (P0-12, D74)', () => {
  test('reads the header and splits the first paragraph as the answer', () => {
    const g = parseGuide(POST, 'a.md');
    expect(g).toMatchObject({
      slug: '달빛어린이병원',
      title: '달빛어린이병원이란',
      description: '밤·휴일에 아이를 볼 수 있는 달빛어린이병원을 찾는 법',
      updated: '2026-11-10',
      draft: false,
      sources: [
        { name: '보건복지부 달빛어린이병원 안내', url: 'https://www.mohw.go.kr/' },
        { name: '응급의료포털 E-Gen', url: 'https://www.e-gen.or.kr/' },
      ],
    });
    expect(g.answer).toBe('달빛어린이병원은 평일 밤과 휴일에 소아 경증 환자를 보는 병원이에요.');
    expect(g.html).toContain('<h2>어떻게 찾나</h2>');
    expect(g.html).toContain('<a href="https://example.com">전화</a>');
    expect(g.html).not.toContain('평일 밤과 휴일에'); // 답 문단은 따로 그린다
  });

  test('raw HTML in a post is shown as text, not run', () => {
    const g = parseGuide(POST, 'a.md');
    expect(g.html).not.toContain('<script>');
    expect(g.html).toContain('&lt;script&gt;');
  });

  test('draft: true is kept as a flag', () => {
    expect(parseGuide(draft('x'), 'x.md').draft).toBe(true);
  });

  test.each([
    ['no header', '본문만'],
    ['no slug', POST.replace('slug: 달빛어린이병원\n', '')],
    ['no updated', POST.replace('updated: 2026-11-10\n', '')],
    ['bad date', POST.replace('2026-11-10', '2026-13-40')],
    ['no sources', POST.replace(/sources:\n(  - .*\n)+/, '')],
    ['source without url', POST.replace('| https://www.mohw.go.kr/', '')],
    ['slug with slash', POST.replace('slug: 달빛어린이병원', 'slug: a/b')],
    ['body starts with a heading', POST.replace('달빛어린이병원은 평일', '## 제목\n\n달빛어린이병원은 평일')],
  ])('%s → error naming the file', (_n, raw) => {
    expect(() => parseGuide(raw, 'bad.md')).toThrow(/bad\.md/);
  });
});

describe('loadGuides', () => {
  const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'guide-'));

  test('only published posts, newest first; README and drafts left out', () => {
    const d = dir();
    fs.writeFileSync(path.join(d, 'moon.md'), POST);
    fs.writeFileSync(path.join(d, 'old.md'), POST.replace('slug: 달빛어린이병원', 'slug: 상비약').replace('2026-11-10', '2026-11-01'));
    fs.writeFileSync(path.join(d, 'draft.md'), draft('연휴'));
    fs.writeFileSync(path.join(d, 'README.md'), '# 글 쓰는 규칙');
    expect(loadGuides(d).map((g) => g.slug)).toEqual(['달빛어린이병원', '상비약']);
  });

  test('no folder or no posts → empty list', () => {
    expect(loadGuides(path.join(dir(), 'none'))).toEqual([]);
  });

  test('two posts with the same address → error', () => {
    const d = dir();
    fs.writeFileSync(path.join(d, 'a.md'), POST);
    fs.writeFileSync(path.join(d, 'b.md'), POST);
    expect(() => loadGuides(d)).toThrow(/달빛어린이병원/);
  });
});

test('guide path is the Korean slug, encoded like region pages', () => {
  expect(guidePath('달빛어린이병원')).toBe(`/guide/${encodeURIComponent('달빛어린이병원')}`);
});

test('Article structured data: headline, date from 기준일, service as author', () => {
  const g = parseGuide(POST, 'a.md');
  expect(buildGuideJsonLd(g, 'https://findmedi.co.kr/guide/x', 'https://findmedi.co.kr')).toMatchObject({
    '@type': 'Article',
    headline: '달빛어린이병원이란',
    dateModified: '2026-11-10',
    inLanguage: 'ko-KR',
    author: { '@id': 'https://findmedi.co.kr/#org' },
    publisher: { '@id': 'https://findmedi.co.kr/#org' },
  });
});

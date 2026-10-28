import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';

/**
 * 가이드 글(P0-12, D74). `content/guide/*.md` 파일 하나가 글 하나다.
 * 머리말에 주소(slug)·제목·설명·기준일·출처를 적고, 본문 첫 문단이 질문의 답이다.
 * `draft: true`인 글은 화면·사이트맵 어디에도 나오지 않는다(사용자 검토 전, U-2).
 * 형식이 틀리면 빌드가 멈추도록 오류를 낸다.
 */
export interface GuideSource {
  name: string;
  url: string;
}

export interface Guide {
  slug: string;
  /** 페이지 제목(검색 결과·브라우저 탭·공유 카드) */
  title: string;
  /** 본문 맨 위 제목(H1)·목록·경로 안내. 머리말에 없으면 title과 같다 */
  heading: string;
  description: string;
  /** 기준일 YYYY-MM-DD */
  updated: string;
  draft: boolean;
  sources: GuideSource[];
  /** 본문 첫 문단(답)의 HTML. 링크·강조만 변환한다 */
  answerHtml: string;
  /** 답 문단 뒤 본문 HTML */
  html: string;
}

export const GUIDE_DIR = path.join(process.cwd(), 'content', 'guide');

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 글 안의 HTML은 그대로 실행하지 않고 글자로 보인다
const marked = new Marked({ gfm: true, renderer: { html: ({ text }) => escapeHtml(text) } });

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3]);
}

export function parseGuide(raw: string, file: string): Guide {
  const fail = (why: string): never => {
    throw new Error(`가이드 ${file}: ${why}`);
  };
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) return fail('맨 위 --- 머리말이 없어요');
  const head = m[1] ?? '';
  const body = (m[2] ?? '').trim();

  const fields: Record<string, string> = {};
  const sources: GuideSource[] = [];
  let inSources = false;
  for (const line of head.split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (inSources && item) {
      const [name, url] = (item[1] ?? '').split('|').map((s) => s.trim());
      if (!name || !url || !/^https?:\/\//.test(url)) fail(`출처는 "이름 | https://주소" 꼴이어야 해요: ${line.trim()}`);
      sources.push({ name: name!, url: url! });
      continue;
    }
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    inSources = kv[1] === 'sources';
    if (!inSources) fields[kv[1]!] = (kv[2] ?? '').trim();
  }

  const need = (k: string) => fields[k] || fail(`${k}가 없어요`);
  const slug = need('slug');
  if (/[/?#\s]/.test(slug)) fail('slug에는 / ? # 공백을 쓸 수 없어요');
  const updated = need('updated');
  if (!validDate(updated)) fail('updated는 2026-11-10 꼴의 날짜여야 해요');
  if (sources.length === 0) fail('출처(sources)가 하나 이상 있어야 해요');

  const blocks = body.split(/\r?\n\s*\r?\n/);
  const first = (blocks[0] ?? '').trim();
  if (!first || /^(#|-|\*|\d+\.|>|<)/.test(first)) fail('본문 첫 문단은 질문에 대한 답(보통 문장)이어야 해요');

  return {
    slug,
    title: need('title'),
    heading: fields.heading || need('title'),
    description: need('description'),
    updated,
    draft: fields.draft === 'true',
    sources,
    answerHtml: marked.parseInline(first.replace(/\s*\r?\n\s*/g, ' '), { async: false }),
    html: marked.parse(blocks.slice(1).join('\n\n'), { async: false }),
  };
}

/** 게시된 글만 기준일 최신순으로. 폴더가 없으면 빈 목록 */
export function loadGuides(dir: string = GUIDE_DIR): Guide[] {
  let files: string[];
  try {
    // 경로를 정적 분석하지 않게 한다(프로젝트 전체가 함수에 실리는 것을 막음). 글 파일은 next.config의 outputFileTracingIncludes로 싣는다
    files = fs.readdirSync(/* turbopackIgnore: true */ dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  } catch {
    return [];
  }
  const all = files.map((f) => parseGuide(fs.readFileSync(path.join(/* turbopackIgnore: true */ dir, f), 'utf8'), f));
  const seen = new Set<string>();
  for (const g of all) {
    if (seen.has(g.slug)) throw new Error(`가이드 주소가 겹쳐요: ${g.slug}`);
    seen.add(g.slug);
  }
  return all.filter((g) => !g.draft).sort((a, b) => b.updated.localeCompare(a.updated) || a.slug.localeCompare(b.slug));
}

let cached: Guide[] | null = null;
/** 화면·사이트맵용. 글은 배포 때만 바뀌므로 한 번 읽어 둔다 */
export function publishedGuides(): Guide[] {
  return (cached ??= loadGuides());
}

export function guidePath(slug: string): string {
  return `/guide/${encodeURIComponent(slug)}`;
}

/** '2026년 11월 10일' */
export function guideDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** 가이드 글 구조화 데이터. 작성 주체는 서비스(개인 이름 없음, A-2) */
export function buildGuideJsonLd(g: Guide, url: string, siteUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.heading,
    description: g.description,
    url,
    inLanguage: 'ko-KR',
    dateModified: g.updated,
    author: { '@id': `${siteUrl}/#org` },
    publisher: { '@id': `${siteUrl}/#org` },
    citation: g.sources.map((s) => s.url),
  };
}

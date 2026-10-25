import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * 학습용 AI 로봇은 막는다(D61·P0-9). 검색엔진(네이버·구글·Bing·다음)과 AI 검색 인용용 로봇(OAI-SearchBot·ChatGPT-User·
 * PerplexityBot 등)은 허용한다. Google-Extended를 막아도 구글 검색·AI 개요 노출에는 영향이 없다(구글 안내).
 */
export const AI_TRAINING_BOTS = ['GPTBot', 'Google-Extended', 'CCBot', 'ClaudeBot', 'Applebot-Extended', 'Bytespider', 'meta-externalagent'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/search'] },
      { userAgent: AI_TRAINING_BOTS, disallow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

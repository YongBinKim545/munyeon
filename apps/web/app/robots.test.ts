import { expect, test } from 'vitest';
import robots, { AI_TRAINING_BOTS } from './robots';

test('training bots are disallowed, everyone else may crawl except api and search (D61)', () => {
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/', disallow: ['/api/', '/search'] });
  expect(rules[1]).toEqual({ userAgent: AI_TRAINING_BOTS, disallow: '/' });
  for (const searchBot of ['Googlebot', 'Yeti', 'bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot']) expect(AI_TRAINING_BOTS).not.toContain(searchBot);
});

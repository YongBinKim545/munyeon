/**
 * DB 조회를 몇 번 다시 시도한다(D47). Vercel 빌드 서버에서 Supabase 첫 조회가 1초 남짓 만에
 * 'statement timeout'으로 취소되는 일이 있었다(2026-10-21 dev, 10-22 prod). 실패마다 걸린 시간과 오류를 로그에 남겨 원인을 좁힌다.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  {
    tries = 3,
    wait = (attempt: number) => new Promise<void>((r) => setTimeout(r, 1000 * attempt)),
    log = (msg: string) => console.error(msg),
  }: { tries?: number; wait?: (attempt: number) => Promise<void>; log?: (msg: string) => void } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const t0 = Date.now();
    try {
      return await fn();
    } catch (e) {
      const err = e as Error & { code?: string };
      log(`[${label}] ${attempt}/${tries} 실패 (${Date.now() - t0}ms) ${err.code ?? ''} ${err.message}`.replace(/\s+/g, ' ').trim());
      if (attempt >= tries) throw e;
      await wait(attempt);
    }
  }
}

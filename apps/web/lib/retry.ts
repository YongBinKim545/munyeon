/**
 * DB 조회를 몇 번 다시 시도한다(D47). Vercel 빌드 서버에서 Supabase 첫 조회가 1초 남짓 만에
 * 'statement timeout'으로 취소되고(2026-10-21 dev, 10-22 prod), 같은 연결로 다시 시도하면 응답 없이 멈췄다.
 * 그래서 시도마다 제한 시간을 두고, 다시 시도하기 전에 reset으로 연결을 새로 만든다.
 * 실패마다 걸린 시간과 오류를 로그에 남겨 원인을 좁힌다.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  {
    tries = 3,
    timeoutMs = 15_000,
    wait = (attempt: number) => new Promise<void>((r) => setTimeout(r, 1000 * attempt)),
    reset = async () => {},
    log = (msg: string) => console.error(msg),
  }: {
    tries?: number;
    timeoutMs?: number;
    wait?: (attempt: number) => Promise<void>;
    reset?: () => Promise<void>;
    log?: (msg: string) => void;
  } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const t0 = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`시간 초과 ${timeoutMs}ms`)), timeoutMs);
      });
      return await Promise.race([fn(), limit]);
    } catch (e) {
      const err = e as Error & { code?: string };
      log(`[${label}] ${attempt}/${tries} 실패 (${Date.now() - t0}ms) ${err.code ?? ''} ${err.message}`.replace(/\s+/g, ' ').trim());
      if (attempt >= tries) throw e;
      await reset();
      await wait(attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}

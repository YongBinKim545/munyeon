import { createServer } from 'node:net';

/**
 * 그 포트를 지금 다른 프로세스가 쓰고 있는지 확인한다(잠깐 열어 보고 바로 닫는다).
 * 로컬 DB는 데이터 폴더를 열기 전에 이것으로 확인한다 — 같은 폴더를 두 프로세스가 열면 손상된다(2026-10-19 사례).
 */
export function isPortFree(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

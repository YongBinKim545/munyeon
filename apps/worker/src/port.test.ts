import { createServer } from 'node:net';
import { describe, expect, test } from 'vitest';
import { isPortFree } from './port.ts';

describe('isPortFree', () => {
  test('false while another server listens, true after it closes', async () => {
    const srv = createServer();
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
    const port = (srv.address() as { port: number }).port;
    expect(await isPortFree(port)).toBe(false);
    await new Promise<void>((r) => srv.close(() => r()));
    expect(await isPortFree(port)).toBe(true);
  });
});

// 로컬 확인용 한 줄 실행: npm run local
//   1) 로컬 DB(PGlite, .pglite/에 저장) 켜기
//   2) 웹을 실서비스 모드로 빌드
//   3) 같은 와이파이의 휴대폰에서도 접속되게 실행(포트 3001)
// Ctrl+C 한 번이면 DB와 웹이 함께 꺼진다. 공공 API는 부르지 않는다(데이터 받기는 npm run sync).
// DB는 강제로 끄지 않고 'stop' 메시지로 정상 종료시킨다(강제 종료하면 .pglite/가 손상될 수 있다, 2026-10-19 사례).
//   npm run local -- --no-build   빌드 없이 실행(직전 빌드 재사용)
import { spawn, spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const PORT = 3001;
const DB_URL = 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const isWin = process.platform === 'win32';
const children = [];
let db = null;
/** DB가 정상 종료할 때까지 기다리는 최대 시간. 넘기면 그때만 강제로 끈다. */
const DB_STOP_TIMEOUT_MS = 15_000;

// npm run 으로 실행되면 npm_execpath(npm-cli.js)를 node로 직접 실행해 셸을 거치지 않는다
const NPM = process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath]] : ['npm', []];

function npm(args, opts = {}) {
  const [cmd, pre] = NPM;
  return { cmd, args: [...pre, ...args], shell: !process.env.npm_execpath && isWin, ...opts };
}

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  children.push(child);
  return child;
}

function forceKill(c) {
  if (c.exitCode !== null || !c.pid) return;
  // Windows는 npm → next 같은 손자 프로세스까지 끄려면 트리 단위로 끈다
  if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
  else c.kill('SIGTERM');
}

/** DB에 정상 종료를 요청하고 끝날 때까지 기다린다. 시간 안에 안 끝나면 강제로 끈다. */
function stopDb() {
  if (!db || db.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.error('[local] 로컬 DB가 제때 닫히지 않아 강제로 끕니다');
      forceKill(db);
      resolve();
    }, DB_STOP_TIMEOUT_MS);
    db.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      if (db.connected) db.send('stop');
    } catch {
      // 연결이 이미 끊겼으면 DB가 스스로 닫는다(disconnect)
    }
  });
}

let stopping = null;
/** 웹을 먼저 끄고(DB 연결을 놓게), DB는 정상 종료시킨다 */
function stopAll() {
  stopping ??= (async () => {
    for (const c of children) if (c !== db) forceKill(c);
    await stopDb();
  })();
  return stopping;
}

process.on('SIGINT', () => {
  console.log('\n[local] 종료합니다(로컬 DB를 정상적으로 닫는 중…)');
  void stopAll().then(() => process.exit(0));
});

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

// 1) DB: 준비 문구가 나올 때까지 기다린다
console.log('[local] 로컬 DB를 켭니다…');
// 'ipc' 채널로 정상 종료 메시지('stop')를 보낸다
db = spawn(process.execPath, ['apps/worker/src/dev-db.ts', '--real'], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
children.push(db);
await new Promise((resolve, reject) => {
  db.stdout.on('data', (d) => {
    const text = d.toString();
    process.stdout.write(`[db] ${text}`);
    if (text.includes('dev db ready')) resolve();
  });
  db.on('exit', (code) => reject(new Error(`로컬 DB가 시작되지 못했습니다(코드 ${code}). 이미 켜져 있다면 그 창을 먼저 닫으세요.`)));
}).catch(async (e) => {
  console.error(`[local] ${e.message}`);
  await stopAll();
  process.exit(1);
});

const env = { ...process.env, DATABASE_URL: DB_URL };

// 2) 빌드
if (!process.argv.includes('--no-build')) {
  console.log('[local] 웹을 빌드합니다(1~2분)…');
  const b = npm(['run', 'build', '-w', '@munyeon/web']);
  const build = spawnSync(b.cmd, b.args, { stdio: 'inherit', shell: b.shell, env });
  if (build.status !== 0) {
    console.error('[local] 빌드에 실패했습니다');
    await stopAll();
    process.exit(1);
  }
}

// 3) 실행
const w = npm(['run', 'start', '-w', '@munyeon/web', '--', '-H', '0.0.0.0', '-p', String(PORT)]);
const web = run(w.cmd, w.args, { env, shell: w.shell });
setTimeout(() => {
  console.log('\n[local] 접속 주소');
  console.log(`  PC      : http://localhost:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  휴대폰  : http://${ip}:${PORT}  (같은 와이파이)`);
  console.log('  끄기    : Ctrl + C\n');
}, 3000);
web.on('exit', (code) => {
  if (stopping) return; // Ctrl+C로 끄는 중이면 SIGINT 쪽에서 마무리한다
  console.log(`[local] 웹 서버가 종료됐습니다(코드 ${code})`);
  void stopAll().then(() => process.exit(code ?? 0));
});

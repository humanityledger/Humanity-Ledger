import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

/**
 * scripts/serve.js (27 Nov 2026): on SIGTERM the server keeps answering during the grace period,
 * then stops; a crash of the server is passed on as a failure so Railway restarts it.
 */
const root = process.cwd();
const fakeServer = `
const http = require('node:http');
const s = http.createServer((_, res) => res.end('ok'));
s.listen(0, '127.0.0.1', () => console.log('PORT=' + s.address().port));
process.on('SIGTERM', () => { console.log('CHILD_SIGTERM'); s.close(() => process.exit(0)); });
if (process.env.FAKE_CRASH) setTimeout(() => process.exit(3), 100);
`;

function run(env: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-'));
  const child = path.join(dir, 'child.js');
  fs.writeFileSync(child, fakeServer);
  const p = spawn(process.execPath, [path.join(root, 'scripts/serve.js')], {
    env: { ...process.env, SERVE_CHILD: child, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  p.stdout.on('data', (d) => { out += String(d); });
  p.stderr.on('data', (d) => { out += String(d); });
  const exited = new Promise<number | null>((r) => p.on('exit', (c) => r(c)));
  const port = new Promise<number>((resolve) => {
    const t = setInterval(() => {
      const m = /PORT=(\d+)/.exec(out);
      if (m) { clearInterval(t); resolve(Number(m[1])); }
    }, 20);
  });
  return { p, exited, port, output: () => out };
}

const get = (port: number) => new Promise<string>((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, agent: false }, (res: any) => {
    let b = ''; res.on('data', (d: any) => { b += d; }); res.on('end', () => resolve(b));
  }).on('error', reject);
});

describe('scripts/serve.js graceful shutdown', () => {
  it('keeps serving during the grace period after SIGTERM, then stops cleanly', async () => {
    const s = run({ SHUTDOWN_GRACE_MS: '400', SHUTDOWN_KILL_MS: '2000' });
    const port = await s.port;
    expect(await get(port)).toBe('ok');
    s.p.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 150));
    expect(await get(port)).toBe('ok'); // still answering within the grace period
    expect(s.output()).not.toContain('CHILD_SIGTERM');
    expect(await s.exited).toBe(0);
    expect(s.output()).toContain('CHILD_SIGTERM');
  });

  it('a crash of the server exits non-zero (Railway restarts it)', async () => {
    const s = run({ FAKE_CRASH: '1' });
    const code = await s.exited;
    expect(code).toBe(3);
    expect(s.output()).toMatch(/exited unexpectedly/);
  });

  it('start.sh launches it and railway.toml restarts always and drains', () => {
    expect(fs.readFileSync('start.sh', 'utf8')).toMatch(/exec node scripts\/serve\.js/);
    const toml = fs.readFileSync('railway.toml', 'utf8');
    expect(toml).toMatch(/restartPolicyType = "ALWAYS"/);
    expect(toml).toMatch(/drainingSeconds = 30/);
    expect(toml).toMatch(/overlapSeconds = 30/);
  });
});

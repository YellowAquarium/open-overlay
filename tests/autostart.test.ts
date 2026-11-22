import { test } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAST = {
  GAME_CHECK_INTERVAL_MS: '150',
  GAME_RESTART_GRACE_MS: '400',
  GAME_QUIET_MS: '200',
  GAME_START_TIMEOUT_MS: '800',
};

function startProxy(port: number, args: string[]): { child: ChildProcess; output: () => string; exited: Promise<number | null> } {
  let text = '';
  const child = spawn(process.execPath, [path.join(root, 'proxy.js'), ...args], {
    cwd: root,
    env: { ...process.env, ...FAST, PROXY_PORT: String(port), ORM_UPSTREAM: 'http://127.0.0.1:9', OPEN_OVERLAY_CACHE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'open-overlay-test-')) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout!.on('data', (chunk) => { text += String(chunk); });
  const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  return { child, output: () => text, exited };
}

async function waitFor(check: () => boolean, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms))]);
}

test('--game-pid: the proxy stops by itself after the game process exits', async () => {
  const game = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  const proxy = startProxy(18911, ['--game-pid', String(game.pid)]);
  try {
    await waitFor(() => proxy.output().includes('listening'), 5000);
    assert.match(proxy.output(), /stops by itself when the game closes/);
    // Still running while the game runs.
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(proxy.child.exitCode, null);
    game.kill();
    const code = await withTimeout(proxy.exited, 8000, 'proxy exit');
    assert.equal(code, 0);
    assert.match(proxy.output(), /Stopping: Subway Builder closed/);
  } finally {
    game.kill();
    proxy.child.kill();
  }
});

test('--with-game: gives up if the game never starts', async () => {
  const proxy = startProxy(18912, ['--with-game']);
  try {
    const code = await withTimeout(proxy.exited, 8000, 'proxy exit');
    assert.equal(code, 0);
    assert.match(proxy.output(), /did not start/);
  } finally {
    proxy.child.kill();
  }
});

test('a second auto-started proxy exits quietly when one is already running', async () => {
  const first = startProxy(18913, []);
  try {
    await waitFor(() => first.output().includes('listening'), 5000);
    const second = startProxy(18913, ['--with-game']);
    const code = await withTimeout(second.exited, 5000, 'second proxy exit');
    assert.equal(code, 0);
    assert.match(second.output(), /another proxy is running/);
    // A normally started proxy keeps running.
    assert.equal(first.child.exitCode, null);
  } finally {
    first.child.kill();
  }
});

test('--with-game: the mod heartbeat keeps the proxy alive even if no game process is visible', async () => {
  const proxy = startProxy(18914, ['--with-game']);
  let beating = true;
  try {
    await waitFor(() => proxy.output().includes('listening'), 5000);
    const beat = async () => {
      while (beating) {
        await fetch('http://127.0.0.1:18914/heartbeat').catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    };
    void beat();
    // Longer than GAME_START_TIMEOUT_MS (800 ms in these tests): still running thanks to heartbeats.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    assert.equal(proxy.child.exitCode, null);
    assert.match(proxy.output(), /following the game through the mod's heartbeat/);
    // Game closes -> heartbeats stop -> proxy stops.
    beating = false;
    const code = await withTimeout(proxy.exited, 5000, 'proxy exit');
    assert.equal(code, 0);
    assert.match(proxy.output(), /Stopping: Subway Builder closed/);
  } finally {
    beating = false;
    proxy.child.kill();
  }
});

test('websites cannot ask the proxy to open folders', async () => {
  const proxy = startProxy(18915, []);
  try {
    await waitFor(() => proxy.output().includes('listening'), 5000);
    const response = await fetch('http://127.0.0.1:18915/cache/open', { method: 'POST', headers: { origin: 'https://evil.example' } });
    assert.equal(response.status, 403);
    const health = await (await fetch('http://127.0.0.1:18915/health')).json();
    assert.ok(health.diskCacheDir);
  } finally {
    proxy.child.kill();
  }
});

test('--game-exe: watches the exact game program and stops once it closes', async () => {
  // A stand-in "game": a copy of node under a distinctive name.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-overlay-game-'));
  const exe = path.join(dir, process.platform === 'win32' ? 'FakeGame.exe' : 'fakegame');
  fs.copyFileSync(process.execPath, exe);
  fs.chmodSync(exe, 0o755);
  const game = spawn(exe, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  const proxy = startProxy(18916, ['--with-game', '--game-exe', exe]);
  try {
    await waitFor(() => proxy.output().includes('Watching the game process'), 8000);
    // Longer than the start timeout and the heartbeat timeout: still running because the game is.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal(proxy.child.exitCode, null);
    game.kill();
    const code = await withTimeout(proxy.exited, 8000, 'proxy exit');
    assert.equal(code, 0);
    assert.match(proxy.output(), /Stopping: Subway Builder closed/);
  } finally {
    game.kill();
    proxy.child.kill();
  }
});

test('status checks are served on the separate status port', async () => {
  const proxy = startProxy(18921, []);
  try {
    await waitFor(() => proxy.output().includes('listening'), 5000);
    await waitFor(() => true, 100);
    const health = await (await fetch('http://127.0.0.1:18922/health')).json();
    assert.equal(health.service, 'open-overlay-proxy');
    assert.equal(health.statusPort, 18922);
    assert.equal((await fetch('http://127.0.0.1:18922/heartbeat')).status, 204);
  } finally {
    proxy.child.kill();
  }
});

test('an auto-started proxy takes over from an older version still running', async () => {
  // Stand-in for an old proxy that is still holding the port.
  const old = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ready: true, service: 'open-overlay-proxy', version: '0.0.1' }));
    } else if (req.method === 'POST' && req.url === '/shutdown') {
      res.writeHead(202);
      res.end();
      old.close();
      old.closeAllConnections?.();
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => old.listen(18925, '127.0.0.1', resolve));
  const proxy = startProxy(18925, ['--with-game']);
  try {
    await waitFor(() => proxy.output().includes('listening at'), 8000);
    assert.match(proxy.output(), /older proxy \(v0\.0\.1\) is running; asking it to stop/);
    const health = await (await fetch('http://127.0.0.1:18925/health')).json();
    assert.notEqual(health.version, '0.0.1');
  } finally {
    proxy.child.kill();
    old.close();
  }
});

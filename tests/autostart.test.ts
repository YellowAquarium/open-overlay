import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
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
    env: { ...process.env, ...FAST, PROXY_PORT: String(port), ORM_UPSTREAM: 'http://127.0.0.1:9' },
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

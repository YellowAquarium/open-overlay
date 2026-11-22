import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the built mod with a fake game and presses the shortcuts.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Ctrl+T toggles the railway overlay and Ctrl+M the satellite imagery', async () => {
  const code = fs.readFileSync(path.join(root, 'dist', 'index.js'), 'utf8');
  const g = globalThis as Record<string, any>;
  const listeners: Array<(e: any) => void> = [];
  const notes: string[] = [];
  let mapReady: ((map: unknown) => void) | null = null;
  const React = { createElement: () => null, useState: (v: unknown) => [v, () => undefined], useEffect: () => undefined, useRef: (v: unknown) => ({ current: v }) };
  g.window = globalThis;
  g.addEventListener = (type: string, fn: (e: any) => void) => { if (type === 'keydown') listeners.push(fn); };
  g.localStorage = { getItem: () => null, setItem: () => undefined };
  g.document = { getElementById: () => null, createElement: () => ({}), head: { appendChild: () => undefined }, documentElement: { classList: { contains: () => false } } };
  g.fetch = async () => { throw new Error('Failed to fetch'); };
  g.setInterval = () => 0;
  g.SubwayBuilderAPI = {
    version: 'test',
    utils: { React, components: {}, icons: {} },
    ui: { addFloatingPanel: () => undefined, showNotification: (m: string) => notes.push(m) },
    hooks: { onMapReady: (fn: any) => { mapReady = fn; }, onGameEnd: () => undefined },
    storage: { get: async (_k: string, d: unknown) => d, set: async () => undefined },
  };
  new Function(code)();
  mapReady!({ on() {}, off() {}, getStyle: () => ({ layers: [] }), getSource() {}, getLayer() {}, getLayersOrder: () => [] });
  await new Promise((resolve) => setTimeout(resolve, 50));

  const press = (key: string, extra: Record<string, unknown> = {}) => {
    let prevented = false;
    const event = { key, ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, repeat: false, target: { tagName: 'CANVAS' }, preventDefault: () => { prevented = true; }, stopPropagation: () => undefined, ...extra };
    for (const fn of listeners) fn(event);
    return prevented;
  };
  assert.equal(press('t'), true);
  assert.match(notes.at(-1)!, /Railway overlay on/);
  press('T');
  assert.match(notes.at(-1)!, /Railway overlay off/);
  press('m');
  assert.match(notes.at(-1)!, /Satellite imagery on/);
  // Not while typing in a text box, and not without Ctrl.
  const count = notes.length;
  assert.equal(press('t', { target: { tagName: 'INPUT' } }), false);
  assert.equal(press('t', { ctrlKey: false }), false);
  assert.equal(notes.length, count);
});

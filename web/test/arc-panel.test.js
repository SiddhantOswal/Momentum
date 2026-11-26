import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, ws: false, watch: null },
  });
});
after(async () => vite?.close());

async function panel(showHistory = false) {
  const { ArcPanel } = await vite.ssrLoadModule('/src/components/ArcPanel.tsx');
  return renderToStaticMarkup(createElement(ArcPanel, { open: false, hostTitle: 'Floor', showHistory, onToggleHistory() {}, onClose() {}, onNavigate() {} }));
}

const tag = (html, label) => new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`).exec(html)?.[0];

test('the Arc microphone is disabled, described as unavailable and has no handler', async () => {
  const html = await panel();
  const mic = tag(html, 'Speak to Arc');
  assert.ok(mic);
  assert.match(mic, /disabled/);
  assert.match(mic, /aria-describedby="arc-voice-status"/);
  assert.doesNotMatch(mic, /\bon[A-Z]/);
  assert.match(html, /id="arc-voice-status"[^>]*>Voice input is unavailable\./);
});

test('before the session read returns, the panel shows no connection, no composer input and no start actions', async () => {
  const messages = await panel();
  const history = await panel(true);
  assert.match(messages, /aria-label="Arc by Momentum"/);
  assert.match(messages, /role="log" aria-label="Arc messages"/);
  assert.match(messages, /Connecting/);
  assert.match(messages, /<textarea[^>]*disabled/);
  assert.match(tag(messages, 'Send'), /disabled/);
  assert.doesNotMatch(messages, /Or start something|PKBX|Approve|Next for you/);
  assert.match(history, /aria-label="Past work"/);
});

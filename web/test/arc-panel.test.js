import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Children, isValidElement } from 'react';
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
  return ArcPanel({ hostTitle: 'Floor', showHistory });
}

function* elements(tree) {
  for (const node of Children.toArray(tree)) {
    if (!isValidElement(node)) continue;
    yield node;
    yield* elements(node.props.children);
  }
}

test('the Arc microphone is disabled, described as unavailable and has no event props', async () => {
  const nodes = [...elements(await panel())];
  const mic = nodes.find(node => node.type === 'button' && node.props['aria-label'] === 'Speak to Arc');
  assert.ok(mic);
  assert.equal(mic.props.disabled, true);
  assert.deepEqual(Object.keys(mic.props).filter(name => /^on[A-Z]/.test(name)), []);
  const description = nodes.find(node => node.props.id === mic.props['aria-describedby']);
  assert.equal(description?.props.children, 'Voice input is unavailable.');
});

test('the disconnected Arc panel has empty messages and history and no submit action', async () => {
  const messages = renderToStaticMarkup(await panel());
  const history = renderToStaticMarkup(await panel(true));
  assert.match(messages, /aria-label="Arc by Momentum"/);
  assert.match(messages, /role="log" aria-label="Arc messages"/);
  assert.match(messages, /Not connected/);
  assert.match(messages, /aria-label="Message Arc"/);
  assert.match(messages, /<button type="button"[^>]*aria-label="Send"[^>]*disabled/);
  assert.match(messages, /New lot/);
  assert.doesNotMatch(messages, /PKBX|Approve|Sample data/);
  assert.match(history, /aria-label="Past work"/);
  assert.match(history, /Not connected/);
});

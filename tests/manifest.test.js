const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('manifest references all bundled runtime files', () => {
  for (const file of [...manifest.content_scripts[0].js, ...manifest.content_scripts[0].css, ...manifest.background.scripts, manifest.options_ui.page]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
});

test('manifest covers contest, gym, problemset, storage, and runner permissions', () => {
  const matches = manifest.content_scripts[0].matches.join('\n');
  assert.match(matches, /gym/);
  assert.match(matches, /problemset/);
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.host_permissions.includes('http://127.0.0.1:2000/*'));
  assert.equal(manifest.host_permissions.some(value => value.includes('emkc.org')), false);
  assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
  assert.equal(manifest.background.scripts[0], 'background.js');
});

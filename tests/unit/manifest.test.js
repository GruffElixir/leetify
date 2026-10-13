import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
test('built manifest retains extension identity, minimum version and scoped routes', () => {
  assert.equal(manifest.version, '3.1.0');
  assert.equal(manifest.browser_specific_settings.gecko.id, 'leetify-cf@yourdomain.com');
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '128.0');
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, [
    'websiteContent',
  ]);
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.optional_host_permissions.includes('https://*/*'));
  assert.equal(manifest.content_scripts[0].matches.length, 6);
  assert.ok(
    manifest.content_scripts[0].matches.every((pattern) => /codeforces\.com\//.test(pattern))
  );
});
test('every packaged runtime, options page, icon and font is present', () => {
  const files = [
    ...manifest.background.scripts,
    manifest.options_ui.page,
    ...Object.values(manifest.icons || {}),
    ...manifest.content_scripts.flatMap((script) => [...script.js, ...script.css]),
  ];
  for (const file of files) assert.ok(existsSync(path.join(root, file)), file);
  const styles = readFileSync(path.join(root, 'styles.css'), 'utf8');
  for (const match of styles.matchAll(/url\((?:['"])?(fonts\/[^)'" ]+)/g))
    assert.ok(existsSync(path.join(root, match[1])), match[1]);
  assert.ok(readdirSync(path.join(root, 'fonts')).length > 0);
  assert.ok(existsSync(path.join(root, 'THIRD_PARTY_NOTICES.md')));
  assert.ok(readFileSync(path.join(root, 'options.html'), 'utf8').includes('leetify-options'));
});
test('extension pages only execute packaged scripts', () => {
  for (const file of readdirSync(root).filter((file) => file.endsWith('.html'))) {
    const html = readFileSync(path.join(root, file), 'utf8');
    for (const match of html.matchAll(/<script[^>]+src=['"]([^'"]+)/g)) {
      assert.ok(!/^(https?:)?\/\//.test(match[1]));
      assert.ok(existsSync(path.join(root, match[1])));
    }
  }
  assert.deepEqual(manifest.content_scripts[0].js, ['content.js']);
});

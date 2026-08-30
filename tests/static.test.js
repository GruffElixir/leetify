const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');
const styles = read('styles.css');
const content = read('content.js');
const options = read('options.js');

test('editor typography cannot be overridden by the generic textarea rule', () => {
  assert.match(styles, /#leetify-split-container\s+:where\(button, input, select, textarea\)\s*\{\s*font: inherit;/);
  assert.match(styles, /#leetify-highlight-layer,[\r\n]+#leetify-code-input\s*\{[\s\S]*font: 400 var\(--ed-font-size\)\/var\(--ed-line-height\)/);
  assert.match(styles, /font-variant-ligatures: none/);
});

test('responsive panes expose a saved height and use vertical resize semantics', () => {
  assert.match(content, /settings\.paneHeight/);
  assert.match(content, /event\.clientY/);
  assert.match(content, /aria-orientation/);
  assert.match(styles, /height: var\(--pane-height, 42%\)/);
});

test('sample and submission paths use current Codeforces markup', () => {
  assert.match(content, /clone\.querySelectorAll\('br'\)/);
  assert.match(content, /form\.submit-form/);
  assert.match(content, /submittedProblemCode/);
  assert.match(content, /problemset\/status\/\$\{route\.id\}\/problem/);
  assert.match(content, /my=on&order=BY_ARRIVED_DESC/);
  assert.match(content, /actionUrl\.searchParams\.delete\('csrf_token'\)/);
});

test('the runner default is local and storage writes are split into records', () => {
  assert.match(content, /http:\/\/127\.0\.0\.1:2000\/api\/v2\/execute/);
  assert.match(options, /http:\/\/127\.0\.0\.1:2000\/api\/v2\/execute/);
  assert.match(content, /leetify_solution_v2:/);
  assert.match(content, /leetify_templates_v2:/);
});

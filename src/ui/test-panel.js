import { button } from './icons.js';
import { bindTabs } from './tabs.js';
export function createTestPanel({
  parent,
  onChange = () => {},
  onRun = () => {},
  onCancel = () => {},
}) {
  const doc = parent.ownerDocument;
  const root = doc.createElement('section');
  root.className = 'lf-test-panel';
  root.setAttribute('aria-label', 'Test cases and results');
  root.innerHTML =
    '<div class="lf-test-head"><div role="tablist" aria-label="Test view"><button role="tab" data-view="cases" aria-selected="true">Test cases</button><button role="tab" data-view="results" aria-selected="false">Results</button></div><span class="lf-test-summary" role="status">Ready to run</span></div><div class="lf-case-tabs"></div><div class="lf-test-body"></div><div class="lf-test-actions"></div>';
  parent.append(root);
  const tabs = root.querySelector('.lf-case-tabs');
  const body = root.querySelector('.lf-test-body');
  const summary = root.querySelector('.lf-test-summary');
  const actions = root.querySelector('.lf-test-actions');
  const add = button(doc, { label: 'Add custom case', name: 'plus', text: true });
  const remove = button(doc, { label: 'Remove case', name: 'close', text: true });
  const run = button(doc, { label: 'Run selected', name: 'play', text: true });
  const cancel = button(doc, { label: 'Cancel tests', name: 'stop', text: true });
  cancel.hidden = true;
  actions.append(add, remove, run, cancel);
  let cases = [];
  let selected = null;
  let view = 'cases';
  const results = new Map();
  const emit = () => onChange(structuredClone(cases.filter((c) => c.custom)));
  function renderTabs() {
    tabs.replaceChildren();
    for (const sample of cases) {
      const tab = button(doc, { label: sample.name || 'Custom case', text: true });
      tab.dataset.id = sample.id;
      tab.dataset.selected = String(sample.id === selected);
      tab.dataset.status = results.get(sample.id)?.status || '';
      tab.setAttribute('aria-pressed', sample.id === selected);
      tab.addEventListener('click', () => {
        selected = sample.id;
        render();
      });
      tabs.append(tab);
    }
  }
  function area(label, value, { readonly = false, onInput, attribute } = {}) {
    const field = doc.createElement('label');
    field.className = 'lf-test-field';
    const heading = doc.createElement('span');
    heading.textContent = label;
    const input = readonly ? doc.createElement('pre') : doc.createElement('textarea');
    if (readonly) input.textContent = value;
    else {
      input.value = value;
      input.setAttribute('aria-label', label);
      input.spellcheck = false;
      input.addEventListener('input', () => onInput(input.value));
    }
    if (attribute) input.setAttribute(attribute, '');
    field.append(heading, input);
    return field;
  }
  function render() {
    renderTabs();
    body.replaceChildren();
    const sample = cases.find((c) => c.id === selected);
    remove.hidden = !sample?.custom;
    run.disabled = !sample;
    if (!sample) {
      const empty = doc.createElement('p');
      empty.className = 'lf-empty';
      empty.textContent = 'No samples were provided. Add a custom case to run your solution.';
      body.append(empty);
      return;
    }
    if (view === 'cases') {
      body.className = 'lf-test-body lf-case-fields';
      body.append(
        area('Input', sample.input, {
          readonly: !sample.custom,
          onInput: (value) => {
            sample.input = value;
            emit();
          },
        })
      );
      const output = area('Expected output', sample.expected, {
        readonly: !sample.custom,
        onInput: (value) => {
          sample.expected = value;
          emit();
        },
      });
      body.append(output);
      if (sample.custom) {
        const label = doc.createElement('label');
        label.className = 'lf-compare-check';
        const checkbox = doc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = sample.hasExpected;
        checkbox.addEventListener('change', () => {
          sample.hasExpected = checkbox.checked;
          emit();
        });
        label.append(checkbox, doc.createTextNode('Compare expected output'));
        output.append(label);
      }
    } else {
      body.className = 'lf-test-body lf-result-fields';
      const result = results.get(sample.id);
      if (!result) {
        const empty = doc.createElement('p');
        empty.className = 'lf-empty';
        empty.textContent = 'Run this case to see its result.';
        body.append(empty);
        return;
      }
      body.append(
        area('Actual output', result.actual || '', { readonly: true, attribute: 'data-actual' }),
        area(
          'Expected output',
          sample.hasExpected ? sample.expected : 'No comparison (custom input)',
          { readonly: true }
        )
      );
      const diagnostics = doc.createElement('div');
      diagnostics.className = 'lf-diagnostics';
      diagnostics.setAttribute('data-diagnostics', '');
      const label = doc.createElement('span');
      label.textContent =
        result.status === 'passed'
          ? result.comparison === 'tokens'
            ? 'Passed · whitespace tokens'
            : 'Passed'
          : result.status === 'ran'
            ? 'Ran successfully'
            : result.status === 'failed'
              ? 'Wrong answer'
              : 'Execution error';
      label.dataset.status = result.status;
      diagnostics.append(label);
      for (const entry of result.diagnostics || []) {
        const block = doc.createElement('pre');
        block.textContent = `${entry.stage}: ${entry.text}`;
        diagnostics.append(block);
      }
      body.append(diagnostics);
    }
  }
  const click = (event) => {
    const next = event.target.closest('[data-view]')?.dataset.view;
    if (!next) return;
    view = next;
    root
      .querySelectorAll('[data-view]')
      .forEach((tab) => tab.setAttribute('aria-selected', tab.dataset.view === view));
    render();
  };
  root.addEventListener('click', click);
  const unbindTabs = bindTabs(root);
  add.addEventListener('click', () => {
    const entry = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `Custom ${cases.filter((c) => c.custom).length + 1}`,
      input: '',
      expected: '',
      hasExpected: false,
      custom: true,
    };
    cases.push(entry);
    selected = entry.id;
    view = 'cases';
    root.querySelector('[data-view=cases]').click();
    emit();
    render();
  });
  remove.addEventListener('click', () => {
    cases = cases.filter((c) => c.id !== selected);
    selected = cases[0]?.id || null;
    emit();
    render();
  });
  run.addEventListener('click', () => onRun(selected));
  cancel.addEventListener('click', onCancel);
  return {
    setCases(next) {
      cases = structuredClone(next);
      selected = cases.some((c) => c.id === selected) ? selected : cases[0]?.id || null;
      results.clear();
      summary.textContent = 'Ready to run';
      render();
    },
    getCases: () => structuredClone(cases),
    setResult(result) {
      if (!cases.some((c) => c.id === result.id)) return;
      results.set(result.id, structuredClone(result));
      renderTabs();
      if (view === 'results') render();
    },
    setSummary(value) {
      summary.textContent =
        typeof value === 'string'
          ? value
          : value.cancelled
            ? 'Cancelled'
            : `${value.passed} passed · ${value.failed} failed · ${value.results.length}/${value.total} ran`;
    },
    setRunning(value) {
      run.disabled = value;
      cancel.hidden = !value;
    },
    showResults() {
      root.querySelector('[data-view=results]').click();
    },
    dispose() {
      unbindTabs();
      root.removeEventListener('click', click);
      root.remove();
    },
  };
}

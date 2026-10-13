import { button, icon } from './icons.js';
import { LANGUAGES } from '../domain/languages.js';
import { bindTabs, selectTab } from './tabs.js';
export function createShell({ document: doc, settings, onAction }) {
  const root = doc.createElement('section');
  root.id = 'leetify-workspace';
  root.setAttribute('aria-label', 'Leetify coding workspace');
  root.className = 'leetify';
  root.innerHTML =
    '<header class="lf-toolbar"><div class="lf-toolbar-start"><a class="lf-brand" href="https://github.com/GruffElixir/leetify" target="_blank" rel="noopener noreferrer"><span class="lf-brand-mark"></span><strong>leetify</strong></a><span class="lf-toolbar-divider"></span><div class="lf-problem-nav"></div></div><div class="lf-primary-actions"></div><div class="lf-toolbar-end"></div></header><div class="lf-mobile-tabs" role="tablist" aria-label="Workspace view"><button role="tab" data-action="mobile-description" aria-selected="true">Description</button><button role="tab" data-action="mobile-code" aria-selected="false">Code</button></div><main class="lf-workspace-main"><section class="lf-description-pane"><div class="lf-pane-head"><div class="lf-statement-tabs" role="tablist" aria-label="Problem view"><button role="tab" data-action="description" aria-selected="true">Description</button><button role="tab" data-action="submissions" aria-selected="false">Submissions</button></div><span class="lf-problem-label"></span></div><div class="lf-statement-scroll"><div class="lf-problem-heading"><h1></h1><div class="lf-meta"></div></div><div class="lf-description"></div></div><div class="lf-submissions" hidden></div></section><div class="lf-pane-splitter" tabindex="0" role="separator" aria-label="Resize description" aria-orientation="vertical"></div><section class="lf-code-pane"><div class="lf-pane-head lf-editor-head"><div class="lf-language"><span class="lf-file-icon"></span><select aria-label="Language"></select></div><span class="lf-save-status" data-status="save" role="status">Saved locally</span><div class="lf-editor-tools"></div></div><div class="lf-editor"></div><div class="lf-test-splitter" role="separator" tabindex="0" aria-label="Resize tests" aria-orientation="horizontal"></div><div class="lf-tests"></div><footer class="lf-statusbar"><span data-status="runner">Runner not connected</span><span data-status="message" role="status"></span><span data-status="cursor">Ln 1, Col 1</span><span class="lf-encoding">UTF-8</span></footer></section></main><div class="lf-toast" hidden></div>';
  root.querySelector('.lf-brand-mark').append(icon('code', doc));
  root.querySelector('.lf-file-icon').append(icon('code', doc));
  root
    .querySelector('.lf-problem-label')
    .append(button(doc, { label: 'Choose problem', name: 'list', action: 'problems' }));
  const unbindTabs = bindTabs(root);
  const nav = root.querySelector('.lf-problem-nav');
  nav.append(
    button(doc, { label: 'Previous problem', name: 'chevronLeft', action: 'previous' }),
    button(doc, { label: 'Problems', name: 'list', action: 'problems', text: true }),
    button(doc, { label: 'Next problem', name: 'chevronRight', action: 'next' })
  );
  const primary = root.querySelector('.lf-primary-actions');
  const run = button(doc, {
    label: 'Run all',
    name: 'play',
    action: 'run',
    text: true,
    variant: 'lf-run',
  });
  const cancel = button(doc, { label: 'Cancel run', name: 'stop', action: 'cancel', text: true });
  cancel.hidden = true;
  const submit = button(doc, {
    label: 'Submit',
    name: 'send',
    action: 'submit',
    text: true,
    variant: 'lf-submit',
  });
  primary.append(run, cancel, submit);
  const end = root.querySelector('.lf-toolbar-end');
  for (const [label, name, action] of [
    ['Theme', 'theme', 'theme'],
    ['Layout', 'layout', 'layout'],
    ['Focus mode', 'focus', 'focus'],
    ['Settings', 'settings', 'settings'],
    ['Exit workspace', 'exit', 'exit'],
  ])
    end.append(button(doc, { label, name, action }));
  const saveStatus = root.querySelector('.lf-save-status');
  const saveButton = doc.createElement('button');
  saveButton.type = 'button';
  saveButton.className = saveStatus.className;
  saveButton.dataset.status = 'save';
  saveButton.dataset.action = 'retry-save';
  saveButton.setAttribute('aria-live', 'polite');
  saveButton.title = 'Save or review draft';
  saveButton.textContent = saveStatus.textContent;
  saveStatus.replaceWith(saveButton);
  const tools = root.querySelector('.lf-editor-tools');
  tools.append(
    button(doc, { label: 'Templates and recovery', name: 'template', action: 'templates' }),
    button(doc, { label: 'Editor tools', name: 'more', action: 'tools' })
  );
  const select = root.querySelector('select');
  for (const [value, lang] of Object.entries(LANGUAGES)) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = lang.label;
    select.append(option);
  }
  select.value = settings.defaultLang;
  const refs = {
    root,
    run,
    submit,
    cancel,
    language: select,
    title: root.querySelector('h1'),
    meta: root.querySelector('.lf-meta'),
    description: root.querySelector('.lf-description'),
    statementScroll: root.querySelector('.lf-statement-scroll'),
    submissions: root.querySelector('.lf-submissions'),
    editor: root.querySelector('.lf-editor'),
    tests: root.querySelector('.lf-tests'),
    paneSplitter: root.querySelector('.lf-pane-splitter'),
    testSplitter: root.querySelector('.lf-test-splitter'),
  };
  const click = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action) onAction(action);
  };
  root.addEventListener('click', click);
  const change = () => onAction('language', select.value);
  select.addEventListener('change', change);
  function configure(config) {
    root.dataset.theme = config.theme;
    root.dataset.layout = config.layout;
    root.dataset.focus = String(config.focus);
    root.style.setProperty('--lf-pane-width', `${config.paneWidth}%`);
    root.style.setProperty('--lf-pane-height', `${config.paneHeight}%`);
    root.style.setProperty('--lf-test-height', `${config.testHeight}%`);
    root.style.setProperty('--lf-problem-font', `${config.problemFontSize}px`);
    const stacked =
      config.layout === 'horizontal' || doc.defaultView.matchMedia('(max-width:899px)').matches;
    refs.paneSplitter.setAttribute('aria-valuenow', stacked ? config.paneHeight : config.paneWidth);
    refs.paneSplitter.setAttribute('aria-orientation', stacked ? 'horizontal' : 'vertical');
    refs.testSplitter.setAttribute('aria-valuenow', config.testHeight);
  }
  configure(settings);
  root.dataset.mobileView = 'description';
  return {
    ...refs,
    configure,
    setActiveView(view) {
      refs.statementScroll.hidden = view === 'submissions';
      refs.submissions.hidden = view !== 'submissions';
      selectTab(
        root.querySelector('.lf-statement-tabs'),
        root.querySelector(`[data-action="${view}"]`)
      );
    },
    setMobileView(view) {
      root.dataset.mobileView = view;
      selectTab(
        root.querySelector('.lf-mobile-tabs'),
        root.querySelector(`[data-action="mobile-${view}"]`)
      );
    },
    setStatus(kind, text, state = '') {
      const target = root.querySelector(`[data-status="${kind}"]`);
      if (target) {
        target.textContent = text;
        target.dataset.state = state;
      }
    },
    setRunning(value) {
      run.hidden = value;
      cancel.hidden = !value;
    },
    dispose() {
      unbindTabs();
      root.removeEventListener('click', click);
      select.removeEventListener('change', change);
      root.remove();
    },
  };
}

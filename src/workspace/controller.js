import { LANGUAGES, isLanguage } from '../domain/languages.js';
import {
  parseProblemUrl,
  problemKey,
  problemUrl,
  submitUrl,
  statusUrl,
} from '../domain/problem.js';
import { normalizeSettings, runnerUrl } from '../domain/settings.js';
import { parseProblemDocument, sanitizeStatement } from '../codeforces/problem.js';
import { renderRawMath } from '../codeforces/math.js';
import { parseStatusRecords } from '../codeforces/status.js';
import { createRunBatch } from '../runner/batch.js';
import { createShell } from '../ui/shell.js';
import { createEditor } from '../ui/editor.js';
import { createTestPanel } from '../ui/test-panel.js';
import { createSubmissions } from '../ui/submissions.js';
import { openTemplates } from '../ui/templates.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { button } from '../ui/icons.js';
import { bindSplitter } from '../ui/splitter.js';

export class WorkspaceController {
  constructor({ window, document, storage, network, runner, submission }) {
    Object.assign(this, { window, document, storage, network, runner, submission });
    this.drafts = new Map();
    this.caseWrites = new Map();
    this.disposers = [];
    this.navigation = 0;
    this.runGeneration = 0;
    this.active = false;
    this.initialized = false;
    this.saveTimer = null;
    this.autoTimer = null;
    this.settingsTimer = null;
    this.pendingSettings = {};
    this.remoteRecords = [];
  }
  async initialize() {
    if (this.initialized) return;
    const legacy = {};
    try {
      for (let i = 0; i < this.window.localStorage.length; i++) {
        const key = this.window.localStorage.key(i);
        if (key.startsWith('leetify_')) legacy[key] = this.window.localStorage.getItem(key);
      }
    } catch {
      /* Storage can be disabled by the site/browser. */
    }
    this.state = await this.storage.initialize(legacy);
    this.settings = normalizeSettings(this.state.settings);
    this.current = parseProblemDocument(this.document, this.window.location.href);
    this.language = this.settings.defaultLang;
    this.nativeUrl = this.window.location.href;
    this.nativeKey = problemKey(this.current.route);
    this.currentUrl = this.nativeUrl;
    this.nativeStatement = this.current.statement;
    this.originalParent = this.nativeStatement.parentNode;
    this.placeholder = this.document.createComment('Leetify statement position');
    this.originalParent.insertBefore(this.placeholder, this.nativeStatement);
    this.problemList = this.current.problems;
    this.shell = createShell({
      document: this.document,
      settings: this.settings,
      onAction: (action, value) => {
        Promise.resolve(this.action(action, value)).catch((error) => this.message(error.message));
      },
    });
    this.editor = createEditor({
      parent: this.shell.editor,
      language: this.language,
      code: '',
      settings: this.settings,
      onChange: (code) => this.edited(code),
      onCursor: (cursor) =>
        this.shell.setStatus('cursor', `Ln ${cursor.line}, Col ${cursor.column}`),
    });
    this.tests = createTestPanel({
      parent: this.shell.tests,
      onChange: (cases) => this.casesChanged(cases),
      onRun: (id) => this.run([id]),
      onCancel: () => this.cancelRun(),
    });
    this.submissions = createSubmissions({
      parent: this.shell.submissions,
      onRefresh: () => this.refreshSubmissions(),
      nativeUrl: statusUrl(this.current.route),
    });
    this.disposers.push(
      bindSplitter({
        element: this.shell.paneSplitter,
        axis: () => (this.stacked() ? 'y' : 'x'),
        getValue: () => this.settings[this.stacked() ? 'paneHeight' : 'paneWidth'],
        onChange: (value) =>
          this.patchSettings({ [this.stacked() ? 'paneHeight' : 'paneWidth']: value }),
      }),
      bindSplitter({
        element: this.shell.testSplitter,
        axis: 'y',
        invert: true,
        min: 18,
        max: 65,
        getValue: () => this.settings.testHeight,
        onChange: (value) => this.patchSettings({ testHeight: value }),
      }),
      this.storage.subscribe((state) => this.storageChanged(state))
    );
    this.popstate = () => {
      if (this.active) this.navigate(this.window.location.href, { historyMode: 'pop' });
    };
    this.window.addEventListener('popstate', this.popstate);
    this.beforeUnload = (event) => {
      if ([...this.drafts.values()].some((d) => d.dirty) || this.caseWrites.size) {
        this.flush();
        event.preventDefault();
        event.returnValue = '';
      }
    };
    this.window.addEventListener('beforeunload', this.beforeUnload);
    this.shortcut = (event) => {
      if (!this.active || this.document.querySelector('.leetify-dialog-layer')) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) this.reviewSubmission();
        else this.run();
      }
    };
    this.shell.root.addEventListener('keydown', this.shortcut);
    this.initialized = true;
    this.renderProblem();
    if (this.settings.autoActivate) await this.activate();
  }
  stacked() {
    return (
      this.settings.layout === 'horizontal' || this.window.matchMedia('(max-width:899px)').matches
    );
  }
  async activate() {
    if (!this.initialized) await this.initialize();
    if (this.active) return;
    this.active = true;
    this.document.body.append(this.shell.root);
    this.document.body.classList.add('leetify-open');
    this.shell.description.append(this.current.statement);
    renderRawMath(this.current.statement);
    this.editor.view.requestMeasure();
    this.shell.configure(this.settings);
  }
  async deactivate({ force = false } = {}) {
    if (!this.active) return;
    if (!force && !(await this.flush())) {
      confirmDialog({
        title: 'Draft is not saved',
        message:
          'Keep this tab open to retain your editor draft. Exit the workspace while keeping the draft in this tab?',
        confirmLabel: 'Exit workspace',
        onConfirm: () => this.deactivate({ force: true }),
      });
      return;
    }
    this.navigation++;
    this.navigationController?.abort();
    this.cancelRun({ clear: true });
    this.submission.cancelPolling();
    this.closeDialog();
    this.active = false;
    this.shell.root.remove();
    this.document.body.classList.remove('leetify-open');
    if (this.currentUrl !== this.nativeUrl) {
      this.window.location.assign(problemUrl(this.current.route));
      return;
    }
    this.placeholder.after(this.nativeStatement);
  }
  draft(key = problemKey(this.current.route), language = this.language) {
    const id = `${key}:${language}`;
    let draft = this.drafts.get(id);
    if (!draft) {
      const saved = this.state.solutions[key]?.[language];
      draft = {
        key,
        language,
        code: saved?.code ?? this.starter(language),
        revision: saved?.revision || 0,
        dirty: false,
        version: 0,
        conflict: null,
      };
      this.drafts.set(id, draft);
    }
    return draft;
  }
  starter(language) {
    return (
      this.state.templates[language]?.find(
        (template) => template.id === this.settings.activeTemplateByLang[language]
      )?.code ?? LANGUAGES[language].starter
    );
  }
  restoreEditor() {
    const draft = this.draft();
    this.editor.setDocument({ key: draft.key, language: draft.language, code: draft.code });
    this.shell.language.value = this.language;
    this.saveStatus();
  }
  renderProblem() {
    this.shell.title.textContent = this.current.title;
    this.shell.meta.replaceChildren();
    for (const text of [...this.current.limits, ...this.current.tags]) {
      const span = this.document.createElement('span');
      span.textContent = text.replace(/(?:time|memory) limit per test\s*/i, '');
      this.shell.meta.append(span);
    }
    if (this.active) this.shell.description.replaceChildren(this.current.statement);
    this.tests.setCases([
      ...this.current.samples,
      ...(this.caseWrites.get(problemKey(this.current.route))?.cases ||
        this.state.cases[problemKey(this.current.route)] ||
        []),
    ]);
    this.submissions.setNativeUrl(statusUrl(this.current.route));
    this.remoteRecords = [];
    this.renderSubmissions();
    this.restoreEditor();
    const index = this.problemList.findIndex(
      (p) => problemKey(p.route) === problemKey(this.current.route)
    );
    this.shell.root.querySelector('[data-action=previous]').disabled = index <= 0;
    this.shell.root.querySelector('[data-action=next]').disabled =
      index < 0 || index >= this.problemList.length - 1;
  }
  edited(code) {
    const draft = this.draft();
    draft.code = code;
    draft.dirty = true;
    draft.version++;
    this.saveStatus();
    this.window.clearTimeout(this.saveTimer);
    this.saveTimer = this.window.setTimeout(() => this.persist(draft), 500);
    this.window.clearTimeout(this.autoTimer);
    if (this.settings.autoRunSamples)
      this.autoTimer = this.window.setTimeout(() => {
        if (this.active && !this.batch) this.run();
      }, 1200);
  }
  saveStatus() {
    const draft = this.draft();
    this.shell.setStatus(
      'save',
      draft.conflict
        ? 'Conflict · Review'
        : draft.saving
          ? 'Saving…'
          : draft.error
            ? 'Unsaved · Retry'
            : draft.dirty
              ? 'Unsaved changes'
              : 'Saved locally',
      draft.conflict ? 'conflict' : draft.error ? 'error' : ''
    );
  }
  async persist(draft, { preservePrevious = false } = {}) {
    if (draft.saving) {
      await draft.saving;
      if (draft.dirty && !draft.conflict) return this.persist(draft, { preservePrevious });
      return !draft.dirty;
    }
    if (!draft.dirty) return true;
    if (draft.conflict) return false;
    const version = draft.version;
    const code = draft.code;
    const expectedRevision = draft.revision;
    draft.saving = (async () => {
      try {
        const result = await this.storage.saveSolution({
          key: draft.key,
          language: draft.language,
          code,
          expectedRevision,
          preservePrevious,
        });
        if (result.status === 'conflict') {
          draft.conflict = result;
          draft.error = null;
          return false;
        }
        draft.revision = result.solution.revision;
        draft.dirty = draft.version !== version;
        draft.error = null;
        return !draft.dirty;
      } catch (error) {
        draft.error = error.message;
        return false;
      }
    })();
    this.saveStatus();
    const result = await draft.saving;
    draft.saving = null;
    this.saveStatus();
    if (!draft.error && !draft.conflict && draft.dirty) return this.persist(draft);
    return result;
  }
  async flush() {
    this.window.clearTimeout(this.saveTimer);
    let okay = true;
    for (const draft of this.drafts.values())
      if (draft.dirty && !(await this.persist(draft))) okay = false;
    for (const [key, pending] of this.caseWrites) {
      try {
        await this.storage.saveCases({ key, cases: pending.cases });
        if (this.caseWrites.get(key) === pending) this.caseWrites.delete(key);
      } catch (error) {
        okay = false;
        this.message(`Custom cases are unsaved. ${error.message}`);
      }
    }
    if (Object.keys(this.pendingSettings).length && !(await this.flushSettings())) okay = false;
    return okay;
  }
  casesChanged(cases) {
    const key = problemKey(this.current.route);
    this.caseWrites.set(key, { cases });
    this.window.clearTimeout(this.caseTimer);
    this.caseTimer = this.window.setTimeout(() => this.flush(), 350);
  }
  storageChanged(state) {
    if (!state) return;
    const previous = this.state;
    this.state = state;
    this.settings = normalizeSettings({ ...state.settings, ...this.pendingSettings });
    this.shell.configure(this.settings);
    this.editor.configure(this.settings);
    for (const draft of this.drafts.values()) {
      const saved = state.solutions[draft.key]?.[draft.language];
      if ((saved?.revision || 0) === draft.revision || draft.saving) continue;
      if (!draft.dirty) {
        draft.code = saved?.code ?? this.starter(draft.language);
        draft.revision = saved?.revision || 0;
        draft.conflict = null;
        if (draft === this.draft()) this.restoreEditor();
      } else {
        draft.conflict = { status: 'conflict', solution: saved || null };
        if (previous.solutions[draft.key]?.[draft.language]?.revision !== saved?.revision)
          this.storage
            .recoverDraft({ key: draft.key, language: draft.language, code: draft.code })
            .catch((error) => {
              draft.error = error.message;
              this.saveStatus();
            });
      }
    }
    const key = problemKey(this.current.route);
    const incoming = state.cases[key] || [];
    const pending = this.caseWrites.get(key);
    if (
      JSON.stringify(previous.cases[key] || []) !== JSON.stringify(incoming) &&
      (!pending || JSON.stringify(pending.cases) !== JSON.stringify(incoming))
    ) {
      let cases = incoming;
      if (pending) {
        cases = structuredClone(incoming);
        for (const local of pending.cases) {
          const same = cases.find((item) => item.id === local.id);
          if (same && JSON.stringify(same) === JSON.stringify(local)) continue;
          if (same) {
            same.id = `custom-recovered-${Date.now()}-${Math.random()}`;
            same.name = `${same.name} (other tab)`;
          }
          cases.push(structuredClone(local));
        }
        this.caseWrites.set(key, { cases });
        this.message('Custom cases changed in another tab. Your pending cases were retained.');
      }
      this.cancelRun({ clear: true });
      this.tests.setCases([...this.current.samples, ...cases]);
    }
    this.saveStatus();
    this.renderSubmissions();
  }
  patchSettings(patch) {
    Object.assign(this.pendingSettings, patch);
    this.settings = normalizeSettings({ ...this.settings, ...patch });
    this.shell.configure(this.settings);
    this.editor.configure(this.settings);
    this.window.clearTimeout(this.settingsTimer);
    this.settingsTimer = this.window.setTimeout(() => this.flushSettings(), 250);
  }
  async flushSettings() {
    const patch = { ...this.pendingSettings };
    if (!Object.keys(patch).length) return true;
    try {
      await this.storage.patchSettings(patch);
      for (const [key, value] of Object.entries(patch))
        if (this.pendingSettings[key] === value) delete this.pendingSettings[key];
      return true;
    } catch (error) {
      this.message(`Settings are unsaved. ${error.message}`);
      return false;
    }
  }
  async changeLanguage(language) {
    if (!isLanguage(language) || language === this.language) return;
    if (!(await this.persist(this.draft()))) {
      this.shell.language.value = this.language;
      this.message('Save or resolve the current draft before changing language.');
      return;
    }
    this.window.clearTimeout(this.autoTimer);
    this.language = language;
    this.restoreEditor();
  }
  async navigate(url, { historyMode = 'push' } = {}) {
    let route;
    try {
      route = parseProblemUrl(new URL(url, this.currentUrl).href);
    } catch {
      /* A malformed pasted URL is a recoverable user error. */
    }
    if (!route) {
      this.message('Choose a valid Codeforces problem URL.');
      return false;
    }
    const normalized = new URL(route.url);
    normalized.protocol = this.window.location.protocol;
    normalized.host = this.window.location.host;
    route = parseProblemUrl(normalized.href);
    const previousUrl = this.currentUrl;
    const sequence = ++this.navigation;
    this.navigationController?.abort();
    const controller = new AbortController();
    this.navigationController = controller;
    this.cancelRun({ clear: true });
    this.submission.cancelPolling();
    this.window.clearTimeout(this.autoTimer);
    if (!(await this.flush())) {
      this.message('Save or resolve your draft before navigating.');
      if (historyMode === 'pop') this.window.history.replaceState({}, '', previousUrl);
      return false;
    }
    if (sequence !== this.navigation) return false;
    this.message('Loading problem…');
    try {
      const page = await this.network.getPage(route.url, { signal: controller.signal });
      if (sequence !== this.navigation) return false;
      const doc = new this.window.DOMParser().parseFromString(page.html, 'text/html');
      const next = parseProblemDocument(doc, page.url);
      if (problemKey(next.route) !== problemKey(route))
        throw new Error('Codeforces returned a different problem. Open the native page.');
      next.statement =
        problemKey(route) === this.nativeKey
          ? this.nativeStatement
          : sanitizeStatement(next.statement, page.url);
      renderRawMath(next.statement);
      if (sequence !== this.navigation) return false;
      this.closeDialog();
      this.current = next;
      this.currentUrl = next.route.url;
      if (next.problems.length) this.problemList = next.problems;
      this.renderProblem();
      this.shell.statementScroll.scrollTop = 0;
      if (historyMode === 'push') this.window.history.pushState({}, '', this.currentUrl);
      else if (historyMode === 'replace') this.window.history.replaceState({}, '', this.currentUrl);
      this.document.title = `${next.title} · Leetify`;
      this.message('');
      return true;
    } catch (error) {
      if (sequence !== this.navigation) return false;
      if (historyMode === 'pop') this.window.history.replaceState({}, '', previousUrl);
      this.message(error.message);
      return false;
    }
  }
  cancelRun({ clear = false } = {}) {
    this.window.clearTimeout(this.autoTimer);
    this.runGeneration++;
    this.batch?.cancel();
    this.runner.cancelOwner?.();
    this.batch = null;
    this.shell?.setRunning(false);
    this.tests?.setRunning(false);
    if (!clear) this.tests?.setSummary('Cancelled');
  }
  async run(ids) {
    if (!this.active) return;
    this.cancelRun({ clear: true });
    const generation = this.runGeneration;
    const context = {
      key: problemKey(this.current.route),
      language: this.language,
      code: this.editor.getCode(),
      endpoint: this.settings.runnerEndpoint,
      cases: this.tests.getCases().filter((c) => !ids || ids.includes(c.id)),
    };
    if (!context.cases.length) {
      this.message('Add a case before running.');
      return;
    }
    if (
      !(await this.runnerConsent(context.endpoint)) ||
      generation !== this.runGeneration ||
      !this.active
    )
      return;
    const batch = createRunBatch({
      context,
      execute: (request) => this.runner.execute(request),
      onResult: (result) => {
        if (generation === this.runGeneration && result.key === problemKey(this.current.route)) {
          this.tests.setResult(result);
          this.shell.setStatus(
            'runner',
            result.runtime
              ? `${result.runtime.language} ${result.runtime.version}`
              : result.status === 'error'
                ? 'Runner error'
                : 'Runner connected'
          );
        }
      },
    });
    this.batch = batch;
    this.shell.setMobileView('code');
    this.shell.setRunning(true);
    this.tests.setRunning(true);
    this.tests.setSummary(`Running ${LANGUAGES[context.language].label}…`);
    this.tests.showResults();
    const summary = await batch.run();
    if (generation !== this.runGeneration) return;
    this.tests.setSummary(summary);
    this.shell.setRunning(false);
    this.tests.setRunning(false);
    this.batch = null;
  }
  runnerConsent(endpoint) {
    const origin = runnerUrl(endpoint)?.origin;
    if (!origin) {
      this.message('Set a valid runner URL in Settings.');
      return Promise.resolve(false);
    }
    if (origin === this.settings.runnerConsentOrigin) return Promise.resolve(true);
    return new Promise((resolve) => {
      const content = this.document.createElement('div');
      const text = this.document.createElement('p');
      text.textContent = `Running sends your source and test input to ${origin}. Allow this service only if you trust its operator.`;
      const actions = this.document.createElement('div');
      actions.className = 'lf-dialog-actions';
      const cancel = button(this.document, { label: 'Cancel', text: true });
      const settings = button(this.document, { label: 'Open runner settings', text: true });
      settings.addEventListener('click', () => this.runner.openOptions());
      const allow = button(this.document, {
        label: 'Allow runner',
        text: true,
        variant: 'lf-submit',
      });
      content.append(text, actions);
      actions.append(cancel, settings, allow);
      let settled = false;
      const dialog = openDialog({
        title: 'Allow runner access',
        content,
        onClose: () => {
          if (!settled) resolve(false);
        },
      });
      this.dialog = dialog;
      cancel.addEventListener('click', dialog.close);
      allow.addEventListener('click', async () => {
        allow.disabled = true;
        try {
          if (!(await this.runner.grant(origin))) {
            text.textContent = 'Runner permission was denied. Allow it in Settings to run source.';
            allow.disabled = false;
            return;
          }
          await this.storage.patchSettings({ runnerConsentOrigin: origin });
          this.settings.runnerConsentOrigin = origin;
          settled = true;
          dialog.close();
          resolve(true);
        } catch (error) {
          text.textContent = error.message;
          allow.disabled = false;
        }
      });
    });
  }
  async reviewSubmission() {
    this.shell.submit.disabled = true;
    const sequence = this.navigation;
    const capture = {
      route: structuredClone(this.current.route),
      language: this.language,
      code: this.editor.getCode(),
      compilerId: this.settings.compilerByLang[this.language],
    };
    try {
      const prepared = await this.submission.prepare(capture);
      if (!this.active || sequence !== this.navigation) return;
      this.closeDialog();
      const content = this.document.createElement('div');
      const summary = this.document.createElement('p');
      summary.textContent = `${this.current.title} · ${LANGUAGES[capture.language].label} · ${capture.code.length.toLocaleString()} characters`;
      const label = this.document.createElement('label');
      label.textContent = 'Codeforces compiler';
      const select = this.document.createElement('select');
      select.setAttribute('aria-label', 'Codeforces compiler');
      for (const option of prepared.compilerOptions) {
        const element = this.document.createElement('option');
        element.value = option.id;
        element.textContent = option.label;
        select.append(element);
      }
      select.value = prepared.compilerId;
      label.append(select);
      const preview = this.document.createElement('pre');
      preview.className = 'lf-source-preview';
      preview.textContent = capture.code;
      const note = this.document.createElement('p');
      note.className = 'lf-muted';
      note.textContent =
        'This reviewed source will be sent once. Your Codeforces session handles authentication.';
      const send = button(this.document, {
        label: 'Submit solution',
        name: 'send',
        text: true,
        variant: 'lf-submit',
      });
      const actions = this.document.createElement('div');
      actions.className = 'lf-dialog-actions';
      actions.append(send);
      content.append(summary, label, preview, note, actions);
      const dialog = openDialog({ title: 'Review submission', content });
      this.dialog = dialog;
      send.addEventListener('click', async () => {
        send.disabled = true;
        select.disabled = true;
        note.textContent = 'Sending…';
        try {
          await this.storage.patchSettings({
            compilerByLang: { ...this.settings.compilerByLang, [capture.language]: select.value },
          });
        } catch {
          /* A compiler preference failure must not send another POST. */
        }
        const record = await this.submission.submit({ ...prepared, compilerId: select.value });
        dialog.close();
        if (!this.active || sequence !== this.navigation) return;
        this.shell.setActiveView('submissions');
        this.message(
          record.status === 'confirmed'
            ? `Submission #${record.submissionId} confirmed. Verdict pending.`
            : record.message || 'Check native status before trying again.'
        );
        this.state = await this.storage.readSnapshot();
        this.renderSubmissions();
        if (record.status !== 'confirmed')
          this.nativeSubmitFallback(
            record.message ||
              'Codeforces did not confirm the submission. Check native status before retrying.'
          );
      });
    } catch (error) {
      if (this.active && sequence === this.navigation) this.nativeSubmitFallback(error.message);
    } finally {
      this.shell.submit.disabled = false;
    }
  }
  nativeSubmitFallback(message) {
    this.closeDialog();
    const content = this.document.createElement('div');
    const text = this.document.createElement('p');
    text.textContent = message;
    const actions = this.document.createElement('div');
    actions.className = 'lf-dialog-actions';
    const copy = button(this.document, { label: 'Copy source', name: 'copy', text: true });
    copy.addEventListener('click', () => this.copy());
    const native = this.document.createElement('a');
    native.textContent = 'Open native Submit';
    native.href = submitUrl(this.current.route);
    native.target = '_blank';
    native.rel = 'noopener noreferrer';
    native.className = 'lf-button lf-submit';
    const status = this.document.createElement('a');
    status.textContent = 'Check My submissions';
    status.href = statusUrl(this.current.route);
    status.target = '_blank';
    status.rel = 'noopener noreferrer';
    status.className = 'lf-button';
    actions.append(copy, status, native);
    content.append(text, actions);
    this.dialog = openDialog({ title: 'Submit on Codeforces', content });
  }
  renderSubmissions() {
    if (!this.submissions || !this.state) return;
    const key = problemKey(this.current.route);
    const records = this.state.submissions.filter((s) => s.key === key);
    const combined = new Map(this.remoteRecords.map((s) => [s.id, s]));
    for (const record of records) combined.set(record.id, record);
    this.submissions.setRecords(
      [...combined.values()].sort(
        (a, b) =>
          (Number(a.submissionId) || a.createdAt || 0) -
          (Number(b.submissionId) || b.createdAt || 0)
      )
    );
  }
  async refreshSubmissions() {
    const route = structuredClone(this.current.route);
    try {
      const page = await this.network.getPage(statusUrl(route));
      const records = parseStatusRecords(
        new this.window.DOMParser().parseFromString(page.html, 'text/html'),
        route
      );
      if (problemKey(route) !== problemKey(this.current.route)) return;
      this.remoteRecords = records;
      this.renderSubmissions();
      this.message(
        records.length
          ? 'Submissions refreshed.'
          : 'No submissions found on the returned Codeforces page.'
      );
    } catch (error) {
      this.message(error.message);
    }
  }
  message(text) {
    this.shell?.setStatus('message', text);
    const toast = this.shell?.root.querySelector('.lf-toast');
    if (!toast) return;
    this.window.clearTimeout(this.toastTimer);
    toast.textContent = text;
    toast.hidden = !text;
    if (text)
      this.toastTimer = this.window.setTimeout(() => {
        toast.hidden = true;
      }, 5000);
  }
  closeDialog() {
    this.dialog?.close();
    this.dialog = null;
  }
  async conflict() {
    const draft = this.draft();
    if (!draft.conflict) {
      await this.flush();
      return;
    }
    this.closeDialog();
    const content = this.document.createElement('div');
    const text = this.document.createElement('p');
    text.textContent =
      'Stored source changed in another tab. Your edits stay in this tab. Choosing the stored source saves your latest draft in recovery first.';
    const mine = this.document.createElement('pre');
    mine.className = 'lf-source-preview';
    mine.textContent = draft.code;
    const actions = this.document.createElement('div');
    actions.className = 'lf-dialog-actions';
    const keep = button(this.document, {
      label: 'Keep my draft',
      text: true,
      variant: 'lf-submit',
    });
    const other = button(this.document, { label: 'Use other tab draft', text: true });
    actions.append(other, keep);
    content.append(text, mine, actions);
    const dialog = openDialog({ title: 'Resolve draft conflict', content });
    this.dialog = dialog;
    keep.addEventListener('click', async () => {
      const state = await this.storage.readSnapshot();
      draft.revision = state.solutions[draft.key]?.[draft.language]?.revision || 0;
      draft.conflict = null;
      draft.dirty = true;
      if (await this.persist(draft, { preservePrevious: true })) dialog.close();
    });
    other.addEventListener('click', async () => {
      other.disabled = true;
      keep.disabled = true;
      try {
        const code = draft.code;
        await this.storage.recoverDraft({ key: draft.key, language: draft.language, code });
        const state = await this.storage.readSnapshot();
        if (draft.code !== code)
          throw new Error('Source changed. Review your latest draft before continuing.');
        const saved = state.solutions[draft.key]?.[draft.language];
        draft.code = saved?.code ?? this.starter(draft.language);
        draft.revision = saved?.revision || 0;
        draft.dirty = false;
        draft.conflict = null;
        draft.error = null;
        this.restoreEditor();
        dialog.close();
      } catch (error) {
        text.textContent = `Your draft could not be safely replaced. ${error.message}`;
      } finally {
        other.disabled = false;
        keep.disabled = false;
      }
    });
  }
  problems() {
    this.closeDialog();
    const content = this.document.createElement('div');
    content.className = 'lf-problem-picker';
    for (const problem of this.problemList) {
      const item = button(this.document, {
        label: `${problem.route.index}. ${problem.title.replace(new RegExp(`^${problem.route.index}[.\\s]*`), '') || 'Problem'}`,
        text: true,
      });
      item.addEventListener('click', () => this.navigate(problem.route.url));
      content.append(item);
    }
    const form = this.document.createElement('form');
    const input = this.document.createElement('input');
    input.type = 'url';
    input.placeholder = 'Paste a Codeforces problem URL';
    input.setAttribute('aria-label', 'Problem URL');
    const open = button(this.document, { label: 'Open problem', text: true });
    open.type = 'submit';
    form.append(input, open);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.navigate(input.value);
    });
    content.append(form);
    this.dialog = openDialog({ title: 'Choose a problem', content });
  }
  async templates() {
    this.closeDialog();
    const language = this.language;
    const state = await this.storage.readSnapshot();
    this.dialog = openTemplates({
      state,
      language,
      getCode: () => this.editor.getCode(),
      onSave: (template) => this.storage.saveTemplate({ language, template }),
      onDelete: (template) => this.storage.deleteTemplate({ language, id: template.id }),
      onUse: (template) => this.replaceSource(template.code),
      onRecover: (draft) => this.replaceSource(draft.code),
      onReset: () => this.replaceSource(LANGUAGES[language].starter),
      document: this.document,
    });
  }
  replaceSource(code) {
    const draft = this.draft();
    draft.code = code;
    draft.dirty = true;
    draft.version++;
    this.restoreEditor();
    return this.persist(draft);
  }
  async copy() {
    try {
      await this.window.navigator.clipboard.writeText(this.editor.getCode());
      this.message('Source copied.');
    } catch {
      this.message('Clipboard access failed. Select the editor source and copy it.');
    }
  }
  download() {
    const blob = new this.window.Blob([this.editor.getCode()], { type: 'text/plain' });
    const url = this.window.URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `${this.current.route.id}${this.current.route.index}-${LANGUAGES[this.language].filename}`;
    link.click();
    this.window.setTimeout(() => this.window.URL.revokeObjectURL(url), 1000);
  }
  tools() {
    this.closeDialog();
    const content = this.document.createElement('div');
    content.className = 'lf-tools-grid';
    for (const [label, action] of [
      ['Undo', () => this.editor.undo()],
      ['Redo', () => this.editor.redo()],
      ['Copy source', () => this.copy()],
      ['Download source', () => this.download()],
      ['Toggle line wrap', () => this.patchSettings({ wrap: !this.settings.wrap })],
      ['Increase editor font', () => this.patchSettings({ fontSize: this.settings.fontSize + 1 })],
      ['Decrease editor font', () => this.patchSettings({ fontSize: this.settings.fontSize - 1 })],
      ['Retry save', () => this.conflict()],
    ]) {
      const item = button(this.document, { label, text: true });
      item.addEventListener('click', () => {
        this.closeDialog();
        action();
      });
      content.append(item);
    }
    this.dialog = openDialog({ title: 'Editor tools', content });
  }
  async action(action, value) {
    const index = this.problemList.findIndex(
      (p) => problemKey(p.route) === problemKey(this.current.route)
    );
    switch (action) {
      case 'exit':
        return this.deactivate();
      case 'run':
        return this.run();
      case 'cancel':
        return this.cancelRun();
      case 'language':
        return this.changeLanguage(value);
      case 'mobile-description':
        return this.shell.setMobileView('description');
      case 'mobile-code':
        this.shell.setMobileView('code');
        this.editor.view.requestMeasure();
        return;
      case 'description':
      case 'submissions':
        return this.shell.setActiveView(action);
      case 'previous':
      case 'next': {
        const next = this.problemList[index + (action === 'previous' ? -1 : 1)];
        if (next) return this.navigate(next.route.url);
        return;
      }
      case 'problems':
        return this.problems();
      case 'submit':
        return this.reviewSubmission();
      case 'theme':
        return this.patchSettings({
          theme: { dark: 'light', light: 'monokai', monokai: 'dark' }[this.settings.theme],
        });
      case 'layout':
        return this.patchSettings({
          layout: this.settings.layout === 'vertical' ? 'horizontal' : 'vertical',
        });
      case 'focus':
        return this.patchSettings({ focus: !this.settings.focus });
      case 'settings':
        return this.runner.openOptions();
      case 'templates':
        return this.templates();
      case 'tools':
        return this.tools();
      case 'retry-save':
        return this.conflict();
    }
  }
  async dispose() {
    await this.flush();
    this.navigation++;
    this.navigationController?.abort();
    this.cancelRun({ clear: true });
    this.submission.dispose();
    this.closeDialog();
    for (const timer of [this.saveTimer, this.caseTimer, this.settingsTimer, this.toastTimer])
      this.window.clearTimeout(timer);
    this.window.removeEventListener('popstate', this.popstate);
    this.window.removeEventListener('beforeunload', this.beforeUnload);
    this.shell.root.removeEventListener('keydown', this.shortcut);
    for (const dispose of this.disposers) dispose();
    if (this.nativeStatement.parentNode !== this.originalParent)
      this.placeholder.after(this.nativeStatement);
    this.placeholder.remove();
    this.editor.dispose();
    this.tests.dispose();
    this.submissions.dispose();
    this.shell.dispose();
    this.document.body.classList.remove('leetify-open');
    this.active = false;
  }
}

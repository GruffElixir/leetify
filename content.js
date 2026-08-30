/**
 * Leetify — Codeforces workspace
 * A dependency-free split view with persistent solutions, samples, templates,
 * contest navigation, sandboxed sample execution, and safer submission flow.
 */
(function () {
  'use strict';

  const Core = window.LeetifyCore;
  if (!Core) return;

  const extensionApi = typeof browser !== 'undefined'
    ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);
  const STORAGE_KEY = 'leetify_state_v1';
  const SETTINGS_STORAGE_KEY = 'leetify_settings_v2';
  const HISTORY_STORAGE_KEY = 'leetify_history_v2';
  const SOLUTION_STORAGE_PREFIX = 'leetify_solution_v2:';
  const TEMPLATE_STORAGE_PREFIX = 'leetify_templates_v2:';
  const FONT_MIN = 11;
  const FONT_MAX = 22;
  const PROBLEM_FONT_MIN = 11;
  const PROBLEM_FONT_MAX = 30;
  const DEFAULT_RUNNER_ENDPOINT = 'http://127.0.0.1:2000/api/v2/execute';

  const DEFAULT_SETTINGS = {
    defaultLang: 'cpp',
    fontSize: 13,
    problemFontSize: 15,
    wrap: false,
    focus: false,
    paneWidth: 40,
    paneHeight: 42,
    theme: 'monokai',
    layout: 'vertical',
    autoActivate: true,
    autoRunSamples: false,
    runnerEndpoint: DEFAULT_RUNNER_ENDPOINT,
    activeTemplateByLang: {},
  };

  const LANG = {
    cpp: {
      label: 'C++',
      filename: 'solution.cpp',
      runner: 'cpp',
      starter: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Write your solution here.
    return 0;
}`,
      rules: [
        { cls: 'mk-comment', re: /\/\/[^\n]*/g },
        { cls: 'mk-comment', re: /\/\*[\s\S]*?\*\//g },
        { cls: 'mk-macro', re: /#\s*(?:include|define|ifdef|ifndef|endif|pragma|undef|if|else|elif)\b[^\n]*/g },
        { cls: 'mk-string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-keyword', re: /\b(?:alignas|alignof|and|asm|auto|bool|break|case|catch|char|class|const|consteval|constexpr|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|or|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/g },
        { cls: 'mk-type', re: /\b(?:string|wstring|vector|map|set|unordered_map|unordered_set|pair|tuple|array|deque|queue|stack|priority_queue|list|multiset|multimap|bitset|optional|variant|unique_ptr|shared_ptr|weak_ptr|size_t|ptrdiff_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|ll|ull|cin|cout|cerr|endl|ios_base|istream|ostream|ifstream|ofstream|stringstream)\b/g },
        { cls: 'mk-function', re: /\b([a-zA-Z_]\w*)\s*(?=\()/g },
        { cls: 'mk-number', re: /\b(?:0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[fFlLuU]*)\b/g },
      ],
    },
    python: {
      label: 'Python',
      filename: 'solution.py',
      runner: 'python',
      starter: `import sys

def solve():
    # Write your solution here.
    pass

if __name__ == "__main__":
    solve()`,
      rules: [
        { cls: 'mk-comment', re: /#[^\n]*/g },
        { cls: 'mk-string', re: /"""[\s\S]*?"""|'''[\s\S]*?'''/g },
        { cls: 'mk-string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-macro', re: /@[a-zA-Z_]\w*/g },
        { cls: 'mk-keyword', re: /\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g },
        { cls: 'mk-builtin', re: /\b(?:abs|all|any|bin|bool|bytes|callable|chr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|sys|os|math|collections|itertools|functools|defaultdict|Counter|deque|heapq|bisect)\b/g },
        { cls: 'mk-function', re: /\bdef\s+([a-zA-Z_]\w*)/g },
        { cls: 'mk-number', re: /\b(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[jJ]?)\b/g },
      ],
    },
    java: {
      label: 'Java',
      filename: 'Main.java',
      runner: 'java',
      starter: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        // Write your solution here.
    }
}`,
      rules: [
        { cls: 'mk-comment', re: /\/\/[^\n]*/g },
        { cls: 'mk-comment', re: /\/\*[\s\S]*?\*\//g },
        { cls: 'mk-macro', re: /@[A-Z][a-zA-Z0-9_]*/g },
        { cls: 'mk-string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-keyword', re: /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|true|false|null|record|sealed|permits|yield)\b/g },
        { cls: 'mk-type', re: /\b(?:String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Number|Comparable|Iterable|Iterator|Collection|List|ArrayList|LinkedList|Map|HashMap|TreeMap|Set|HashSet|TreeSet|Queue|Deque|ArrayDeque|PriorityQueue|Stack|Scanner|BufferedReader|PrintWriter|StringBuilder|System|Math|Arrays|Collections|Optional)\b/g },
        { cls: 'mk-function', re: /\b([a-zA-Z_]\w*)\s*(?=\()/g },
        { cls: 'mk-number', re: /\b(?:0[xX][0-9a-fA-F]+[lL]?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[fFdDlL]?)\b/g },
      ],
    },
    javascript: {
      label: 'JavaScript (Node.js)',
      filename: 'solution.js',
      runner: 'javascript',
      starter: `'use strict';

const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');

// Write your solution here using input.
console.log(input.trim());`,
      rules: [
        { cls: 'mk-comment', re: /\/\/[^\n]*/g },
        { cls: 'mk-comment', re: /\/\*[\s\S]*?\*\//g },
        { cls: 'mk-string', re: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-keyword', re: /\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield)\b/g },
        { cls: 'mk-builtin', re: /\b(?:Array|Boolean|Date|Error|Function|JSON|Math|Number|Object|Promise|Proxy|Reflect|RegExp|Set|Map|String|Symbol|WeakMap|WeakSet|BigInt|console|process|require|module|exports|setTimeout|clearTimeout|setInterval|clearInterval|parseInt|parseFloat|isNaN|isFinite|encodeURIComponent|decodeURIComponent|fetch|document|window|globalThis)\b/g },
        { cls: 'mk-function', re: /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g },
        { cls: 'mk-number', re: /\b(?:0[xX][0-9a-fA-F]+n?|0[oO][0-7]+n?|0[bB][01]+n?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?n?)\b/g },
      ],
    },
  };

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function makeId(prefix) {
    return `${prefix || 'id'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function defaultState() {
    return {
      version: 2,
      settings: { ...DEFAULT_SETTINGS, activeTemplateByLang: {} },
      solutions: {},
      templates: {},
      submissionHistory: [],
    };
  }

  function normalizeState(value) {
    const input = isObject(value) ? value : {};
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(isObject(input.settings) ? input.settings : {}),
      activeTemplateByLang: {
        ...(isObject(input.settings) && isObject(input.settings.activeTemplateByLang)
          ? input.settings.activeTemplateByLang : {}),
      },
    };
    if (typeof settings.runnerEndpoint !== 'string' || !settings.runnerEndpoint.trim() ||
        /emkc\.org\/api\/v2\/piston\/execute/i.test(settings.runnerEndpoint)) {
      settings.runnerEndpoint = DEFAULT_RUNNER_ENDPOINT;
    } else {
      settings.runnerEndpoint = settings.runnerEndpoint.trim();
    }
    const solutions = {};
    if (isObject(input.solutions)) {
      Object.entries(input.solutions).forEach(([key, languageMap]) => {
        if (!isObject(languageMap)) return;
        const entries = {};
        Object.entries(languageMap).forEach(([lang, entry]) => {
          if (typeof entry === 'string') entries[lang] = { code: entry, updatedAt: Date.now() };
          else if (isObject(entry) && typeof entry.code === 'string') {
            entries[lang] = { code: entry.code, updatedAt: Number(entry.updatedAt) || Date.now() };
          }
        });
        if (Object.keys(entries).length) solutions[key] = entries;
      });
    }
    const templates = {};
    if (isObject(input.templates)) {
      Object.entries(input.templates).forEach(([lang, list]) => {
        templates[lang] = Array.isArray(list)
          ? list.filter(item => isObject(item) && typeof item.code === 'string')
              .map(item => ({
                id: String(item.id || makeId('tpl')),
                name: String(item.name || 'Untitled template'),
                code: item.code,
                updatedAt: Number(item.updatedAt) || Date.now(),
              }))
          : [];
      });
    }
    return {
      version: 2,
      settings,
      solutions,
      templates,
      submissionHistory: Array.isArray(input.submissionHistory)
        ? input.submissionHistory.slice(-50) : [],
    };
  }

  function migrateLegacyStorage() {
    const migrated = defaultState();
    try {
      const legacySettings = JSON.parse(window.localStorage.getItem('leetify_settings') || '{}');
      if (LANG[legacySettings.lang]) migrated.settings.defaultLang = legacySettings.lang;
      if (Number.isFinite(Number(legacySettings.fontSize))) migrated.settings.fontSize = Number(legacySettings.fontSize);
      if (Number.isFinite(Number(legacySettings.psFontSize))) migrated.settings.problemFontSize = Number(legacySettings.psFontSize);
      if (typeof legacySettings.wrap === 'boolean') migrated.settings.wrap = legacySettings.wrap;
      if (typeof legacySettings.focus === 'boolean') migrated.settings.focus = legacySettings.focus;
      if (Number.isFinite(Number(legacySettings.paneWidth))) migrated.settings.paneWidth = Number(legacySettings.paneWidth);
      if (Number.isFinite(Number(legacySettings.paneHeight))) migrated.settings.paneHeight = Number(legacySettings.paneHeight);

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i) || '';
        const value = window.localStorage.getItem(key);
        if (key.startsWith('leetify_tpl_')) {
          const lang = key.slice('leetify_tpl_'.length);
          if (LANG[lang] && value !== null) {
            const template = { id: makeId('tpl'), name: 'Imported template', code: value, updatedAt: Date.now() };
            migrated.templates[lang] = [template];
            migrated.settings.activeTemplateByLang[lang] = template.id;
          }
        }
        if (key.startsWith('leetify_code_')) {
          const rest = key.slice('leetify_code_'.length);
          const separator = rest.indexOf('_');
          const lang = separator === -1 ? rest : rest.slice(0, separator);
          if (!LANG[lang] || value === null) continue;
          const legacyId = separator === -1 ? 'legacy:default' : rest.slice(separator + 1);
          const match = legacyId.match(/^(\d+)_([A-Z0-9]+)$/i);
          const problem = match
            ? `contest:${match[1]}:${match[2].toUpperCase()}`
            : `legacy:${legacyId}`;
          if (!isObject(migrated.solutions[problem])) migrated.solutions[problem] = {};
          migrated.solutions[problem][lang] = { code: value, updatedAt: Date.now() };
        }
      }
    } catch (_) {
      // Private browsing or blocked site storage: start with clean defaults.
    }
    return migrated;
  }

  function solutionStorageKey(problemKey, lang) {
    return `${SOLUTION_STORAGE_PREFIX}${encodeURIComponent(problemKey)}:${encodeURIComponent(lang)}`;
  }

  function templateStorageKey(lang) {
    return `${TEMPLATE_STORAGE_PREFIX}${encodeURIComponent(lang)}`;
  }

  function decodeStructuredKey(value) {
    try { return decodeURIComponent(value); }
    catch (_) { return value; }
  }

  function stateFromExtensionStorage(all) {
    const legacy = normalizeState(all && all[STORAGE_KEY]);
    const hasStructured = !!(all && (
      all[SETTINGS_STORAGE_KEY] ||
      all[HISTORY_STORAGE_KEY] ||
      Object.keys(all).some(key => key.startsWith(SOLUTION_STORAGE_PREFIX) || key.startsWith(TEMPLATE_STORAGE_PREFIX))
    ));
    if (!hasStructured) return { state: legacy, hasStructured: false };
    const next = {
      ...legacy,
      settings: { ...legacy.settings, ...(isObject(all[SETTINGS_STORAGE_KEY]) ? all[SETTINGS_STORAGE_KEY] : {}) },
      solutions: { ...legacy.solutions },
      templates: { ...legacy.templates },
      submissionHistory: Array.isArray(all[HISTORY_STORAGE_KEY])
        ? all[HISTORY_STORAGE_KEY] : legacy.submissionHistory,
    };
    Object.keys(all).forEach(storageKey => {
      if (storageKey.startsWith(SOLUTION_STORAGE_PREFIX)) {
        const encoded = storageKey.slice(SOLUTION_STORAGE_PREFIX.length);
        const separator = encoded.lastIndexOf(':');
        if (separator === -1) return;
        const problem = decodeStructuredKey(encoded.slice(0, separator));
        const lang = decodeStructuredKey(encoded.slice(separator + 1));
        const entry = all[storageKey];
        if (!isObject(entry) || typeof entry.code !== 'string') return;
        if (!isObject(next.solutions[problem])) next.solutions[problem] = {};
        next.solutions[problem][lang] = entry;
      }
      if (storageKey.startsWith(TEMPLATE_STORAGE_PREFIX)) {
        const lang = decodeStructuredKey(storageKey.slice(TEMPLATE_STORAGE_PREFIX.length));
        if (Array.isArray(all[storageKey])) next.templates[lang] = all[storageKey];
      }
    });
    return { state: normalizeState(next), hasStructured: true };
  }

  const Store = {
    data: defaultState(),
    pendingTimer: null,
    persistPromise: null,
    dirtySettings: false,
    dirtyHistory: false,
    dirtySolutions: new Set(),
    dirtyTemplates: new Set(),
    async init() {
      if (extensionApi && extensionApi.storage && extensionApi.storage.local) {
        try {
          const result = await extensionApi.storage.local.get(null);
          const loaded = stateFromExtensionStorage(result || {});
          this.data = loaded.hasStructured ? loaded.state : (result && result[STORAGE_KEY]
            ? loaded.state : migrateLegacyStorage());
          if (!loaded.hasStructured) {
            this.markAllDirty();
            await this.persist();
          }
          return;
        } catch (_) {
          // Fall through to the local fallback below.
        }
      }
      this.data = migrateLegacyStorage();
    },
    markAllDirty() {
      this.dirtySettings = true;
      this.dirtyHistory = true;
      Object.entries(this.data.solutions).forEach(([problem, languages]) => {
        Object.keys(languages || {}).forEach(lang => this.dirtySolutions.add(`${problem}\u0000${lang}`));
      });
      Object.keys(this.data.templates).forEach(lang => this.dirtyTemplates.add(lang));
    },
    markSettingsDirty() { this.dirtySettings = true; },
    async persist() {
      if (this.persistPromise) return this.persistPromise;
      if (extensionApi && extensionApi.storage && extensionApi.storage.local) {
        const dirtySettings = this.dirtySettings;
        const dirtyHistory = this.dirtyHistory;
        const dirtySolutions = [...this.dirtySolutions];
        const dirtyTemplates = [...this.dirtyTemplates];
        this.dirtySettings = false;
        this.dirtyHistory = false;
        this.dirtySolutions.clear();
        this.dirtyTemplates.clear();
        const changes = {};
        if (dirtySettings) changes[SETTINGS_STORAGE_KEY] = this.data.settings;
        if (dirtyHistory) changes[HISTORY_STORAGE_KEY] = this.data.submissionHistory;
        dirtySolutions.forEach(identity => {
          const separator = identity.indexOf('\u0000');
          const problem = identity.slice(0, separator);
          const lang = identity.slice(separator + 1);
          const entry = this.data.solutions[problem] && this.data.solutions[problem][lang];
          if (entry) changes[solutionStorageKey(problem, lang)] = entry;
        });
        dirtyTemplates.forEach(lang => {
          changes[templateStorageKey(lang)] = this.data.templates[lang] || [];
        });
        this.persistPromise = (Object.keys(changes).length
          ? extensionApi.storage.local.set(changes)
          : Promise.resolve()).catch(error => {
            if (dirtySettings) this.dirtySettings = true;
            if (dirtyHistory) this.dirtyHistory = true;
            dirtySolutions.forEach(identity => this.dirtySolutions.add(identity));
            dirtyTemplates.forEach(lang => this.dirtyTemplates.add(lang));
            throw error;
          }).finally(() => {
            this.persistPromise = null;
            if (this.dirtySettings || this.dirtyHistory || this.dirtySolutions.size || this.dirtyTemplates.size) this.schedule();
          });
        return this.persistPromise;
      }
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
      catch (_) {}
    },
    schedule() {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(() => { this.flush(); }, 350);
    },
    async flush() {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
      try { await this.persist(); }
      catch (_) { setSaveStatus('Storage unavailable'); }
    },
    getSolution(key, lang) {
      const entry = this.data.solutions[key] && this.data.solutions[key][lang];
      return entry && typeof entry.code === 'string' ? entry.code : null;
    },
    saveSolution(key, lang, code) {
      if (!isObject(this.data.solutions[key])) this.data.solutions[key] = {};
      this.data.solutions[key][lang] = { code, updatedAt: Date.now() };
      this.dirtySolutions.add(`${key}\u0000${lang}`);
      this.schedule();
    },
    getTemplates(lang) {
      if (!Array.isArray(this.data.templates[lang])) this.data.templates[lang] = [];
      return this.data.templates[lang];
    },
    saveTemplate(lang, template) {
      const list = this.getTemplates(lang);
      const index = list.findIndex(item => item.id === template.id);
      if (index === -1) list.push(template);
      else list[index] = template;
      this.data.settings.activeTemplateByLang[lang] = template.id;
      this.dirtyTemplates.add(lang);
      this.markSettingsDirty();
      this.schedule();
    },
    deleteTemplate(lang, id) {
      this.data.templates[lang] = this.getTemplates(lang).filter(item => item.id !== id);
      if (this.data.settings.activeTemplateByLang[lang] === id) {
        delete this.data.settings.activeTemplateByLang[lang];
      }
      this.dirtyTemplates.add(lang);
      this.markSettingsDirty();
      this.schedule();
    },
    recordSubmission(entry) {
      this.data.submissionHistory = [...this.data.submissionHistory, entry].slice(-50);
      this.dirtyHistory = true;
      this.schedule();
    },
  };

  function handleStorageChanges(changes, areaName) {
    if (areaName !== 'local' || !changes) return;
    const settingsChange = changes[SETTINGS_STORAGE_KEY];
    if (settingsChange && isObject(settingsChange.newValue)) {
      Store.data.settings = { ...Store.data.settings, ...settingsChange.newValue };
      if (splitContainer) applyThemeAndLayout();
    }
    const historyChange = changes[HISTORY_STORAGE_KEY];
    if (historyChange && Array.isArray(historyChange.newValue)) {
      Store.data.submissionHistory = historyChange.newValue.slice(-50);
    }
    Object.entries(changes).forEach(([storageKey, change]) => {
      if (storageKey.startsWith(SOLUTION_STORAGE_PREFIX)) {
        const encoded = storageKey.slice(SOLUTION_STORAGE_PREFIX.length);
        const separator = encoded.lastIndexOf(':');
        if (separator === -1 || !isObject(change.newValue) || typeof change.newValue.code !== 'string') return;
        const problem = decodeStructuredKey(encoded.slice(0, separator));
        const lang = decodeStructuredKey(encoded.slice(separator + 1));
        if (!isObject(Store.data.solutions[problem])) Store.data.solutions[problem] = {};
        Store.data.solutions[problem][lang] = change.newValue;
        if (currentRoute && currentProblemKey() === problem && currentLang === lang && document.activeElement !== codeInput) {
          codeInput.value = change.newValue.code;
          refreshAll();
          loadedSolutionKey = `${problem}|${lang}`;
          setSaveStatus('Updated from another tab');
        }
      }
      if (storageKey.startsWith(TEMPLATE_STORAGE_PREFIX) && Array.isArray(change.newValue)) {
        const lang = decodeStructuredKey(storageKey.slice(TEMPLATE_STORAGE_PREFIX.length));
        Store.data.templates[lang] = change.newValue;
        if (splitContainer) renderTestCases();
      }
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlight(code, lang) {
    const definition = LANG[lang];
    if (!definition) return escapeHtml(code);
    const tokens = [];
    for (const rule of definition.rules) {
      const flags = rule.re.flags.includes('g') ? rule.re.flags : `${rule.re.flags}g`;
      const expression = new RegExp(rule.re.source, flags);
      let match;
      while ((match = expression.exec(code)) !== null) {
        tokens.push({ start: match.index, end: match.index + match[0].length, cls: rule.cls });
        if (!match[0].length) expression.lastIndex++;
      }
    }
    tokens.sort((a, b) => a.start - b.start || b.end - a.end);
    let html = '';
    let position = 0;
    for (const token of tokens) {
      if (token.start < position) continue;
      if (token.start > position) html += escapeHtml(code.slice(position, token.start));
      html += `<span class="${token.cls}">${escapeHtml(code.slice(token.start, token.end))}</span>`;
      position = token.end;
    }
    if (position < code.length) html += escapeHtml(code.slice(position));
    return html;
  }

  let problemStatement = null;
  let originalParent = null;
  let originalNextSibling = null;
  let splitContainer = null;
  let activateButton = null;
  let codeInput = null;
  let highlightLayer = null;
  let gutterInner = null;
  let statusCursor = null;
  let statusChars = null;
  let statusLang = null;
  let saveStatus = null;
  let submissionStatus = null;
  let currentLang = 'cpp';
  let currentRoute = null;
  let currentSamples = [];
  let selectedSample = 0;
  let loadedSolutionKey = null;
  let contestProblems = [];
  let problemListKey = null;
  let navigationController = null;
  let contestController = null;
  let navigationSequence = 0;
  let renderFrame = 0;
  let currentRunIds = new Set();
  let runBusy = false;
  let autoRunTimer = null;
  let lastStatusUrl = null;
  let initialRouteUrl = null;
  let modalReturnFocus = null;
  let initialized = false;

  function getSettings() {
    return Store.data.settings;
  }

  function currentProblemKey() {
    return Core.problemKey(currentRoute);
  }

  function scheduleSettingsSave() {
    Store.markSettingsDirty();
    Store.schedule();
  }

  function setSaveStatus(value) {
    if (saveStatus) saveStatus.textContent = value;
  }

  function scheduleSolutionSave() {
    if (!codeInput || !currentRoute) return;
    setSaveStatus('Saving…');
    Store.saveSolution(currentProblemKey(), currentLang, codeInput.value);
    setTimeout(() => setSaveStatus('Saved'), 400);
  }

  function setCodeValue(value, start, end) {
    if (!codeInput) return;
    codeInput.value = String(value == null ? '' : value);
    const cursor = Number.isFinite(start) ? start : codeInput.value.length;
    codeInput.selectionStart = Math.max(0, Math.min(cursor, codeInput.value.length));
    codeInput.selectionEnd = Number.isFinite(end)
      ? Math.max(codeInput.selectionStart, Math.min(end, codeInput.value.length))
      : codeInput.selectionStart;
    markCodeChanged();
  }

  function replaceRange(start, end, replacement, selectionStart, selectionEnd) {
    if (!codeInput) return;
    try {
      codeInput.setRangeText(replacement, start, end, 'preserve');
    } catch (_) {
      codeInput.value = codeInput.value.slice(0, start) + replacement + codeInput.value.slice(end);
    }
    codeInput.selectionStart = Number.isFinite(selectionStart) ? selectionStart : start + replacement.length;
    codeInput.selectionEnd = Number.isFinite(selectionEnd) ? selectionEnd : codeInput.selectionStart;
    markCodeChanged();
  }

  function markCodeChanged() {
    scheduleRender();
    updateStatus();
    scheduleSolutionSave();
    if (document.activeElement === codeInput) scheduleAutoRun();
  }

  function scheduleAutoRun() {
    clearTimeout(autoRunTimer);
    autoRunTimer = null;
    if (!getSettings().autoRunSamples || !currentSamples.length || !splitContainer || splitContainer.style.display === 'none') return;
    autoRunTimer = setTimeout(() => {
      autoRunTimer = null;
      if (runBusy) {
        scheduleAutoRun();
        return;
      }
      openRunPanel();
      runAllSamples();
    }, 900);
  }

  function scheduleRender() {
    if (renderFrame) return;
    const render = () => {
      renderFrame = 0;
      refreshHighlight();
      refreshGutter();
      syncScroll();
    };
    if (typeof window.requestAnimationFrame === 'function') renderFrame = window.requestAnimationFrame(render);
    else renderFrame = window.setTimeout(render, 0);
  }

  function refreshHighlight() {
    if (!highlightLayer || !codeInput) return;
    highlightLayer.innerHTML = `${highlight(codeInput.value, currentLang)}\n`;
  }

  function refreshGutter() {
    if (!gutterInner || !codeInput) return;
    const fragment = document.createDocumentFragment();
    const count = codeInput.value.split('\n').length;
    for (let i = 1; i <= count; i++) {
      const line = document.createElement('div');
      line.className = 'mk-ln';
      line.textContent = String(i);
      fragment.appendChild(line);
    }
    gutterInner.replaceChildren(fragment);
  }

  function refreshAll() {
    refreshHighlight();
    refreshGutter();
    syncScroll();
    updateStatus();
  }

  function syncScroll() {
    if (!codeInput || !highlightLayer || !gutterInner) return;
    highlightLayer.scrollTop = codeInput.scrollTop;
    highlightLayer.scrollLeft = codeInput.scrollLeft;
    gutterInner.style.transform = `translateY(-${codeInput.scrollTop}px)`;
  }

  function updateStatus() {
    if (!codeInput) return;
    const value = codeInput.value;
    const position = codeInput.selectionStart || 0;
    const before = value.slice(0, position).split('\n');
    if (statusCursor) statusCursor.textContent = `Ln ${before.length}, Col ${before[before.length - 1].length + 1}`;
    if (statusChars) statusChars.textContent = `${value.length} chars`;
  }

  function getStarterCode(lang) {
    const activeId = getSettings().activeTemplateByLang && getSettings().activeTemplateByLang[lang];
    const template = Store.getTemplates(lang).find(item => item.id === activeId);
    return template ? template.code : LANG[lang].starter;
  }

  function applyThemeAndLayout() {
    if (!splitContainer) return;
    const settings = getSettings();
    splitContainer.dataset.theme = ['monokai', 'midnight', 'light'].includes(settings.theme)
      ? settings.theme : 'monokai';
    splitContainer.classList.toggle('layout-horizontal', settings.layout === 'horizontal');
    splitContainer.classList.toggle('focus-mode', !!settings.focus);
    splitContainer.classList.toggle('wrap-on', !!settings.wrap);
    const left = document.getElementById('leetify-left-pane');
    const paneWidth = Math.max(20, Math.min(75, Number(settings.paneWidth) || 40));
    const paneHeight = Math.max(20, Math.min(75, Number(settings.paneHeight) || 42));
    settings.paneWidth = paneWidth;
    settings.paneHeight = paneHeight;
    splitContainer.style.setProperty('--pane-height', `${paneHeight}%`);
    if (left) left.style.width = isStackedLayout() ? '100%' : `${paneWidth}%`;
    setFontSize(Number(settings.fontSize) || 13, false);
    setProblemFontSize(Number(settings.problemFontSize) || 15, false);
    updateToggleButtons();
  }

  function isStackedLayout() {
    if (getSettings().layout === 'horizontal') return true;
    if (typeof window.matchMedia === 'function') return window.matchMedia('(max-width: 900px)').matches;
    return window.innerWidth <= 900;
  }

  function setFontSize(value, persist = true) {
    const next = Math.max(FONT_MIN, Math.min(FONT_MAX, Number(value) || 13));
    getSettings().fontSize = next;
    if (splitContainer) splitContainer.style.setProperty('--ed-font-size', `${next}px`);
    if (splitContainer) splitContainer.style.setProperty('--ed-line-height', `${Math.round(next * 1.615)}px`);
    const label = document.getElementById('lbtn-font-label');
    if (label) label.textContent = `${next}px`;
    if (persist) scheduleSettingsSave();
    scheduleRender();
  }

  function setProblemFontSize(value, persist = true) {
    const next = Math.max(PROBLEM_FONT_MIN, Math.min(PROBLEM_FONT_MAX, Number(value) || 15));
    getSettings().problemFontSize = next;
    if (splitContainer) splitContainer.style.setProperty('--ps-font-size', `${next}px`);
    const label = document.getElementById('lbtn-ps-font-label');
    if (label) label.textContent = `${next}px`;
    if (persist) scheduleSettingsSave();
  }

  function updateToggleButtons() {
    const wrap = document.getElementById('lbtn-wrap');
    const focus = document.getElementById('lbtn-focus');
    const settings = getSettings();
    if (wrap) {
      wrap.classList.toggle('active', !!settings.wrap);
      wrap.setAttribute('aria-pressed', String(!!settings.wrap));
    }
    if (focus) {
      focus.classList.toggle('active', !!settings.focus);
      focus.setAttribute('aria-pressed', String(!!settings.focus));
    }
  }

  function toggleWrap() {
    getSettings().wrap = !getSettings().wrap;
    if (splitContainer) splitContainer.classList.toggle('wrap-on', getSettings().wrap);
    updateToggleButtons();
    scheduleSettingsSave();
  }

  function toggleFocus() {
    getSettings().focus = !getSettings().focus;
    if (splitContainer) splitContainer.classList.toggle('focus-mode', getSettings().focus);
    updateToggleButtons();
    scheduleSettingsSave();
  }

  function createActivateButton() {
    activateButton = document.createElement('button');
    activateButton.id = 'leetify-activate-btn';
    activateButton.type = 'button';
    activateButton.setAttribute('aria-label', 'Open Leetify split view');
    activateButton.innerHTML = '<span aria-hidden="true">◫</span> Split View';
    activateButton.hidden = true;
    activateButton.addEventListener('click', activateSplit);
    document.body.appendChild(activateButton);
  }

  function buildLeftPane() {
    const pane = document.createElement('section');
    pane.id = 'leetify-left-pane';
    pane.setAttribute('aria-label', 'Problem statement');
    pane.innerHTML = `
      <div class="leetify-toolbar leetify-problem-toolbar">
        <div class="leetify-toolbar-left">
          <button class="leetify-tbtn danger" id="lbtn-ps-exit" type="button" title="Exit split view">× Exit</button>
          <span class="pane-title">Problem</span>
        </div>
        <div class="leetify-toolbar-right">
          <button class="leetify-tbtn" id="lbtn-ps-font-down" type="button" title="Decrease problem text size">A−</button>
          <span class="lsb" id="lbtn-ps-font-label">15px</span>
          <button class="leetify-tbtn" id="lbtn-ps-font-up" type="button" title="Increase problem text size">A+</button>
        </div>
      </div>
      <nav id="leetify-prob-nav" aria-label="Contest problems"></nav>
      <div id="leetify-ps-wrapper"></div>
    `;
    pane.querySelector('#lbtn-ps-exit').addEventListener('click', exitSplit);
    return pane;
  }

  function buildRightPane() {
    const pane = document.createElement('section');
    pane.id = 'leetify-right-pane';
    pane.setAttribute('aria-label', 'Code editor');
    const options = Object.entries(LANG).map(([key, value]) =>
      `<option value="${key}"${key === currentLang ? ' selected' : ''}>${value.label}</option>`).join('');
    pane.innerHTML = `
      <div class="leetify-tab-bar">
        <div class="leetify-tab active" id="leetify-tab">
          <span class="leetify-tab-dot" aria-hidden="true"></span>
          <span id="leetify-tab-name">${LANG[currentLang].filename}</span>
        </div>
        <span class="tab-route" id="leetify-tab-route"></span>
      </div>
      <div class="leetify-toolbar">
        <div class="leetify-toolbar-left toolbar-scroll">
          <label class="sr-only" for="leetify-lang-sel">Programming language</label>
          <select class="leetify-select" id="leetify-lang-sel" aria-label="Programming language">${options}</select>
          <span class="leetify-sep" aria-hidden="true"></span>
          <button class="leetify-tbtn" id="lbtn-font-down" type="button" title="Decrease editor text size">A−</button>
          <span class="lsb" id="lbtn-font-label">13px</span>
          <button class="leetify-tbtn" id="lbtn-font-up" type="button" title="Increase editor text size">A+</button>
          <button class="leetify-tbtn" id="lbtn-wrap" type="button" title="Toggle word wrap" aria-pressed="false">↵ Wrap</button>
          <button class="leetify-tbtn" id="lbtn-focus" type="button" title="Toggle focus mode" aria-pressed="false">⛶ Focus</button>
        </div>
        <div class="leetify-toolbar-right toolbar-scroll">
          <button class="leetify-tbtn run" id="lbtn-run" type="button" title="Run sample tests">▶ Run</button>
          <button class="leetify-tbtn" id="lbtn-template" type="button" title="Manage saved templates">▣ Templates</button>
          <button class="leetify-tbtn" id="lbtn-reset" type="button" title="Reset to active template">↺ Reset</button>
          <button class="leetify-tbtn" id="lbtn-copy" type="button" title="Copy code">⎘ Copy</button>
          <button class="leetify-tbtn submit" id="lbtn-submit" type="button" title="Submit to Codeforces">▶ Submit</button>
          <button class="leetify-tbtn" id="lbtn-status" type="button" title="Open recent submissions" disabled>↗ Status</button>
        </div>
      </div>
      <div class="leetify-editor-body">
        <div class="leetify-gutter" id="leetify-gutter" aria-hidden="true"><div class="leetify-gutter-inner" id="leetify-gutter-inner"></div></div>
        <div class="leetify-editor-stack">
          <pre id="leetify-highlight-layer" aria-hidden="true"></pre>
          <textarea id="leetify-code-input" aria-label="Source code" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
        </div>
      </div>
      <section class="leetify-run-panel" id="leetify-run-panel" hidden aria-label="Sample test runner">
        <div class="run-panel-header">
          <strong>Sample tests</strong>
          <span id="run-summary" class="run-summary">Ready</span>
          <button class="icon-btn" id="run-close" type="button" title="Close test panel">×</button>
        </div>
        <div class="run-panel-grid">
          <div class="run-case-list" id="run-case-list" role="listbox" aria-label="Sample tests"></div>
          <div class="run-case-editor">
            <label for="run-input">Input</label>
            <textarea id="run-input" spellcheck="false"></textarea>
            <label for="run-expected">Expected output</label>
            <pre id="run-expected"></pre>
            <div class="run-actions">
              <button class="leetify-tbtn run" id="run-one" type="button">Run selected</button>
              <button class="leetify-tbtn" id="run-all" type="button">Run all</button>
              <button class="leetify-tbtn danger" id="run-cancel" type="button" hidden>Cancel</button>
            </div>
          </div>
          <div class="run-output-wrap">
            <div class="run-output-title"><span>Actual output</span><span id="run-result-label"></span></div>
            <pre id="run-output" aria-live="polite">Select a test and run your code.</pre>
            <div id="run-diff" class="run-diff"></div>
          </div>
        </div>
      </section>
      <div class="leetify-status-bar">
        <span class="lsb accent"><span class="lsb-dot" aria-hidden="true"></span><span id="lsb-save">Ready</span></span>
        <span class="lsb" id="lsb-lang">${currentLang.toUpperCase()}</span>
        <span class="lsb submission-status" id="lsb-submission" role="status" aria-live="polite">No submission</span>
        <span class="lsb spacer"></span>
        <span class="lsb" id="lsb-cursor">Ln 1, Col 1</span>
        <span class="lsb" id="lsb-chars">0 chars</span>
        <span class="lsb">Tab: 4</span>
        <span class="lsb">UTF-8</span>
      </div>
    `;
    return pane;
  }

  function buildSplitContainer() {
    splitContainer = document.createElement('main');
    splitContainer.id = 'leetify-split-container';
    splitContainer.style.display = 'none';
    splitContainer.setAttribute('aria-label', 'Leetify Codeforces workspace');
    splitContainer.appendChild(buildLeftPane());
    const resizer = document.createElement('div');
    resizer.id = 'leetify-resizer';
    resizer.setAttribute('role', 'separator');
    resizer.setAttribute('aria-label', 'Resize problem and editor panes');
    resizer.tabIndex = 0;
    resizer.setAttribute('aria-valuemin', '20');
    resizer.setAttribute('aria-valuemax', '75');
    splitContainer.appendChild(resizer);
    splitContainer.appendChild(buildRightPane());
    document.body.insertBefore(splitContainer, document.body.firstChild);

    codeInput = document.getElementById('leetify-code-input');
    highlightLayer = document.getElementById('leetify-highlight-layer');
    gutterInner = document.getElementById('leetify-gutter-inner');
    statusCursor = document.getElementById('lsb-cursor');
    statusChars = document.getElementById('lsb-chars');
    statusLang = document.getElementById('lsb-lang');
    saveStatus = document.getElementById('lsb-save');
    submissionStatus = document.getElementById('lsb-submission');

    setupEditor();
    setupResizer(resizer, document.getElementById('leetify-left-pane'));
    bindToolbar();
    refreshAll();
  }

  function setupEditor() {
    codeInput.addEventListener('input', () => {
      setSaveStatus('Saving…');
      scheduleRender();
      updateStatus();
      scheduleSolutionSave();
      scheduleAutoRun();
    });
    codeInput.addEventListener('keydown', handleEditorKeyDown);
    codeInput.addEventListener('scroll', syncScroll);
    ['keyup', 'mouseup', 'click', 'select'].forEach(eventName => codeInput.addEventListener(eventName, updateStatus));
  }

  function setupResizer(bar, leftPane) {
    let dragging = false;
    const updateOrientation = () => {
      const stacked = isStackedLayout();
      bar.setAttribute('aria-orientation', stacked ? 'vertical' : 'horizontal');
      bar.setAttribute('aria-valuemin', '20');
      bar.setAttribute('aria-valuemax', '75');
      const value = stacked ? Number(getSettings().paneHeight) || 42 : Number(getSettings().paneWidth) || 40;
      bar.setAttribute('aria-valuenow', String(Math.round(value)));
    };
    const updatePane = (clientX, clientY) => {
      if (isStackedLayout()) {
        const height = Math.max(window.innerHeight * 0.2, Math.min(clientY, window.innerHeight * 0.75));
        const percentage = Math.round((height / window.innerHeight) * 1000) / 10;
        getSettings().paneHeight = percentage;
        if (splitContainer) splitContainer.style.setProperty('--pane-height', `${percentage}%`);
        leftPane.style.width = '100%';
        bar.setAttribute('aria-valuenow', String(Math.round(percentage)));
        return;
      }
      const width = Math.max(window.innerWidth * 0.2, Math.min(clientX, window.innerWidth * 0.75));
      const percentage = Math.round((width / window.innerWidth) * 1000) / 10;
      leftPane.style.width = `${percentage}%`;
      getSettings().paneWidth = percentage;
      bar.setAttribute('aria-valuenow', String(Math.round(percentage)));
    };
    updateOrientation();
    bar.addEventListener('pointerdown', event => {
      dragging = true;
      bar.setPointerCapture?.(event.pointerId);
      bar.classList.add('resizing');
      document.body.style.userSelect = 'none';
      event.preventDefault();
    });
    bar.addEventListener('pointermove', event => { if (dragging) updatePane(event.clientX, event.clientY); });
    const finish = () => {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('resizing');
      document.body.style.userSelect = '';
      scheduleSettingsSave();
    };
    bar.addEventListener('pointerup', finish);
    bar.addEventListener('pointercancel', finish);
    bar.addEventListener('keydown', event => {
      const stacked = isStackedLayout();
      const keys = stacked ? ['ArrowUp', 'ArrowDown', 'Home', 'End'] : ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const current = Number(stacked ? getSettings().paneHeight : getSettings().paneWidth) || (stacked ? 42 : 40);
      const next = stacked
        ? event.key === 'ArrowUp' ? current - 2 : event.key === 'ArrowDown' ? current + 2
          : event.key === 'Home' ? 20 : 75
        : event.key === 'ArrowLeft' ? current - 2 : event.key === 'ArrowRight' ? current + 2
          : event.key === 'Home' ? 20 : 75;
      const clamped = Math.max(20, Math.min(75, next));
      if (stacked) updatePane(window.innerWidth / 2, (clamped / 100) * window.innerHeight);
      else updatePane((clamped / 100) * window.innerWidth, window.innerHeight / 2);
      scheduleSettingsSave();
    });
    window.addEventListener('resize', updateOrientation);
  }

  function bindToolbar() {
    document.getElementById('leetify-lang-sel').addEventListener('change', event => changeLanguage(event.target.value));
    document.getElementById('lbtn-font-down').addEventListener('click', () => setFontSize(getSettings().fontSize - 1));
    document.getElementById('lbtn-font-up').addEventListener('click', () => setFontSize(getSettings().fontSize + 1));
    document.getElementById('lbtn-ps-font-down').addEventListener('click', () => setProblemFontSize(getSettings().problemFontSize - 1));
    document.getElementById('lbtn-ps-font-up').addEventListener('click', () => setProblemFontSize(getSettings().problemFontSize + 1));
    document.getElementById('lbtn-wrap').addEventListener('click', toggleWrap);
    document.getElementById('lbtn-focus').addEventListener('click', toggleFocus);
    document.getElementById('lbtn-run').addEventListener('click', () => { openRunPanel(); runSelectedSample(); });
    document.getElementById('lbtn-template').addEventListener('click', openTemplateModal);
    document.getElementById('lbtn-reset').addEventListener('click', resetCode);
    document.getElementById('lbtn-copy').addEventListener('click', copyCode);
    document.getElementById('lbtn-submit').addEventListener('click', submitCode);
    document.getElementById('lbtn-status').addEventListener('click', openStatusPage);
    document.getElementById('run-close').addEventListener('click', closeRunPanel);
    document.getElementById('run-input').addEventListener('input', () => {
      if (currentSamples[selectedSample]) currentSamples[selectedSample].input = document.getElementById('run-input').value;
    });
    document.getElementById('run-one').addEventListener('click', runSelectedSample);
    document.getElementById('run-all').addEventListener('click', runAllSamples);
    document.getElementById('run-cancel').addEventListener('click', cancelRuns);
  }

  function loadSolutionForCurrentProblem() {
    if (!codeInput || !currentRoute) return;
    const key = currentProblemKey();
    const saved = Store.getSolution(key, currentLang);
    loadedSolutionKey = `${key}|${currentLang}`;
    setCodeValue(saved === null ? getStarterCode(currentLang) : saved, 0, 0);
    setSaveStatus(saved === null ? 'Ready' : 'Restored');
    codeInput.scrollTop = 0;
    codeInput.scrollLeft = 0;
    refreshAll();
  }

  function changeLanguage(language) {
    if (!LANG[language] || language === currentLang) return;
    Store.saveSolution(currentProblemKey(), currentLang, codeInput.value);
    currentLang = language;
    getSettings().defaultLang = language;
    document.getElementById('leetify-lang-sel').value = language;
    document.getElementById('leetify-tab-name').textContent = LANG[language].filename;
    if (statusLang) statusLang.textContent = language.toUpperCase();
    loadedSolutionKey = null;
    loadSolutionForCurrentProblem();
    renderTestCases();
    scheduleSettingsSave();
  }

  function resetCode() {
    const name = getActiveTemplateName(currentLang);
    if (!window.confirm(`Reset this solution to ${name}?`)) return;
    setCodeValue(getStarterCode(currentLang), 0, 0);
    Store.saveSolution(currentProblemKey(), currentLang, codeInput.value);
    setSaveStatus('Saved');
    codeInput.focus();
    scheduleAutoRun();
  }

  function getActiveTemplateName(lang) {
    const activeId = getSettings().activeTemplateByLang && getSettings().activeTemplateByLang[lang];
    return Store.getTemplates(lang).find(item => item.id === activeId)?.name || 'the default starter';
  }

  async function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }

  async function copyCode() {
    const button = document.getElementById('lbtn-copy');
    try {
      await copyText(codeInput.value);
      const original = button.textContent;
      button.textContent = '✓ Copied';
      setTimeout(() => { button.textContent = original; }, 1400);
    } catch (_) {
      button.textContent = 'Copy failed';
      setTimeout(() => { button.textContent = '⎘ Copy'; }, 1400);
    }
  }

  function handleEditorKeyDown(event) {
    if (event.isComposing) return;
    const meta = event.ctrlKey || event.metaKey;
    if (meta && event.key === '/') { event.preventDefault(); toggleLineComment(); return; }
    if (meta && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateLine(); return; }
    if (event.key === 'Home' && !event.shiftKey) {
      event.preventDefault();
      const value = codeInput.value;
      const position = codeInput.selectionStart;
      const lineStart = value.lastIndexOf('\n', position - 1) + 1;
      const firstText = lineStart + (value.slice(lineStart).match(/^[ \t]*/)[0].length);
      const target = position === firstText ? lineStart : firstText;
      codeInput.selectionStart = codeInput.selectionEnd = target;
      updateStatus();
      return;
    }
    if (event.key === 'Tab') { event.preventDefault(); indentSelection(event.shiftKey); return; }
    if (event.key === 'Enter') { event.preventDefault(); insertNewline(); return; }

    const openings = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" };
    const closings = new Set(['}', ')', ']', '"', "'"]);
    if (closings.has(event.key) && codeInput.selectionStart === codeInput.selectionEnd &&
        codeInput.value[codeInput.selectionStart] === event.key) {
      event.preventDefault();
      codeInput.selectionStart = codeInput.selectionEnd = codeInput.selectionStart + 1;
      updateStatus();
      return;
    }
    if (openings[event.key]) {
      event.preventDefault();
      const start = codeInput.selectionStart;
      const end = codeInput.selectionEnd;
      const selected = codeInput.value.slice(start, end);
      const replacement = event.key + selected + openings[event.key];
      replaceRange(start, end, replacement, start + 1, start + selected.length + 1);
    }
    if (event.key === 'Backspace' && codeInput.selectionStart === codeInput.selectionEnd) {
      const position = codeInput.selectionStart;
      const value = codeInput.value;
      const pair = { '{': '}', '(': ')', '[': ']', '"': '"', "'": "'" };
      if (pair[value[position - 1]] === value[position]) {
        event.preventDefault();
        replaceRange(position - 1, position + 1, '', position - 1, position - 1);
      }
    }
  }

  function indentSelection(dedent) {
    const value = codeInput.value;
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    if (start !== end) {
      const first = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(first, end);
      const replacement = dedent ? block.replace(/^( {1,4}|\t)/gm, '') : block.replace(/^/gm, '    ');
      replaceRange(first, end, replacement, first, first + replacement.length);
      return;
    }
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    if (dedent) {
      const leading = value.slice(lineStart).match(/^( {1,4}|\t)/);
      if (leading) replaceRange(lineStart, lineStart + leading[0].length, '', Math.max(lineStart, start - leading[0].length), Math.max(lineStart, start - leading[0].length));
      return;
    }
    replaceRange(start, start, '    ', start + 4, start + 4);
  }

  function insertNewline() {
    const value = codeInput.value;
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const indent = value.slice(lineStart, start).match(/^[ \t]*/)[0];
    const previous = value[start - 1];
    const next = value[start];
    const pairs = { '{': '}', '(': ')', '[': ']' };
    if (start === end && pairs[previous] === next && value.slice(lineStart, start).trim()) {
      const inner = `\n${indent}    `;
      const closing = `\n${indent}`;
      replaceRange(start, end, inner + closing, start + inner.length, start + inner.length);
      return;
    }
    replaceRange(start, end, `\n${indent}`, start + indent.length + 1, start + indent.length + 1);
  }

  function toggleLineComment() {
    const prefix = currentLang === 'python' ? '#' : '//';
    const value = codeInput.value;
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    const blockStart = value.lastIndexOf('\n', start - 1) + 1;
    const selectedEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
    const lineEnd = value.indexOf('\n', selectedEnd);
    const blockEnd = lineEnd === -1 ? value.length : lineEnd;
    const lines = value.slice(blockStart, blockEnd).split('\n');
    const allCommented = lines.every(line => line.trimStart().startsWith(prefix));
    const replacement = lines.map(line => allCommented
      ? line.replace(new RegExp(`^(\\s*)${prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s?`), '$1')
      : line.replace(/^(\s*)/, `$1${prefix} `)).join('\n');
    replaceRange(blockStart, blockEnd, replacement, blockStart, blockStart + replacement.length);
  }

  function duplicateLine() {
    const value = codeInput.value;
    const start = codeInput.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', start);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const line = value.slice(lineStart, end);
    const insertion = `\n${line}`;
    replaceRange(end, end, insertion, start + insertion.length, start + insertion.length);
  }

  function extractSamples() {
    const wrapper = document.getElementById('leetify-ps-wrapper');
    if (!wrapper) return [];
    const samples = [...wrapper.querySelectorAll('.sample-test')].map((sample, index) => {
      const read = selector => {
        const element = sample.querySelector(selector);
        if (!element) return '';
        // Codeforces renders sample line breaks as <br>. textContent drops
        // those boundaries, so clone the small pre block and make them text.
        const clone = element.cloneNode(true);
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        return Core.normalizeSampleText(clone.textContent || '');
      };
      return { id: `sample-${index + 1}`, name: `Sample ${index + 1}`, input: read('.input pre'), expected: read('.output pre'), hasExpected: true };
    });
    return samples.length ? samples : [{ id: 'custom-1', name: 'Custom input', input: '', expected: '', hasExpected: false }];
  }

  function openRunPanel() {
    const panel = document.getElementById('leetify-run-panel');
    if (!panel) return;
    panel.hidden = false;
    renderTestCases();
  }

  function closeRunPanel() {
    const panel = document.getElementById('leetify-run-panel');
    if (panel) panel.hidden = true;
  }

  function renderTestCases() {
    const list = document.getElementById('run-case-list');
    if (!list) return;
    list.replaceChildren();
    currentSamples.forEach((sample, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `run-case${index === selectedSample ? ' active' : ''}`;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === selectedSample));
      button.textContent = sample.name;
      button.addEventListener('click', () => selectSample(index));
      list.appendChild(button);
    });
    selectSample(Math.min(selectedSample, Math.max(0, currentSamples.length - 1)), false);
  }

  function selectSample(index, rerender = true) {
    selectedSample = index;
    const sample = currentSamples[selectedSample] || { input: '', expected: '', hasExpected: false };
    const input = document.getElementById('run-input');
    const expected = document.getElementById('run-expected');
    if (input) input.value = sample.input;
    if (expected) expected.textContent = sample.expected || '(custom input — no expected output)';
    if (rerender) renderTestCases();
  }

  async function runSelectedSample() {
    await runSamples([selectedSample]);
  }

  async function runAllSamples() {
    await runSamples(currentSamples.map((_, index) => index));
  }

  async function runSamples(indices) {
    if (runBusy || !currentSamples.length || !codeInput) return;
    runBusy = true;
    const cancelButton = document.getElementById('run-cancel');
    const oneButton = document.getElementById('run-one');
    const allButton = document.getElementById('run-all');
    const toolbarRunButton = document.getElementById('lbtn-run');
    const summary = document.getElementById('run-summary');
    const output = document.getElementById('run-output');
    const resultLabel = document.getElementById('run-result-label');
    const diff = document.getElementById('run-diff');
    cancelButton.hidden = false;
    oneButton.disabled = true;
    allButton.disabled = true;
    if (toolbarRunButton) toolbarRunButton.disabled = true;
    output.textContent = 'Running…';
    resultLabel.textContent = '';
    resultLabel.className = '';
    summary.className = 'run-summary';
    summary.textContent = 'Running…';
    diff.replaceChildren();
    const results = [];
    try {
      for (const index of indices) {
        if (!currentSamples[index]) continue;
        const requestId = makeId('run');
        currentRunIds.add(requestId);
        const response = await sendRuntimeMessage({
          type: 'RUN_CODE',
          requestId,
          language: LANG[currentLang].runner,
          filename: LANG[currentLang].filename,
          code: codeInput.value,
          stdin: currentSamples[index].input,
          endpoint: getSettings().runnerEndpoint,
          timeoutMs: 5000,
        });
        currentRunIds.delete(requestId);
        const execution = Core.summarizeExecution(response);
        const comparison = execution.cancelled
          ? { passed: false, mode: 'cancelled', actual: execution.actual, expected: currentSamples[index].expected }
          : execution.successful && currentSamples[index].hasExpected
            ? Core.compareOutputs(execution.actual, currentSamples[index].expected)
            : execution.successful
              ? { passed: true, mode: 'ran', actual: execution.actual, expected: '' }
              : { passed: false, mode: 'error', actual: execution.actual, expected: currentSamples[index].expected };
        results.push({ index, response, actual: execution.actual, display: execution.display, comparison });
        if (indices.length === 1 || index === indices[indices.length - 1]) {
          output.textContent = execution.display || '(no output)';
          resultLabel.textContent = comparison.mode === 'ran'
            ? '✓ RAN'
            : comparison.mode === 'cancelled'
              ? 'Cancelled'
              : comparison.passed ? `✓ PASS (${comparison.mode})` : '✗ FAIL';
          resultLabel.className = comparison.mode === 'cancelled'
            ? 'cancelled' : comparison.passed ? 'pass' : 'fail';
          renderDiff(comparison);
          summary.textContent = comparison.mode === 'cancelled'
            ? 'Cancelled'
            : comparison.passed ? `Passed (${comparison.mode})` : 'Failed';
          summary.className = `run-summary ${comparison.mode === 'cancelled'
            ? '' : comparison.passed ? 'pass' : 'fail'}`.trim();
        }
      }
      if (indices.length > 1) {
        const passed = results.filter(result => result.comparison.passed).length;
        const cancelled = results.some(result => result.comparison.mode === 'cancelled');
        summary.textContent = cancelled ? `${passed}/${results.length} tests completed before cancellation`
          : `${passed}/${results.length} tests passed`;
        summary.className = `run-summary ${cancelled ? '' : passed === results.length ? 'pass' : 'fail'}`.trim();
        output.textContent = results.map(result => `${currentSamples[result.index].name}: ${result.comparison.mode === 'cancelled' ? 'CANCELLED' : result.comparison.passed ? 'PASS' : 'FAIL'}`).join('\n');
      }
    } catch (error) {
      output.textContent = error.message || 'Runner failed.';
      resultLabel.textContent = '✗ ERROR';
      resultLabel.className = 'fail';
      summary.textContent = 'Runner failed';
      summary.className = 'run-summary fail';
    } finally {
      currentRunIds.clear();
      cancelButton.hidden = true;
      oneButton.disabled = false;
      allButton.disabled = false;
      if (toolbarRunButton) toolbarRunButton.disabled = false;
      runBusy = false;
    }
  }

  function renderDiff(comparison) {
    const diff = document.getElementById('run-diff');
    if (!diff || comparison.passed || comparison.mode === 'error') {
      if (diff && comparison.mode === 'error') diff.textContent = 'The runner returned an error. Check the output above.';
      return;
    }
    const expected = document.createElement('div');
    expected.className = 'diff-expected';
    expected.textContent = `Expected:\n${comparison.expected || '(empty)'}`;
    const actual = document.createElement('div');
    actual.className = 'diff-actual';
    actual.textContent = `Actual:\n${comparison.actual || '(empty)'}`;
    diff.append(expected, actual);
  }

  async function cancelRuns() {
    const ids = [...currentRunIds];
    await Promise.all(ids.map(requestId => sendRuntimeMessage({ type: 'CANCEL_RUN', requestId })));
    document.getElementById('run-summary').textContent = 'Cancelled';
  }

  async function sendRuntimeMessage(message) {
    if (!extensionApi || !extensionApi.runtime || !extensionApi.runtime.sendMessage) {
      return { ok: false, error: 'The Leetify background worker is unavailable.' };
    }
    try { return await extensionApi.runtime.sendMessage(message); }
    catch (error) { return { ok: false, error: error.message || 'Extension request failed.' }; }
  }

  function getSubmitUrl(route = currentRoute) {
    if (!route) return null;
    if (route.kind === 'problemset') return `${route.origin}/problemset/submit`;
    return `${route.origin}/${route.kind}/${route.id}/submit`;
  }

  function getStatusUrl(route = currentRoute) {
    if (!route) return null;
    if (route.kind === 'problemset') return `${route.origin}/problemset/status/${route.id}/problem/${route.index}?my=on&order=BY_ARRIVED_DESC`;
    return `${route.origin}/${route.kind}/${route.id}/my`;
  }

  async function fetchCodeforcesPage(url) {
    const response = await sendRuntimeMessage({ type: 'FETCH_CODEFORCES_PAGE', url });
    if (response && response.ok) return { text: response.text || '', url: response.url || url, status: response.status };
    try {
      const direct = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!direct.ok) throw new Error(`Codeforces returned ${direct.status}`);
      return { text: await direct.text(), url: direct.url || url, status: direct.status };
    } catch (error) {
      throw new Error(response?.error || error.message || 'Could not load Codeforces form.');
    }
  }

  function findSubmissionForm(doc) {
    const explicit = doc.querySelector('form.submit-form');
    if (explicit) return explicit;
    return [...(doc.forms || [])].find(form => form.querySelector('select[name="programTypeId"]') &&
      form.querySelector('[name="source"], [name="sourceFile"]')) || null;
  }

  function selectedLanguageOption(doc, language = currentLang, form = findSubmissionForm(doc)) {
    const select = form?.querySelector('select[name="programTypeId"]');
    if (!select) return null;
    const options = [...select.options];
    const candidates = options.filter(option => Core.languageMatches(option.textContent, language));
    if (!candidates.length) return null;
    if (language === 'python') return candidates.find(option => !/pypy/i.test(option.textContent)) || candidates[0];
    if (language === 'cpp') return candidates.find(option => /g\+\+|c\+\+/i.test(option.textContent)) || candidates[0];
    if (language === 'javascript') return candidates.find(option => /node|javascript/i.test(option.textContent)) || candidates[0];
    return candidates[0];
  }

  function appendFormControl(params, element) {
    if (element.disabled || !element.name || element.type === 'file') return;
    if (element.type === 'checkbox' || element.type === 'radio') {
      if (element.checked) params.append(element.name, element.value || 'on');
      return;
    }
    if (element.tagName === 'SELECT') {
      [...element.options].filter(option => option.selected).forEach(option => params.append(element.name, option.value));
      return;
    }
    params.append(element.name, element.value || '');
  }

  function buildSubmissionBody(doc, context = {}) {
    const route = context.route || currentRoute;
    const language = context.language || currentLang;
    const code = context.code == null ? codeInput.value : String(context.code);
    const submitUrl = context.submitUrl || getSubmitUrl(route);
    const form = findSubmissionForm(doc);
    const languageOption = selectedLanguageOption(doc, language, form);
    if (!form || !languageOption) throw new Error('Could not find the current Codeforces language list.');
    const params = new URLSearchParams();
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(element => {
      if (['source', 'sourceFile', 'programTypeId', 'submittedProblemIndex', 'submittedProblemCode'].includes(element.name)) return;
      appendFormControl(params, element);
    });
    const csrf = doc.querySelector('meta[name="X-Csrf-Token"]')?.content || form.querySelector('[name="csrf_token"]')?.value;
    if (!csrf) throw new Error('Codeforces CSRF token was not found. Please sign in again.');
    params.set('csrf_token', csrf);
    params.set('action', 'submitSolutionFormSubmitted');
    const problemCodeField = form.querySelector('[name="submittedProblemCode"]');
    const problemIndexField = form.querySelector('[name="submittedProblemIndex"]');
    if (problemCodeField) params.set('submittedProblemCode', `${route.id}${route.index}`);
    else if (problemIndexField) params.set('submittedProblemIndex', route.index);
    else throw new Error('Codeforces submission form has no problem identifier.');
    params.set('programTypeId', languageOption.value);
    params.set('source', code);
    let actionUrl;
    try { actionUrl = new URL(form.getAttribute('action') || submitUrl, submitUrl); }
    catch (_) { throw new Error('Codeforces returned an invalid submission form action.'); }
    if (actionUrl.hostname.toLowerCase() !== 'codeforces.com' && actionUrl.hostname.toLowerCase() !== 'www.codeforces.com') {
      throw new Error('Codeforces returned an unsafe submission form action.');
    }
    // The current form repeats the CSRF token in its query string. Keep the
    // non-secret form nonce but send the token only in the POST body.
    actionUrl.searchParams.delete('csrf_token');
    return { body: params.toString(), url: actionUrl.href };
  }

  async function submitCode() {
    if (!currentRoute || !codeInput) return;
    if (!codeInput.value.trim()) { window.alert('Write some code before submitting.'); return; }
    const submittedRoute = { ...currentRoute };
    const submittedKey = Core.problemKey(submittedRoute);
    const submittedLanguage = currentLang;
    const submittedCode = codeInput.value;
    const submitUrl = getSubmitUrl(submittedRoute);
    if (!submitUrl) { window.alert('Could not determine the Codeforces submission URL.'); return; }
    const confirmed = window.confirm(`Submit ${submittedRoute.kind} ${submittedRoute.id}/${submittedRoute.index} in ${LANG[submittedLanguage].label}?`);
    if (!confirmed) return;
    const button = document.getElementById('lbtn-submit');
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting…';
    }
    setSubmissionStatus('Preparing submission…');
    try {
      let previousSubmissionId = null;
      const previousStatusUrl = getStatusUrl(submittedRoute);
      if (previousStatusUrl) {
        try {
          const previousStatus = await fetchCodeforcesPage(previousStatusUrl);
          previousSubmissionId = latestSubmissionId(previousStatus.text, submittedRoute);
        } catch (_) {
          // A status baseline is helpful but should not block an explicit submit.
        }
      }
      const fetched = await fetchCodeforcesPage(submitUrl);
      const doc = new DOMParser().parseFromString(fetched.text, 'text/html');
      const pageText = doc.body?.textContent || '';
      if (/\/(?:enter|login)(?:\/|$)/i.test(fetched.url || '') || /Please enter your|sign in to Codeforces/i.test(`${doc.title || ''} ${pageText}`)) {
        throw new Error('Please sign in to Codeforces first.');
      }
      const submission = buildSubmissionBody(doc, {
        route: submittedRoute,
        language: submittedLanguage,
        code: submittedCode,
        submitUrl: fetched.url || submitUrl,
      });
      const result = await sendRuntimeMessage({ type: 'SUBMIT_CODE', url: submission.url, body: submission.body });
      if (!result || !result.ok) throw new Error(result?.error || `Codeforces returned ${result?.status || 'an error'}.`);
      if (/\/(?:enter|login)(?:\/|$)/i.test(result.url || '')) throw new Error('Codeforces redirected to login; your session may have expired.');
      const responseText = result.text || '';
      const responseDoc = new DOMParser().parseFromString(responseText, 'text/html');
      const formErrors = [...responseDoc.querySelectorAll('.error, .error-for__source, .alert-danger')]
        .map(node => node.textContent.trim()).filter(Boolean);
      if (formErrors.length || /exactly the same code|limit exceeded|error for__source/i.test(responseText)) {
        throw new Error('Codeforces rejected the submission. Open Status for details.');
      }
      lastStatusUrl = getStatusUrl(submittedRoute);
      const statusButton = document.getElementById('lbtn-status');
      if (statusButton) statusButton.disabled = !lastStatusUrl;
      setSubmissionStatus('Submitted — checking verdict…');
      Store.recordSubmission({ key: submittedKey, language: submittedLanguage, at: Date.now(), verdict: 'SUBMITTED' });
      pollLatestVerdict(submittedRoute, submittedKey, submittedLanguage, lastStatusUrl, previousSubmissionId);
    } catch (error) {
      setSubmissionStatus(error.message || 'Submission failed.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '▶ Submit';
      }
    }
  }

  function setSubmissionStatus(value) {
    if (submissionStatus) submissionStatus.textContent = value;
  }

  function openStatusPage() {
    if (lastStatusUrl) window.open(lastStatusUrl, '_blank', 'noopener');
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseLatestVerdict(html, route = currentRoute) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table.status-frame-datatable tr, .status-frame-datatable tr')];
    const indexPattern = route && route.index
      ? new RegExp('(?:^|\\s|/)(?:' + escapeRegExp(route.index) + '|' +
        escapeRegExp(`${route.id}${route.index}`) + ')(?=\\s|$|[-/])', 'i') : null;
    const candidates = [];
    for (const row of rows) {
      if (!indexPattern || !indexPattern.test(row.textContent || '')) continue;
      const verdict = row.querySelector('.submissionVerdictWrapper, .verdict-accepted, .verdict-rejected')?.textContent || '';
      if (!verdict.trim()) continue;
      const submissionLink = row.querySelector('a[href*="/submission/"]');
      const linkMatch = submissionLink?.href?.match(/\/submission\/(\d+)/i);
      const textMatch = (row.textContent || '').match(/(?:^|\s)(\d{5,})(?:\s|$)/);
      candidates.push({
        id: Number(linkMatch?.[1] || textMatch?.[1] || 0),
        verdict: verdict.trim().replace(/\s+/g, ' '),
      });
    }
    candidates.sort((a, b) => b.id - a.id);
    return candidates[0]?.verdict || null;
  }

  function latestSubmissionId(html, route = currentRoute) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table.status-frame-datatable tr, .status-frame-datatable tr')];
    const escapedIndex = escapeRegExp(route?.index);
    const pattern = route && route.index
      ? new RegExp('(?:^|\\s|/)(?:' + escapedIndex + '|' + escapeRegExp(`${route.id}${route.index}`) + ')(?=\\s|$|[-/])', 'i') : null;
    const ids = rows.filter(row => pattern?.test(row.textContent || '')).map(row => {
      const link = row.querySelector('a[href*="/submission/"]');
      const match = link?.href?.match(/\/submission\/(\d+)/i) || (row.textContent || '').match(/(?:^|\s)(\d{5,})(?:\s|$)/);
      return Number(match?.[1] || 0);
    }).filter(Boolean);
    return ids.length ? Math.max(...ids) : null;
  }

  function isPendingVerdict(verdict) {
    return /^(?:TESTING|RUNNING|PENDING|QUEUED|IN QUEUE|COMPILING|COMPILATION IN PROGRESS)/i.test((verdict || '').trim());
  }

  async function pollLatestVerdict(route, key, language, statusUrl, previousSubmissionId = null) {
    if (!statusUrl) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        const fetched = await fetchCodeforcesPage(statusUrl);
        const currentSubmissionId = latestSubmissionId(fetched.text, route);
        if (previousSubmissionId && (!currentSubmissionId || currentSubmissionId <= previousSubmissionId)) continue;
        const verdict = parseLatestVerdict(fetched.text, route);
        if (!verdict) continue;
        if (currentProblemKey() === key) setSubmissionStatus(`Verdict: ${verdict}`);
        Store.recordSubmission({ key, language, at: Date.now(), verdict });
        if (!isPendingVerdict(verdict)) return;
      } catch (_) {
        return;
      }
    }
    if (currentProblemKey() === key) setSubmissionStatus('Submission sent — open Status to refresh the verdict.');
  }

  function openTemplateModal() {
    const existing = document.getElementById('leetify-tpl-modal');
    if (existing) existing.remove();
    modalReturnFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'leetify-tpl-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tpl-modal-title');
    overlay.innerHTML = `
      <div class="tpl-box">
        <div class="tpl-header">
          <h2 id="tpl-modal-title">Saved templates</h2>
          <p>Templates are stored by language and used by Reset or new solutions.</p>
        </div>
        <div class="tpl-form">
          <label for="tpl-select">Template</label>
          <select id="tpl-select"></select>
          <label for="tpl-name">Name</label>
          <input id="tpl-name" type="text" maxlength="80" autocomplete="off">
          <label for="tpl-editor">Code</label>
          <textarea id="tpl-editor" class="tpl-editor" spellcheck="false"></textarea>
        </div>
        <div class="tpl-actions">
          <button class="leetify-tbtn" id="tpl-new" type="button">New</button>
          <button class="leetify-tbtn danger" id="tpl-delete" type="button">Delete</button>
          <button class="leetify-tbtn" id="tpl-restore" type="button">Restore default</button>
          <span class="tpl-spacer"></span>
          <button class="leetify-tbtn" id="tpl-cancel" type="button">Cancel</button>
          <button class="leetify-tbtn submit" id="tpl-save" type="button">Save</button>
        </div>
      </div>
    `;
    splitContainer.appendChild(overlay);
    const select = overlay.querySelector('#tpl-select');
    const name = overlay.querySelector('#tpl-name');
    const editor = overlay.querySelector('#tpl-editor');
    let selectedId = getSettings().activeTemplateByLang[currentLang] || '';

    const refresh = () => {
      select.replaceChildren();
      const templates = Store.getTemplates(currentLang);
      templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        option.selected = template.id === selectedId;
        select.appendChild(option);
      });
      if (!selectedId && templates[0]) selectedId = templates[0].id;
      const active = templates.find(template => template.id === selectedId);
      name.value = active ? active.name : 'My template';
      editor.value = active ? active.code : LANG[currentLang].starter;
      overlay.querySelector('#tpl-delete').disabled = !active;
    };
    select.addEventListener('change', () => { selectedId = select.value; refresh(); });
    overlay.querySelector('#tpl-new').addEventListener('click', () => {
      selectedId = '';
      name.value = 'My template';
      editor.value = LANG[currentLang].starter;
      select.value = '';
      overlay.querySelector('#tpl-delete').disabled = true;
    });
    overlay.querySelector('#tpl-restore').addEventListener('click', () => { editor.value = LANG[currentLang].starter; });
    overlay.querySelector('#tpl-delete').addEventListener('click', () => {
      if (!selectedId || !window.confirm('Delete this template?')) return;
      Store.deleteTemplate(currentLang, selectedId);
      selectedId = '';
      refresh();
    });
    overlay.querySelector('#tpl-save').addEventListener('click', () => {
      const template = {
        id: selectedId || makeId('tpl'),
        name: name.value.trim() || 'Untitled template',
        code: editor.value,
        updatedAt: Date.now(),
      };
      Store.saveTemplate(currentLang, template);
      selectedId = template.id;
      setSaveStatus('Template saved');
      refresh();
    });
    const close = () => { overlay.remove(); modalReturnFocus?.focus?.(); };
    overlay.querySelector('#tpl-cancel').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    refresh();
    name.focus();
  }

  function scrapeContestProblems() {
    if (!currentRoute || !['contest', 'gym'].includes(currentRoute.kind)) return [];
    const seen = new Set();
    const problems = [];
    document.querySelectorAll('.problems td.id a[href], .sidebar a[href]').forEach(anchor => {
      const parsed = Core.parseProblemUrl(anchor.href);
      if (!parsed || parsed.kind !== currentRoute.kind || parsed.id !== currentRoute.id || seen.has(parsed.index)) return;
      seen.add(parsed.index);
      problems.push({ index: parsed.index, url: parsed.url, name: anchor.textContent.trim() });
    });
    return problems.sort((a, b) => a.index.localeCompare(b.index, undefined, { numeric: true }));
  }

  async function fetchContestProblems(route, signal) {
    const indexUrl = `${route.origin}/${route.kind}/${route.id}`;
    const response = await fetch(indexUrl, { credentials: 'include', signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Contest index returned ${response.status}`);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const seen = new Set();
    const result = [];
    doc.querySelectorAll('.problems td.id a[href]').forEach(anchor => {
      const parsed = Core.parseProblemUrl(new URL(anchor.getAttribute('href'), `${indexUrl}/`).href);
      if (!parsed || parsed.kind !== route.kind || parsed.id !== route.id || seen.has(parsed.index)) return;
      seen.add(parsed.index);
      const row = anchor.closest('tr');
      const name = row?.querySelector('.name')?.textContent.trim() || anchor.textContent.trim();
      result.push({ index: parsed.index, url: parsed.url, name });
    });
    return result.sort((a, b) => a.index.localeCompare(b.index, undefined, { numeric: true }));
  }

  function renderProblemNav() {
    const nav = document.getElementById('leetify-prob-nav');
    if (!nav) return;
    nav.replaceChildren();
    if (!currentRoute || !['contest', 'gym'].includes(currentRoute.kind) || !contestProblems.length) {
      nav.hidden = true;
      return;
    }
    nav.hidden = false;
    contestProblems.forEach(problem => {
      const link = document.createElement('a');
      link.className = `prob-tab${problem.index === currentRoute.index ? ' active' : ''}`;
      link.href = problem.url;
      link.textContent = problem.index;
      link.title = problem.name ? `${problem.index}: ${problem.name}` : `Problem ${problem.index}`;
      if (problem.index === currentRoute.index) link.setAttribute('aria-current', 'page');
      link.addEventListener('click', event => { event.preventDefault(); loadProblemDynamic(problem.url, { push: true }); });
      nav.appendChild(link);
    });
  }

  async function loadContestNav() {
    if (!currentRoute || !['contest', 'gym'].includes(currentRoute.kind)) {
      contestProblems = [];
      renderProblemNav();
      return;
    }
    const key = `${currentRoute.kind}:${currentRoute.id}`;
    if (problemListKey !== key) {
      problemListKey = key;
      contestProblems = scrapeContestProblems();
    }
    renderProblemNav();
    if (contestController) contestController.abort();
    contestController = new AbortController();
    try {
      const routeAtRequest = { ...currentRoute };
      const fetched = await fetchContestProblems(routeAtRequest, contestController.signal);
      if (problemListKey !== routeAtRequest.kind + ':' + routeAtRequest.id) return;
      if (fetched.length) contestProblems = fetched;
      renderProblemNav();
    } catch (_) {
      // The local scrape remains useful when the contest index is unavailable.
    }
  }

  async function loadProblemDynamic(url, options = {}) {
    const nextRoute = Core.parseProblemUrl(url);
    if (!nextRoute) { window.location.href = url; return; }
    clearTimeout(autoRunTimer);
    autoRunTimer = null;
    await Store.flush();
    if (navigationController) navigationController.abort();
    navigationController = new AbortController();
    const sequence = ++navigationSequence;
    const wrapper = document.getElementById('leetify-ps-wrapper');
    if (wrapper) wrapper.classList.add('loading');
    try {
      const response = await fetch(nextRoute.url, { credentials: 'include', signal: navigationController.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Problem page returned ${response.status}`);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextStatement = doc.querySelector('.problem-statement');
      if (!nextStatement) throw new Error('Problem statement not found.');
      if (sequence !== navigationSequence) return;
      if (options.push !== false) window.history.pushState({ leetify: true }, '', nextRoute.url);
      currentRoute = nextRoute;
      problemStatement = nextStatement;
      lastStatusUrl = null;
      const statusButton = document.getElementById('lbtn-status');
      if (statusButton) statusButton.disabled = true;
      setSubmissionStatus('No submission');
      const runSummary = document.getElementById('run-summary');
      if (runSummary) {
        runSummary.textContent = 'Ready';
        runSummary.className = 'run-summary';
      }
      closeRunPanel();
      if (wrapper) wrapper.replaceChildren(nextStatement);
      const title = doc.querySelector('title')?.textContent.trim();
      if (title) document.title = title;
      if (problemListKey !== `${currentRoute.kind}:${currentRoute.id}`) {
        problemListKey = null;
        contestProblems = [];
      }
      currentSamples = extractSamples();
      selectedSample = 0;
      loadedSolutionKey = null;
      loadSolutionForCurrentProblem();
      renderProblemNav();
      renderTestCases();
      typesetProblem(nextStatement);
      if (['contest', 'gym'].includes(currentRoute.kind)) loadContestNav();
      updateRouteLabel();
    } catch (error) {
      if (error.name !== 'AbortError') {
        setSubmissionStatus(`Could not load problem: ${error.message}`);
        if (options.fallback !== false) window.location.href = nextRoute.url;
      }
    } finally {
      if (wrapper && sequence === navigationSequence) wrapper.classList.remove('loading');
    }
  }

  function typesetProblem(statement) {
    try {
      const mathJax = window.MathJax;
      if (mathJax && typeof mathJax.typesetPromise === 'function') {
        mathJax.typesetPromise([statement]).catch(() => {});
      } else if (mathJax && mathJax.Hub && typeof mathJax.Hub.Queue === 'function') {
        mathJax.Hub.Queue(['Typeset', mathJax.Hub, statement]);
      }
    } catch (_) {}
  }

  function updateRouteLabel() {
    const target = document.getElementById('leetify-tab-route');
    if (target && currentRoute) target.textContent = `${currentRoute.kind} ${currentRoute.id} / ${currentRoute.index}`;
  }

  function ensureProblemWrapper() {
    const wrapper = document.getElementById('leetify-ps-wrapper');
    if (wrapper && problemStatement && problemStatement.parentNode !== wrapper) wrapper.appendChild(problemStatement);
    return wrapper;
  }

  function activateSplit() {
    if (!splitContainer) buildSplitContainer();
    const wrapper = ensureProblemWrapper();
    splitContainer.style.display = 'flex';
    document.body.classList.add('leetify-active');
    if (activateButton) activateButton.hidden = true;
    applyThemeAndLayout();
    currentSamples = extractSamples();
    selectedSample = 0;
    if (loadedSolutionKey !== `${currentProblemKey()}|${currentLang}`) loadSolutionForCurrentProblem();
    renderTestCases();
    renderProblemNav();
    updateRouteLabel();
    if (['contest', 'gym'].includes(currentRoute?.kind)) loadContestNav();
    if (wrapper) typesetProblem(problemStatement);
  }

  async function exitSplit() {
    await Store.flush();
    clearTimeout(autoRunTimer);
    autoRunTimer = null;
    if (navigationController) navigationController.abort();
    if (contestController) contestController.abort();
    if (currentRoute && initialRouteUrl && currentRoute.url !== initialRouteUrl) {
      window.location.assign(currentRoute.url);
      return;
    }
    const wrapper = document.getElementById('leetify-ps-wrapper');
    if (problemStatement && originalParent) {
      if (originalNextSibling && originalNextSibling.parentNode === originalParent) originalParent.insertBefore(problemStatement, originalNextSibling);
      else originalParent.appendChild(problemStatement);
    }
    if (wrapper) wrapper.remove();
    if (splitContainer) splitContainer.style.display = 'none';
    document.body.classList.remove('leetify-active');
    if (activateButton) activateButton.hidden = false;
  }

  function handlePopState() {
    const next = Core.parseProblemUrl(window.location.href);
    if (!splitContainer) return;
    if (splitContainer.style.display === 'none') {
      window.location.reload();
      return;
    }
    if (!next) {
      window.location.reload();
      return;
    }
    loadProblemDynamic(next.url, { push: false, fallback: false });
  }

  function handleRuntimeMessage(message) {
    if (message && message.type === 'TOGGLE_SPLIT') {
      if (splitContainer && splitContainer.style.display !== 'none') exitSplit();
      else activateSplit();
    }
  }

  function waitForProblemStatement() {
    const existing = document.querySelector('.problem-statement');
    if (existing) return Promise.resolve(existing);
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const statement = document.querySelector('.problem-statement');
        if (statement) { observer.disconnect(); clearTimeout(timeout); resolve(statement); }
      });
      const timeout = setTimeout(() => { observer.disconnect(); resolve(null); }, 10000);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  async function init() {
    if (initialized || document.getElementById('leetify-split-container')) return;
    currentRoute = Core.parseProblemUrl(window.location.href);
    if (!currentRoute) return;
    await Store.init();
    const statement = await waitForProblemStatement();
    if (!statement || initialized) return;
    initialized = true;
    problemStatement = statement;
    originalParent = statement.parentNode;
    originalNextSibling = statement.nextSibling;
    initialRouteUrl = currentRoute.url;
    currentLang = LANG[getSettings().defaultLang] ? getSettings().defaultLang : 'cpp';
    createActivateButton();
    buildSplitContainer();
    if (extensionApi?.runtime?.onMessage) extensionApi.runtime.onMessage.addListener(handleRuntimeMessage);
    if (extensionApi?.storage?.onChanged) extensionApi.storage.onChanged.addListener(handleStorageChanges);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('resize', () => { if (splitContainer) applyThemeAndLayout(); });
    window.addEventListener('pagehide', () => { Store.flush(); });
    if (getSettings().autoActivate !== false) activateSplit();
    else activateButton.hidden = false;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { init(); });
  else init();
})();

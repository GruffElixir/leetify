import { normalizeSettings } from '../domain/settings.js';
import { canonicalLegacyKey } from '../domain/problem.js';
import { isLanguage } from '../domain/languages.js';
import { LeetifyError } from '../domain/errors.js';
export const STORAGE_KEY = 'leetify_state_v3';
export const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export const clone = (value) => structuredClone(value);
export const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export function emptyState() {
  return {
    version: 3,
    solutionClock: 0,
    settings: normalizeSettings(),
    solutions: {},
    templates: {},
    cases: {},
    submissions: [],
    recoveredDrafts: [],
    preImportSnapshots: [],
    legacySiteImports: {},
  };
}
export function validateIdentity(key, language) {
  if (!canonicalLegacyKey(key) || canonicalLegacyKey(key) !== key || !isLanguage(language))
    throw new LeetifyError('INVALID_DATA', 'Invalid problem or programming language.');
}
export function validateCases(cases) {
  if (
    !Array.isArray(cases) ||
    cases.some(
      (item) =>
        !object(item) ||
        typeof item.id !== 'string' ||
        typeof item.input !== 'string' ||
        typeof item.expected !== 'string' ||
        typeof item.hasExpected !== 'boolean'
    )
  )
    throw new LeetifyError('INVALID_DATA', 'Invalid test cases.');
  return cases.map((item) => ({
    id: item.id,
    name: String(item.name || 'Custom input'),
    input: item.input,
    expected: item.expected,
    hasExpected: item.hasExpected,
    custom: !!item.custom,
  }));
}
export function validateState(value, allowSnapshots = true) {
  const bad = () => {
    throw new LeetifyError('INVALID_BACKUP', 'The backup is not a valid Leetify data file.');
  };
  if (
    !object(value) ||
    value.version !== 3 ||
    !object(value.settings) ||
    !object(value.solutions) ||
    !object(value.templates) ||
    !object(value.cases) ||
    !Array.isArray(value.submissions) ||
    !Array.isArray(value.recoveredDrafts)
  )
    bad();
  const next = emptyState();
  if (value.solutionClock !== undefined) {
    if (!Number.isSafeInteger(value.solutionClock) || value.solutionClock < 0) bad();
    next.solutionClock = value.solutionClock;
  }
  next.settings = normalizeSettings(value.settings);
  for (const [key, languages] of Object.entries(value.solutions)) {
    if (!object(languages)) bad();
    for (const [lang, entry] of Object.entries(languages)) {
      validateIdentity(key, lang);
      if (
        !object(entry) ||
        typeof entry.code !== 'string' ||
        !Number.isSafeInteger(entry.revision) ||
        entry.revision < 1 ||
        !Number.isFinite(entry.updatedAt)
      )
        bad();
      (next.solutions[key] ||= {})[lang] = clone(entry);
      next.solutionClock = Math.max(next.solutionClock, entry.revision);
    }
  }
  for (const [lang, list] of Object.entries(value.templates)) {
    if (
      !isLanguage(lang) ||
      !Array.isArray(list) ||
      list.some(
        (t) =>
          !object(t) ||
          typeof t.id !== 'string' ||
          typeof t.name !== 'string' ||
          typeof t.code !== 'string'
      )
    )
      bad();
    next.templates[lang] = clone(list);
  }
  for (const [key, cases] of Object.entries(value.cases)) {
    if (canonicalLegacyKey(key) !== key) bad();
    next.cases[key] = validateCases(cases);
  }
  for (const draft of value.recoveredDrafts) {
    if (
      !object(draft) ||
      typeof draft.code !== 'string' ||
      !isLanguage(draft.language) ||
      typeof draft.id !== 'string'
    )
      bad();
    next.recoveredDrafts.push(clone(draft));
  }
  for (const submission of value.submissions) {
    if (
      !object(submission) ||
      typeof submission.id !== 'string' ||
      canonicalLegacyKey(submission.key) !== submission.key ||
      !isLanguage(submission.language)
    )
      bad();
    next.submissions.push(clone(submission));
  }
  if (allowSnapshots && Array.isArray(value.preImportSnapshots))
    for (const snapshot of value.preImportSnapshots) {
      if (!object(snapshot) || typeof snapshot.id !== 'string') bad();
      next.preImportSnapshots.push({ ...snapshot, state: validateState(snapshot.state, false) });
      next.solutionClock = Math.max(
        next.solutionClock,
        next.preImportSnapshots.at(-1).state.solutionClock
      );
    }
  if (object(value.legacySiteImports))
    for (const [key, code] of Object.entries(value.legacySiteImports))
      if (key.startsWith('leetify_') && typeof code === 'string')
        next.legacySiteImports[key] = code;
  return next;
}
export function nextSolutionRevision(state) {
  if (state.solutionClock >= Number.MAX_SAFE_INTEGER)
    throw new LeetifyError(
      'INVALID_DATA',
      'Solution revision limit reached. Export your data before recovery.'
    );
  return ++state.solutionClock;
}
export function recover(
  state,
  { key = null, language, code, updatedAt = 0, reason = 'Recovered draft' }
) {
  const existing = state.recoveredDrafts.find(
    (d) => d.key === key && d.language === language && d.code === code
  );
  if (existing) return existing;
  const draft = { id: id('draft'), key, language, code, updatedAt, reason };
  state.recoveredDrafts.push(draft);
  return draft;
}

import { emptyState, object, recover, id, nextSolutionRevision } from './schema.js';
import { canonicalLegacyKey } from '../domain/problem.js';
import { isLanguage } from '../domain/languages.js';
import { normalizeSettings } from '../domain/settings.js';
export function mergeDraft(state, key, language, entry, preferLatest = true) {
  if (!isLanguage(language)) return;
  const code = typeof entry === 'string' ? entry : entry?.code;
  if (typeof code !== 'string') return;
  const updatedAt = Number(entry?.updatedAt) || 0;
  const canonical = canonicalLegacyKey(key);
  if (!canonical) {
    recover(state, {
      key: null,
      language,
      code,
      updatedAt,
      reason: 'Legacy draft without a problem',
    });
    return;
  }
  const languages = (state.solutions[canonical] ||= {});
  const current = languages[language];
  if (current?.code === code) return;
  if (!current || (preferLatest && updatedAt > current.updatedAt)) {
    if (current)
      recover(state, { key: canonical, language, ...current, reason: 'Different legacy draft' });
    languages[language] = { code, updatedAt, revision: nextSolutionRevision(state) };
  } else
    recover(state, {
      key: canonical,
      language,
      code,
      updatedAt,
      reason: 'Different imported draft',
    });
}
export function importLegacySite(state, site, now, preferLatest = false) {
  for (const [key, value] of Object.entries(site || {})) {
    if (
      typeof value !== 'string' ||
      !key.startsWith('leetify_') ||
      state.legacySiteImports[key] === value
    )
      continue;
    state.legacySiteImports[key] = value;
    const code = key.match(/^leetify_code_(cpp|python|java|javascript)(?:_(\d+)_([a-z0-9]+))?$/i);
    if (code)
      mergeDraft(
        state,
        code[2] ? `cf:${code[2]}:${code[3].toUpperCase()}` : null,
        code[1],
        { code: value, updatedAt: now },
        preferLatest
      );
    const template = key.match(/^leetify_tpl_(cpp|python|java|javascript)$/);
    if (template && !(state.templates[template[1]] || []).some((t) => t.code === value)) {
      const item = { id: id('tpl'), name: 'Imported template', code: value, updatedAt: now };
      (state.templates[template[1]] ||= []).push(item);
      state.settings.activeTemplateByLang[template[1]] ||= item.id;
    }
  }
}
export function migrateRecords(all, site = {}, now = Date.now()) {
  const state = emptyState();
  const legacy = object(all.leetify_state_v1) ? all.leetify_state_v1 : {};
  let siteSettings = {};
  try {
    const old = JSON.parse(site.leetify_settings || '{}');
    siteSettings = { ...old, defaultLang: old.lang, problemFontSize: old.psFontSize };
  } catch {
    /* A malformed legacy preference must not block source recovery. */
  }
  state.settings = normalizeSettings({
    ...siteSettings,
    ...legacy.settings,
    ...all.leetify_settings_v2,
  });
  const importTemplates = (lang, list) => {
    if (!isLanguage(lang) || !Array.isArray(list)) return;
    for (const t of list)
      if (
        object(t) &&
        typeof t.code === 'string' &&
        !(state.templates[lang] || []).some((old) => old.id === t.id && old.code === t.code)
      )
        (state.templates[lang] ||= []).push({
          id: String(t.id || id('tpl')),
          name: String(t.name || 'Imported template'),
          code: t.code,
          updatedAt: Number(t.updatedAt) || 0,
        });
  };
  if (object(legacy.solutions))
    for (const [key, langs] of Object.entries(legacy.solutions))
      if (object(langs))
        for (const [lang, entry] of Object.entries(langs)) mergeDraft(state, key, lang, entry);
  for (const [lang, list] of Object.entries(legacy.templates || {})) importTemplates(lang, list);
  for (const [key, value] of Object.entries(all)) {
    const solution = key.match(/^leetify_solution_v2:(.+):([^:]+)$/);
    const template = key.match(/^leetify_templates_v2:(.+)$/);
    try {
      if (solution)
        mergeDraft(state, decodeURIComponent(solution[1]), decodeURIComponent(solution[2]), value);
      if (template) importTemplates(decodeURIComponent(template[1]), value);
    } catch {
      /* Ignore corrupt keys; original storage remains intact. */
    }
  }
  for (const [index, entry] of (
    all.leetify_history_v2 ||
    legacy.submissionHistory ||
    []
  ).entries()) {
    const key = canonicalLegacyKey(entry?.key);
    if (key && isLanguage(entry.language))
      state.submissions.push({ ...entry, key, id: String(entry.id || `legacy-${index}`) });
  }
  importLegacySite(state, site, now, true);
  return state;
}

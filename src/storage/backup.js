import { object, validateState } from './schema.js';
import { migrateRecords } from './migration.js';
import { isLanguage } from '../domain/languages.js';
import { LeetifyError } from '../domain/errors.js';
export function readBackup(backup) {
  if (backup?.format === 'leetify-backup' && backup.version === 3)
    return validateState(backup.state);
  const bad = () => {
    throw new LeetifyError(
      'INVALID_BACKUP',
      'Select a valid Leetify backup. No local data was changed.'
    );
  };
  if (
    backup?.version !== 2 ||
    !object(backup.settings) ||
    !object(backup.solutions) ||
    !object(backup.templates)
  )
    bad();
  for (const languages of Object.values(backup.solutions)) {
    if (!object(languages)) bad();
    for (const [language, entry] of Object.entries(languages))
      if (
        !isLanguage(language) ||
        (typeof entry !== 'string' &&
          (!object(entry) ||
            typeof entry.code !== 'string' ||
            (entry.updatedAt != null && !Number.isFinite(entry.updatedAt))))
      )
        bad();
  }
  for (const [language, list] of Object.entries(backup.templates))
    if (
      !isLanguage(language) ||
      !Array.isArray(list) ||
      list.some(
        (t) =>
          !object(t) ||
          typeof t.code !== 'string' ||
          (t.id != null && typeof t.id !== 'string') ||
          (t.name != null && typeof t.name !== 'string')
      )
    )
      bad();
  if (backup.submissionHistory != null && !Array.isArray(backup.submissionHistory)) bad();
  return validateState(migrateRecords({ leetify_state_v1: backup }));
}

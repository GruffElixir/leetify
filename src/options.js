import { StorageClient } from './storage/client.js';
import { runnerUrl } from './domain/settings.js';
import { confirmDialog } from './ui/dialog.js';
import { readBackup } from './storage/backup.js';
const extensionApi = globalThis.browser;
const storage = new StorageClient(
  (message) => extensionApi.runtime.sendMessage(message),
  extensionApi.storage.onChanged
);
const root = document.querySelector('.leetify-options');
const saveStatus = root.querySelector('[data-save-status]');
const backupStatus = root.querySelector('[data-backup-status]');
const runnerStatus = root.querySelector('[data-runner-status]');
let state;
const pending = {};
let saving = Promise.resolve();
function render(next) {
  state = next;
  root.dataset.theme = state.settings.theme;
  for (const input of root.querySelectorAll('[data-setting]')) {
    if (input === document.activeElement || Object.hasOwn(pending, input.dataset.setting)) continue;
    const value = state.settings[input.dataset.setting];
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
  }
  for (const input of root.querySelectorAll('[data-compiler]'))
    if (input !== document.activeElement)
      input.value = state.settings.compilerByLang[input.dataset.compiler] || '';
  const stats = root.querySelector('[data-backup-stats]');
  stats.replaceChildren();
  for (const text of [
    `${Object.keys(state.solutions).length} problems`,
    `${Object.values(state.templates).reduce((sum, list) => sum + list.length, 0)} templates`,
    `${state.recoveredDrafts.length} recovered drafts`,
  ]) {
    const span = document.createElement('span');
    span.textContent = text;
    stats.append(span);
  }
  const snapshots = root.querySelector('[data-snapshots]');
  const selected = snapshots.value;
  snapshots.replaceChildren();
  for (const snapshot of [...state.preImportSnapshots].reverse()) {
    const option = document.createElement('option');
    option.value = snapshot.id;
    option.textContent = `Before import · ${new Date(snapshot.at).toLocaleString()}`;
    snapshots.append(option);
  }
  if (!snapshots.options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No recovery snapshots yet';
    snapshots.append(option);
  } else if ([...snapshots.options].some((option) => option.value === selected))
    snapshots.value = selected;
  root.querySelector('[data-restore]').disabled = !snapshots.value;
}
function patch(values) {
  Object.assign(pending, values);
  saveStatus.textContent = 'Saving…';
  const captured = { ...values };
  const operation = saving.then(async () => {
    try {
      await storage.patchSettings(captured);
      for (const [key, value] of Object.entries(captured))
        if (pending[key] === value) delete pending[key];
      saveStatus.textContent = Object.keys(pending).length ? 'Unsaved settings' : 'Saved locally';
      root.querySelector('[data-retry-settings]').hidden = !Object.keys(pending).length;
    } catch (error) {
      saveStatus.textContent = `Unsaved · ${error.message}`;
      root.querySelector('[data-retry-settings]').hidden = false;
    }
  });
  saving = operation;
  return operation;
}
root.addEventListener('change', (event) => {
  const input = event.target;
  if (input.dataset.setting) {
    const field = input.dataset.setting;
    let value =
      input.type === 'checkbox'
        ? input.checked
        : input.type === 'number'
          ? Number(input.value)
          : input.value;
    if (field === 'runnerEndpoint') {
      const url = runnerUrl(value);
      if (!url) {
        saveStatus.textContent = 'Enter a valid HTTP or HTTPS runner URL.';
        return;
      }
      value = url.href;
      patch({
        runnerEndpoint: value,
        ...(url.origin !== runnerUrl(state.settings.runnerEndpoint)?.origin
          ? { runnerConsentOrigin: '' }
          : {}),
      });
    } else patch({ [field]: value });
  }
  if (input.dataset.compiler) {
    if (!/^\d*$/.test(input.value)) {
      saveStatus.textContent = 'Compiler IDs must be numbers or empty.';
      return;
    }
    patch({ compilerByLang: { [input.dataset.compiler]: input.value } });
  }
});
root.querySelector('[data-retry-settings]').addEventListener('click', () => patch({ ...pending }));
root.querySelector('[data-grant-runner]').addEventListener('click', async () => {
  const endpoint = runnerUrl(root.querySelector('[data-setting=runnerEndpoint]').value);
  if (!endpoint) {
    runnerStatus.textContent = 'Enter a valid runner URL first.';
    return;
  }
  try {
    const granted = await extensionApi.permissions.request({ origins: [`${endpoint.origin}/*`] });
    if (!granted) {
      runnerStatus.textContent = 'Runner access was denied. Your source has not been sent.';
      return;
    }
    await storage.patchSettings({
      runnerEndpoint: endpoint.href,
      runnerConsentOrigin: endpoint.origin,
    });
    runnerStatus.textContent = `Runner access allowed for ${endpoint.origin}. Check its connection before running.`;
  } catch (error) {
    runnerStatus.textContent = error.message;
  }
});
root.querySelector('[data-check-runner]').addEventListener('click', async (event) => {
  const endpoint = runnerUrl(root.querySelector('[data-setting=runnerEndpoint]').value);
  if (!endpoint) {
    runnerStatus.textContent = 'Enter a valid runner URL first.';
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  runnerStatus.textContent = 'Checking runtimes…';
  const list = root.querySelector('[data-runtimes]');
  list.replaceChildren();
  try {
    const result = await extensionApi.runtime.sendMessage({
      type: 'RUNNER_CHECK',
      payload: { endpoint: endpoint.href, requestId: `health-${Date.now()}` },
    });
    if (!result?.ok) throw new Error(result?.error?.message || 'Runner check failed.');
    const runtimes = result.data.runtimes;
    runnerStatus.textContent = runtimes.length
      ? `Connected · ${runtimes.length} installed runtimes. No source was sent.`
      : 'Runner reachable, but no runtimes are installed. Install the languages you need in Piston.';
    for (const runtime of runtimes) {
      const item = document.createElement('li');
      item.textContent = `${runtime.language} ${runtime.version}`;
      list.append(item);
    }
  } catch (error) {
    runnerStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
root.querySelector('[data-export]').addEventListener('click', async () => {
  try {
    await saving;
    const backup = await storage.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leetify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupStatus.textContent = 'Latest saved data exported.';
  } catch (error) {
    backupStatus.textContent = error.message;
  }
});
async function selectedBackup() {
  const file = root.querySelector('[data-backup-file]').files[0];
  if (!file) throw new Error('Select a valid Leetify JSON backup first.');
  if (file.size > 52428800) throw new Error('Backups over 50 MB cannot be imported here.');
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    throw new Error('Select a valid Leetify JSON backup.');
  }
  readBackup(backup);
  return backup;
}
for (const button of root.querySelectorAll('[data-import]'))
  button.addEventListener('click', async () => {
    try {
      const backup = await selectedBackup();
      const mode = button.dataset.import;
      const perform = async () => {
        await saving;
        await storage.importBackup({ backup, mode });
        render(await storage.readSnapshot());
        backupStatus.textContent =
          mode === 'merge'
            ? 'Backup merged. Different source is preserved in recovered drafts.'
            : 'Local data replaced. The previous snapshot is available below.';
      };
      if (mode === 'merge') await perform();
      else
        confirmDialog({
          title: 'Replace local data?',
          message:
            'Replace solutions, templates, cases, and preferences with this backup? A recovery snapshot is saved before the replacement.',
          confirmLabel: 'Replace local data',
          onConfirm: perform,
        });
    } catch (error) {
      backupStatus.textContent = error.message;
    }
  });
root.querySelector('[data-restore]').addEventListener('click', () => {
  const id = root.querySelector('[data-snapshots]').value;
  if (!id) return;
  confirmDialog({
    title: 'Restore recovery snapshot?',
    message:
      'Restore this pre-import snapshot? Your current local data will become a new recovery snapshot.',
    confirmLabel: 'Restore local data',
    onConfirm: async () => {
      await storage.restoreSnapshot(id);
      render(await storage.readSnapshot());
      backupStatus.textContent = 'Recovery snapshot restored.';
    },
  });
});
storage.subscribe((next) => {
  if (next) render(next);
});
storage
  .initialize()
  .then((next) => {
    render(next);
    saveStatus.textContent = 'Saved locally';
  })
  .catch((error) => {
    saveStatus.textContent = error.message;
  });

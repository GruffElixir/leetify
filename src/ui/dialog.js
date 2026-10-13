import { button } from './icons.js';
export function openDialog({
  title,
  content,
  returnFocus = document.activeElement,
  onClose = () => {},
  document: doc = content.ownerDocument,
}) {
  const layer = doc.createElement('div');
  layer.className = 'leetify-dialog-layer leetify';
  layer.dataset.theme =
    doc.querySelector('#leetify-workspace,.leetify-options')?.dataset.theme || 'dark';
  const panel = doc.createElement('section');
  panel.className = 'lf-dialog';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const heading = doc.createElement('h2');
  heading.id = `lf-dialog-${Math.random().toString(36).slice(2)}`;
  heading.textContent = title;
  panel.setAttribute('aria-labelledby', heading.id);
  const header = doc.createElement('header');
  const closeButton = button(doc, { label: 'Close dialog', name: 'close' });
  header.append(heading, closeButton);
  const body = doc.createElement('div');
  body.className = 'lf-dialog-body';
  body.append(content);
  panel.append(header, body);
  layer.append(panel);
  doc.body.append(layer);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    layer.remove();
    onClose();
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  closeButton.addEventListener('click', close);
  const focusable = () =>
    Array.from(
      panel.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')
    ).filter((e) => !e.disabled && e.getClientRects().length);
  layer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key === 'Tab') {
      const items = focusable();
      const current = items.indexOf(doc.activeElement);
      if (event.shiftKey && current <= 0) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && current === items.length - 1) {
        event.preventDefault();
        items[0]?.focus();
      }
    }
  });
  layer.addEventListener('click', (event) => {
    if (event.target === layer) close();
  });
  closeButton.focus();
  return { close, element: panel };
}
export function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  document: doc = document,
}) {
  const content = doc.createElement('div');
  const text = doc.createElement('p');
  text.textContent = message;
  const actions = doc.createElement('div');
  actions.className = 'lf-dialog-actions';
  const cancel = button(doc, { label: 'Cancel', text: true });
  const confirm = button(doc, { label: confirmLabel, text: true, variant: 'lf-submit' });
  actions.append(cancel, confirm);
  content.append(text, actions);
  const dialog = openDialog({ title, content });
  cancel.addEventListener('click', dialog.close);
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    try {
      await onConfirm();
      dialog.close();
    } catch (error) {
      text.textContent = error.message;
      confirm.disabled = false;
    }
  });
  return dialog;
}

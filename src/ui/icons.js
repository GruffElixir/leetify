const paths = {
  code: 'm8 5-6 7 6 7m8-14 6 7-6 7m-3-17-2 20',
  play: 'm8 5 12 7-12 7Z',
  stop: 'M6 6h12v12H6Z',
  send: 'm3 3 18 9-18 9 4-9-4-9Zm4 9h14',
  chevronLeft: 'm15 5-7 7 7 7',
  chevronRight: 'm9 5 7 7-7 7',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6 2 3 3-1 1 3 3 2-1 3 1 3-3 2-1 3-3-1-2 3-2-3-3 1-1-3-3-2 1-3-1-3 3-2 1-3 3 1Z',
  close: 'm6 6 12 12M18 6 6 18',
  copy: 'M9 9h12v12H9ZM3 15V3h12',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  reset: 'M3 11a9 9 0 1 1 2 7M3 3v8h8',
  template: 'M5 3h14v18H5Zm4 5h6m-6 4h6m-6 4h3',
  theme: 'M12 3a9 9 0 1 0 9 9c-5 2-11-4-9-9Z',
  layout: 'M3 4h18v16H3Zm9 0v16',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  list: 'M9 5h12M9 12h12M9 19h12M3 5h1m-1 7h1m-1 7h1',
  more: 'M4 12h1m6 0h1m6 0h1',
  check: 'm4 12 5 5L20 6',
  plus: 'M12 4v16M4 12h16',
  exit: 'M9 3H3v18h6m5-16 7 7-7 7M7 12h14',
};
export function icon(name, doc = document) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', paths[name] || paths.code);
  svg.append(path);
  return svg;
}
export function button(doc, { label, name, action, variant = '', text = false }) {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = `lf-button ${text ? 'lf-text-button' : 'lf-icon-button'} ${variant}`;
  element.setAttribute('aria-label', label);
  element.title = label;
  if (action) element.dataset.action = action;
  if (name) element.append(icon(name, doc));
  if (text) element.append(doc.createTextNode(label));
  return element;
}

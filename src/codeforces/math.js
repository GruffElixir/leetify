import katex from 'katex';
export function renderRawMath(statement) {
  const doc = statement.ownerDocument;
  const walker = doc.createTreeWalker(statement, 4);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (
      !node.parentElement.closest(
        'pre,code,script,style,textarea,.katex,.MathJax,.MathJax_Display,math'
      ) &&
      node.nodeValue.includes('$$$')
    )
      nodes.push(node);
  }
  for (const node of nodes) {
    const pattern = /(\${6})([\s\S]+?)\1|(\${3})([\s\S]+?)\3/g;
    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    let match;
    while ((match = pattern.exec(node.nodeValue))) {
      fragment.append(doc.createTextNode(node.nodeValue.slice(cursor, match.index)));
      const span = doc.createElement('span');
      const html = katex.renderToString(match[2] ?? match[4], {
        displayMode: !!match[1],
        throwOnError: false,
        trust: false,
        strict: 'ignore',
      });
      // KaTeX creates inert markup with trust disabled; adopt it without a live HTML sink.
      const rendered = new (doc.defaultView || globalThis.window).DOMParser().parseFromString(
        html,
        'text/html'
      );
      span.append(...Array.from(rendered.body.childNodes, (node) => doc.importNode(node, true)));
      fragment.append(span);
      cursor = pattern.lastIndex;
    }
    if (cursor) {
      fragment.append(doc.createTextNode(node.nodeValue.slice(cursor)));
      node.replaceWith(fragment);
    }
  }
}

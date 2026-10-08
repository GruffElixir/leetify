import katex from 'katex';
export function renderRawMath(statement) {
  const doc=statement.ownerDocument;
  const walker=doc.createTreeWalker(statement,4); const nodes=[];
  while(walker.nextNode()) {
    const node=walker.currentNode;
    if(!node.parentElement.closest('pre,code,script,style,textarea,.katex,.MathJax,.MathJax_Display,math') && node.nodeValue.includes('$$$')) nodes.push(node);
  }
  for (const node of nodes) {
    const pattern=/(\${6})([\s\S]+?)\1|(\${3})([\s\S]+?)\3/g; const fragment=doc.createDocumentFragment(); let cursor=0; let match;
    while((match=pattern.exec(node.nodeValue))) {
      fragment.append(doc.createTextNode(node.nodeValue.slice(cursor,match.index)));
      const span=doc.createElement('span'); span.innerHTML=katex.renderToString(match[2] ?? match[4],{displayMode:!!match[1],throwOnError:false,trust:false,strict:'ignore'}); fragment.append(span); cursor=pattern.lastIndex;
    }
    if(cursor) { fragment.append(doc.createTextNode(node.nodeValue.slice(cursor))); node.replaceWith(fragment); }
  }
}

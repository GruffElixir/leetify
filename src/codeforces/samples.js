/** Read Codeforces' preformatted examples without collapsing meaningful whitespace. */
export function readSampleText(pre) {
  function read(node) {
    if (node.nodeType===3) return node.nodeValue.replace(/\r\n?/g,'\n');
    if (node.nodeType!==1) return '';
    if (node.tagName==='BR') return '\n';
    const text=Array.from(node.childNodes,read).join('');
    return ['DIV','P'].includes(node.tagName) ? text+(text.endsWith('\n')?'':'\n') : text;
  }
  return Array.from(pre?.childNodes || [],read).join('');
}
/** @typedef {{id:string,name:string,input:string,expected:string,hasExpected:boolean,custom:boolean}} SampleCase */
export function extractSamples(statement) {
  const cases=[];
  for (const group of statement.querySelectorAll('.sample-test')) {
    const inputs=group.querySelectorAll('.input pre'); const outputs=group.querySelectorAll('.output pre');
    inputs.forEach((input,index)=>cases.push({id:`sample-${cases.length+1}`,name:`Sample ${cases.length+1}`,input:readSampleText(input),expected:readSampleText(outputs[index]),hasExpected:!!outputs[index],custom:false}));
  }
  return cases;
}

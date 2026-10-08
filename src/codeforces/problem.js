import createDOMPurify from 'dompurify';
import {parseProblemUrl,problemKey} from '../domain/problem.js';
import {LeetifyError} from '../domain/errors.js';
import {extractSamples} from './samples.js';

export function assertCodeforcesPage(doc) {
  if (doc.querySelector('#challenge-form,#cf-challenge-running,.cf-challenge') || /just a moment|checking your browser|attention required/i.test(doc.title)) throw new LeetifyError('CHALLENGE','Codeforces is asking for browser verification. Open the native page and complete it.');
  if (doc.querySelector('form[action*="/enter"] input[type=password]') || /^(enter|login|sign in)\b/i.test(doc.title)) throw new LeetifyError('LOGIN_REQUIRED','Sign in to Codeforces on the native page first.');
}
export function parseProblemDocument(doc,url) {
  assertCodeforcesPage(doc);
  const route=parseProblemUrl(url); const statement=doc.querySelector('.problem-statement');
  if (!route || !statement) throw new LeetifyError('INVALID_PAGE','Codeforces did not return a problem statement.',true);
  const problems=[]; const seen=new Set();
  for (const link of doc.querySelectorAll('table.problems a[href],.problems-list a[href]')) {
    const next=parseProblemUrl(new URL(link.getAttribute('href'),url).href);
    if (!next || seen.has(problemKey(next))) continue;
    seen.add(problemKey(next)); problems.push({route:next,title:link.textContent.trim() || next.index});
  }
  return {route,title:statement.querySelector('.title')?.textContent.trim() || `Problem ${route.index}`,limits:Array.from(statement.querySelectorAll('.time-limit,.memory-limit'),e=>e.textContent.trim()),tags:Array.from(doc.querySelectorAll('.tag-box'),e=>e.textContent.trim()),statement,samples:extractSamples(statement),problems};
}
export function sanitizeStatement(statement,baseUrl) {
  const clone=statement.cloneNode(true); const purifier=createDOMPurify(statement.ownerDocument.defaultView || globalThis.window);
  purifier.sanitize(clone,{IN_PLACE:true,USE_PROFILES:{html:true,svg:true,mathMl:true},FORBID_TAGS:['script','style','iframe','object','embed','form','input','button','textarea','select'],FORBID_ATTR:['srcdoc']});
  for (const element of clone.querySelectorAll('[src],[href],[xlink\\:href]')) {
    for (const attr of ['src','href','xlink:href']) {
      const value=element.getAttribute(attr); if(!value || value.startsWith('#')) continue;
      try { const url=new URL(value,baseUrl); if (!['http:','https:'].includes(url.protocol)) element.removeAttribute(attr); else element.setAttribute(attr,url.href); } catch { element.removeAttribute(attr); }
    }
    if(element.tagName==='A') { element.setAttribute('target','_blank'); element.setAttribute('rel','noopener noreferrer'); }
  }
  clone.querySelectorAll('[srcset]').forEach(e=>e.removeAttribute('srcset'));
  return clone;
}

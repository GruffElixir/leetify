import {LeetifyError} from '../domain/errors.js';
import {assertCodeforcesPage} from './problem.js';
export function parseSubmitForm(doc,url) {
  assertCodeforcesPage(doc);
  const form=doc.querySelector('form.submit-form') || doc.querySelector('form:has([name=programTypeId])');
  const select=form?.querySelector('[name=programTypeId]'); const source=form?.querySelector('[name=source]');
  if(!form || !select || !source) throw new LeetifyError('INVALID_FORM','Codeforces did not return a submission form. Open native Submit.');
  const action=new URL(form.getAttribute('action') || url,url); const origin=new URL(url).origin;
  if(action.origin!==origin || !['http:','https:'].includes(action.protocol) || !/\/submit\/?$/.test(action.pathname)) throw new LeetifyError('INVALID_FORM','The submission form has an unsafe action.');
  const fields=[];
  for (const control of form.querySelectorAll('input,select,textarea')) {
    if(!control.name || control.disabled || ['submit','button','file','reset','image'].includes(control.type) || (['checkbox','radio'].includes(control.type) && !control.checked)) continue;
    if(control.tagName==='SELECT') for(const option of control.selectedOptions) {if(!option.disabled) fields.push([control.name,option.value]);}
    else fields.push([control.name,control.value]);
  }
  const token=fields.find(([name,value])=>name==='csrf_token' && value)?.[1] || doc.querySelector('meta[name="X-Csrf-Token"],meta[name="csrf-token"]')?.content;
  if(!token) throw new LeetifyError('INVALID_FORM','The submission form is missing its CSRF token. Reload the native page.');
  action.searchParams.delete('csrf_token');
  return {action:action.href,fields:fields.filter(([name])=>name!=='csrf_token').concat([['csrf_token',token]]),compilerOptions:Array.from(select.options).filter(o=>o.value && !o.disabled).map(o=>({id:o.value,label:o.textContent.trim()})),problemField:form.querySelector('[name=submittedProblemIndex]')?'submittedProblemIndex':'submittedProblemCode'};
}
export function buildSubmission(form,{route,compilerId,code}) {
  if(!form.compilerOptions.some(o=>o.id===String(compilerId))) throw new LeetifyError('INVALID_COMPILER','Choose an available Codeforces compiler.');
  if(typeof code!=='string' || !code.trim()) throw new LeetifyError('EMPTY_SOURCE','Write a solution before submitting.');
  const body=new URLSearchParams(form.fields); body.set('programTypeId',String(compilerId)); body.set('source',code);
  body.set(form.problemField,form.problemField==='submittedProblemIndex'?route.index:`${route.id}${route.index}`);
  return {url:form.action,body:body.toString()};
}

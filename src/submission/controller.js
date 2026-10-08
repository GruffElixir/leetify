import {LANGUAGES,isLanguage} from '../domain/languages.js';
import {parseProblemUrl,problemKey,submitUrl,statusUrl} from '../domain/problem.js';
import {LeetifyError} from '../domain/errors.js';
import {parseSubmitForm,buildSubmission} from '../codeforces/forms.js';
import {parseStatusRecords,parseSubmissionReceipt} from '../codeforces/status.js';
export class SubmissionController {
  constructor({network,repository,parseHtml,timers={setTimeout,clearTimeout},now=Date.now,onUpdate=()=>{}}) {Object.assign(this,{network,repository,parseHtml,timers,now,onUpdate}); this.prepared=new Map(); this.consumed=new Set(); this.generation=0; this.timer=null; this.controller=null; this.disposed=false;}
  async prepare({route,language,code,compilerId}) {
    if(!parseProblemUrl(route?.url) || !isLanguage(language) || typeof code!=='string' || !code.trim()) throw new LeetifyError('INVALID_SUBMISSION','Choose a problem and write source before submitting.');
    const page=await this.network.getPage(submitUrl(route)); const form=parseSubmitForm(this.parseHtml(page.html,page.url),page.url);
    const compilerOptions=form.compilerOptions.filter(option=>LANGUAGES[language].compiler.test(option.label));
    if(!compilerOptions.length) throw new LeetifyError('INVALID_COMPILER',`${LANGUAGES[language].label} is unavailable on this submission form. Open native Submit.`);
    let baselineIds=null;
    try {const status=await this.network.getPage(statusUrl(route)); const doc=this.parseHtml(status.html,status.url); if(doc.querySelector('table.status-frame-datatable')) baselineIds=parseStatusRecords(doc,route).map(r=>r.submissionId);} catch {/* A baseline failure must not fabricate an empty history. */}
    if(this.disposed) throw new LeetifyError('CANCELLED','Submission review closed.');
    const prepared={id:`review-${this.now()}-${Math.random()}`,route:structuredClone(route),language,code,form,compilerOptions,compilerId:compilerOptions.some(o=>o.id===compilerId)?compilerId:compilerOptions[0].id,baselineIds};
    this.prepared.set(prepared.id,structuredClone(prepared)); return structuredClone(prepared);
  }
  async submit(review) {
    const prepared=this.prepared.get(review.id);
    if(this.disposed || !prepared || this.consumed.has(review.id)) throw new LeetifyError('ALREADY_SENT','This review has already been sent. Check My submissions before creating another.');
    const compilerId=review.compilerId || prepared.compilerId;
    if(!prepared.compilerOptions.some(o=>o.id===compilerId)) throw new LeetifyError('INVALID_COMPILER','Choose an available compiler for this language.');
    const request=buildSubmission(prepared.form,{...prepared,compilerId}); this.consumed.add(prepared.id); this.prepared.delete(prepared.id);
    let receipt;
    try {const page=await this.network.postSubmission(request); receipt=parseSubmissionReceipt(this.parseHtml(page.html,page.url),page.url,prepared);} catch(error) {receipt={status:'unconfirmed',message:error.message || 'Check My submissions before trying again.'};}
    const record={...receipt,id:receipt.submissionId || prepared.id,key:problemKey(prepared.route),language:prepared.language,compilerId,compilerLabel:prepared.compilerOptions.find(o=>o.id===compilerId).label,createdAt:this.now(),verdict:receipt.status==='confirmed'?'Pending':receipt.status==='rejected'?'Rejected':'Unconfirmed',pending:receipt.status==='confirmed',url:receipt.submissionId?`${prepared.route.origin}/${prepared.route.kind==='gym'?'gym':'contest'}/${prepared.route.id}/submission/${receipt.submissionId}`:statusUrl(prepared.route)};
    await this.update(record);
    if(receipt.status==='confirmed' && !this.disposed) this.poll(prepared.route,record);
    return record;
  }
  async update(record) {
    try {await this.repository.recordSubmission(record);} catch {record.saveError='Submission history could not be saved. Check native My submissions.';}
    if(!this.disposed) this.onUpdate(record);
  }
  poll(route,record) {
    this.cancelPolling(); const generation=this.generation; const started=this.now(); this.controller=new AbortController();
    const tick=async()=>{
      this.timer=null;
      if(this.disposed || generation!==this.generation) return;
      try {
        const page=await this.network.getPage(statusUrl(route),{signal:this.controller.signal});
        if(this.disposed || generation!==this.generation) return;
        const match=parseStatusRecords(this.parseHtml(page.html,page.url),route).find(r=>r.submissionId===record.submissionId);
        if(match) {record={...record,...match}; await this.update(record);}
      } catch(error) {if(generation===this.generation && !this.disposed) this.onUpdate({...record,message:error.message});}
      if(this.disposed || generation!==this.generation) return;
      if(!record.pending || this.now()-started>=60000) {if(record.pending) this.onUpdate({...record,message:'Verdict is still pending. Open native status to continue checking.'});return;}
      this.timer=this.timers.setTimeout(tick,1500);
    };
    this.timer=this.timers.setTimeout(tick,1500);
  }
  cancelPolling() {this.generation++; if(this.timer!==null) this.timers.clearTimeout(this.timer); this.timer=null; this.controller?.abort(); this.controller=null;}
  dispose() {this.disposed=true;this.cancelPolling();this.prepared.clear();}
}

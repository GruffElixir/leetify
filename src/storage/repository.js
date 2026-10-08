import {STORAGE_KEY,clone,id,object,validateState,validateIdentity,validateCases,recover} from './schema.js';
import {migrateRecords,mergeDraft,importLegacySite} from './migration.js';
import {normalizeSettings} from '../domain/settings.js';
import {isLanguage} from '../domain/languages.js';
import {LeetifyError} from '../domain/errors.js';
export class StorageRepository {
  constructor({storage,now=Date.now}) { this.storage=storage; this.now=now; this.state=null; this.initializing=null; this.queue=Promise.resolve(); }
  async initialize(site={}) {
    if (!this.state) {
      if (!this.initializing) this.initializing=(async()=>{
        const all=await this.storage.get(null);
        const state=all[STORAGE_KEY] ? validateState(all[STORAGE_KEY]) : migrateRecords(all,site,this.now());
        if (!all[STORAGE_KEY]) await this.storage.set({[STORAGE_KEY]:state});
        this.state=state;
      })().finally(()=>{this.initializing=null;});
      await this.initializing;
    }
    if (Object.entries(site).some(([key,value])=>typeof value==='string' && key.startsWith('leetify_') && this.state.legacySiteImports[key]!==value)) await this.mutate(state=>importLegacySite(state,site,this.now()));
    return this.readSnapshot();
  }
  async readSnapshot() { if (!this.state) await this.initialize(); await this.queue; return clone(this.state); }
  async mutate(change) {
    if (!this.state) await this.initialize();
    const operation=this.queue.then(async()=>{
      const next=clone(this.state); const result=change(next);
      await this.storage.set({[STORAGE_KEY]:next}); this.state=next; return clone(result ?? next);
    });
    this.queue=operation.catch(()=>{}); return operation;
  }
  patchSettings(patch) { if (!object(patch)) throw new LeetifyError('INVALID_DATA','Invalid settings.'); return this.mutate(state=>{state.settings=normalizeSettings({...state.settings,...patch}); return state.settings;}); }
  saveSolution({key,language,code,expectedRevision}) {
    validateIdentity(key,language);
    if (typeof code!=='string' || !Number.isSafeInteger(expectedRevision) || expectedRevision<0) throw new LeetifyError('INVALID_DATA','Invalid solution save.');
    return this.mutate(state=>{
      const languages=state.solutions[key] ||= {}; const current=languages[language];
      if ((current?.revision || 0)!==expectedRevision) {
        if (current?.code===code) return {status:'saved',solution:current};
        const recovered=recover(state,{key,language,code,updatedAt:this.now(),reason:'Conflicting tab edit'});
        return {status:'conflict',solution:current || null,recovered};
      }
      const solution={code,updatedAt:this.now(),revision:expectedRevision+1}; languages[language]=solution; return {status:'saved',solution};
    });
  }
  saveCases({key,cases}) { validateIdentity(key,'cpp'); const validated=validateCases(cases); return this.mutate(state=>{state.cases[key]=validated; return validated;}); }
  saveTemplate({language,template}) {
    if (!isLanguage(language) || !object(template) || typeof template.code!=='string' || typeof template.name!=='string' || !template.name.trim()) throw new LeetifyError('INVALID_DATA','A template needs a language, name, and source.');
    return this.mutate(state=>{
      const entry={id:template.id || id('tpl'),name:template.name.trim().slice(0,80),code:template.code,updatedAt:this.now()};
      const list=state.templates[language] ||= []; const index=list.findIndex(t=>t.id===entry.id); if(index<0) list.push(entry); else list[index]=entry;
      state.settings.activeTemplateByLang[language]=entry.id; return entry;
    });
  }
  deleteTemplate({language,id:templateId}) { if (!isLanguage(language)) throw new LeetifyError('INVALID_DATA','Invalid language.'); return this.mutate(state=>{state.templates[language]=(state.templates[language] || []).filter(t=>t.id!==templateId); if(state.settings.activeTemplateByLang[language]===templateId) delete state.settings.activeTemplateByLang[language];}); }
  recordSubmission(record) { validateIdentity(record.key,record.language); return this.mutate(state=>{const entry={...record,id:String(record.id || id('submission'))}; const index=state.submissions.findIndex(s=>s.id===entry.id); if(index<0) state.submissions.push(entry); else state.submissions[index]={...state.submissions[index],...entry}; state.submissions=state.submissions.slice(-100); return entry;}); }
  async exportBackup() { return {format:'leetify-backup',version:3,exportedAt:this.now(),state:await this.readSnapshot()}; }
  async importBackup({backup,mode='merge'}) {
    let imported;
    if (backup?.format==='leetify-backup' && backup.version===3) imported=validateState(backup.state);
    else if (backup?.version===2 && object(backup.solutions) && object(backup.settings) && object(backup.templates)) {
      for (const langs of Object.values(backup.solutions)) {
        if(!object(langs) || Object.values(langs).some(e=>typeof e!=='string' && (!object(e) || typeof e.code!=='string'))) throw new LeetifyError('INVALID_BACKUP','The legacy backup contains invalid solutions.');
      }
      imported=migrateRecords({leetify_state_v1:backup});
    } else throw new LeetifyError('INVALID_BACKUP','Select a valid Leetify backup.');
    if (!['merge','replace'].includes(mode)) throw new LeetifyError('INVALID_DATA','Invalid import mode.');
    return this.mutate(state=>{
      if(mode==='replace') {
        const previous={...clone(state),preImportSnapshots:[]}; const snapshots=state.preImportSnapshots;
        Object.assign(state,clone(imported)); state.preImportSnapshots=[...snapshots,{id:id('snapshot'),at:this.now(),state:previous}].slice(-3);
      } else {
        for(const [key,langs] of Object.entries(imported.solutions)) for(const [lang,entry] of Object.entries(langs)) mergeDraft(state,key,lang,entry,false);
        for(const [lang,list] of Object.entries(imported.templates)) for(const entry of list) {
          const target=state.templates[lang] ||= []; const same=target.find(t=>t.id===entry.id);
          if(!same) target.push(entry); else if(same.code!==entry.code) target.push({...entry,id:id('tpl'),name:`${entry.name} (imported)`});
        }
        for(const [key,cases] of Object.entries(imported.cases)) state.cases[key] ||= cases;
        for(const draft of imported.recoveredDrafts) recover(state,draft);
        for(const entry of imported.submissions) if(!state.submissions.some(s=>s.id===entry.id)) state.submissions.push(entry);
      }
    });
  }
  async restoreSnapshot(snapshotId) {
    const state=await this.readSnapshot(); const snapshot=state.preImportSnapshots.find(s=>s.id===snapshotId);
    if(!snapshot) throw new LeetifyError('INVALID_DATA','Recovery snapshot not found.');
    return this.importBackup({backup:{format:'leetify-backup',version:3,state:snapshot.state},mode:'replace'});
  }
}

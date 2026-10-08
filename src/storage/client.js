import {STORAGE_KEY} from './schema.js';
export class StorageClient {
  constructor(sendMessage,storageEvents) {
    this.sendMessage=sendMessage; this.events=storageEvents; this.listeners=new Set();
    this.onChanged=(changes,area)=>{if(area==='local' && changes[STORAGE_KEY]) for(const listener of this.listeners) listener(changes[STORAGE_KEY].newValue || null);};
    storageEvents?.addListener(this.onChanged);
  }
  async request(method,payload) { const response=await this.sendMessage({type:'STORAGE',payload:{method,args:payload}}); if(!response?.ok) throw new Error(response?.error?.message || 'Storage is unavailable. Your draft is still in the editor.'); return response.data; }
  initialize(site={}) { return this.request('initialize',site); }
  readSnapshot() { return this.request('readSnapshot'); }
  patchSettings(patch) { return this.request('patchSettings',patch); }
  saveSolution(args) { return this.request('saveSolution',args); }
  saveCases(args) { return this.request('saveCases',args); }
  saveTemplate(args) { return this.request('saveTemplate',args); }
  deleteTemplate(args) { return this.request('deleteTemplate',args); }
  recordSubmission(args) { return this.request('recordSubmission',args); }
  exportBackup() { return this.request('exportBackup'); }
  importBackup(args) { return this.request('importBackup',args); }
  restoreSnapshot(snapshotId) { return this.request('restoreSnapshot',snapshotId); }
  subscribe(listener) { this.listeners.add(listener); return ()=>this.listeners.delete(listener); }
  dispose() { this.events?.removeListener(this.onChanged); this.listeners.clear(); }
}

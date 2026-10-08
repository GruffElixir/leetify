import {isLanguage} from './languages.js';
export const DEFAULT_RUNNER_ENDPOINT = 'http://127.0.0.1:2000/api/v2/execute';
export const DEFAULT_SETTINGS = Object.freeze({defaultLang:'cpp',theme:'dark',layout:'vertical',autoActivate:true,autoRunSamples:false,runnerEndpoint:DEFAULT_RUNNER_ENDPOINT,fontSize:14,problemFontSize:15,wrap:false,focus:false,paneWidth:44,paneHeight:42,testHeight:32,activeTemplateByLang:{},compilerByLang:{},runnerConsentOrigin:''});
const clamp = (value,min,max,fallback) => Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Number(value))) : fallback;
export function runnerUrl(value) {
  try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url : null; } catch { return null; }
}
export function normalizeSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const setting = {...DEFAULT_SETTINGS};
  setting.defaultLang = isLanguage(input.defaultLang) ? input.defaultLang : 'cpp';
  setting.theme = ['dark','light','monokai'].includes(input.theme) ? input.theme : 'dark';
  setting.layout = input.layout === 'horizontal' ? 'horizontal' : 'vertical';
  for (const field of ['autoActivate','autoRunSamples','wrap','focus']) setting[field] = typeof input[field] === 'boolean' ? input[field] : DEFAULT_SETTINGS[field];
  for (const [field,min,max] of [['fontSize',11,22],['problemFontSize',11,30],['paneWidth',20,75],['paneHeight',20,75],['testHeight',18,65]]) setting[field] = clamp(input[field],min,max,DEFAULT_SETTINGS[field]);
  const endpoint = runnerUrl(input.runnerEndpoint);
  setting.runnerEndpoint = endpoint && !/emkc\.org\/api\/v2\/piston\/execute/i.test(endpoint.href) ? endpoint.href : DEFAULT_RUNNER_ENDPOINT;
  for (const field of ['activeTemplateByLang','compilerByLang']) {
    setting[field] = {};
    if (input[field] && typeof input[field] === 'object') for (const [lang,value] of Object.entries(input[field])) if (isLanguage(lang) && typeof value === 'string') setting[field][lang] = value;
  }
  setting.runnerConsentOrigin = typeof input.runnerConsentOrigin === 'string' ? input.runnerConsentOrigin : '';
  return setting;
}

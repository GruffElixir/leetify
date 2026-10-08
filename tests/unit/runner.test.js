import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers';
import {RunnerService} from '../../src/runner/service.js';
const endpoint='http://127.0.0.1:2000/api/v2/execute';
const permissions={contains:async()=>true};
const runtimes=[{language:'c++',version:'9.2.0',aliases:['cpp']},{language:'c++',version:'12.1.0',aliases:['cpp']},{language:'python',version:'3.12.0',aliases:['python3']}];
const response = (body,status=200) => ({ok:status<400,status,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const options={endpoint,language:'cpp',owner:'tab:1',requestId:'r1'};
test('runner picks highest installed version and rejects absent languages',async()=>{const runner=new RunnerService({fetch:async()=>response(runtimes),permissions}); const result=await runner.discover(options); assert.equal(result.data.version,'12.1.0'); assert.equal((await runner.discover({...options,language:'java'})).error.code,'LANGUAGE_UNAVAILABLE');});
test('runner exposes HTTP, plain text, malformed and network errors',async()=>{
  for(const body of ['forbidden','{}',{run:{code:0}}]) {const runner=new RunnerService({fetch:async()=>response(body),permissions}); assert.equal((await runner.check(options)).ok,false);}
  const http=new RunnerService({fetch:async()=>response('no',403),permissions}); assert.equal((await http.check(options)).error.code,'RUNNER_HTTP');
  const runner=new RunnerService({fetch:async(_url,init)=>init?.method==='POST'?Promise.reject(new TypeError('NetworkError')):response(runtimes),permissions});
  const result=await runner.execute({...options,code:'x',stdin:'',filename:'solution.cpp'}); assert.equal(result.error.code,'RUNNER_NETWORK'); assert.match(result.error.message,/127\.0\.0\.1/);
});
test('execute retains compile/runtime failure diagnostics and rejects missing run',async()=>{
  let body={compile:{code:1,stderr:'syntax error'}}; const runner=new RunnerService({fetch:async(_url,init)=>response(init?.method==='POST'?body:runtimes),permissions});
  const failed=await runner.execute({...options,code:'x',stdin:'',filename:'solution.cpp'}); assert.equal(failed.ok,true); assert.equal(failed.compile.stderr,'syntax error');
  body={run:{code:1,stderr:'runtime error',stdout:''}}; assert.equal((await runner.execute({...options,code:'x',stdin:'',filename:'solution.cpp'})).run.code,1);
  body={hello:'world'}; assert.equal((await runner.execute({...options,code:'x',stdin:'',filename:'solution.cpp'})).error.code,'RUNNER_RESPONSE');
});
test('discovery and execute deadlines use 15 and 30 seconds and cleanup',async()=>{
  const active=new Map(); const delays=[]; let number=0;
  const timers={setTimeout:(fn,ms)=>{delays.push(ms); active.set(++number,fn); return number;},clearTimeout:id=>active.delete(id)};
  const fetch=async(_url,{signal}={})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
  const runner=new RunnerService({fetch,permissions,timers}); const pending=runner.check(options); await new Promise(resolve=>setImmediate(resolve)); active.values().next().value();
  assert.equal((await pending).error.code,'RUNNER_TIMEOUT'); assert.deepEqual(delays,[15000]); assert.equal(active.size,0);
  runner.cache.set(endpoint,{at:Date.now(),runtimes}); const executing=runner.execute({...options,code:'x',stdin:'',filename:'solution.cpp'}); await new Promise(resolve=>setImmediate(resolve)); active.values().next().value();
  assert.equal((await executing).error.code,'RUNNER_TIMEOUT'); assert.equal(delays.at(-1),30000); assert.equal(active.size,0);
});
test('cancellation is scoped by owner and permission denial prevents fetch',async()=>{
  let calls=0; const denied=new RunnerService({fetch:async()=>{calls++;},permissions:{contains:async()=>false}}); assert.equal((await denied.check(options)).error.code,'PERMISSION_REQUIRED'); assert.equal(calls,0);
  const runner=new RunnerService({fetch:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort')))),permissions});
  const pending=runner.check(options); await new Promise(resolve=>setImmediate(resolve)); runner.cancel({owner:'tab:2',requestId:'r1'}); assert.equal(runner.active.size,1); runner.cancel({owner:'tab:1',requestId:'r1'}); assert.equal((await pending).error.code,'CANCELLED'); assert.equal(runner.active.size,0);
});

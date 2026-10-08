const lines = value => String(value ?? '').replace(/\r\n?/g,'\n');
export function compareOutputs(actual,expected) {
  actual = lines(actual); expected = lines(expected);
  const exact = actual.trimEnd() === expected.trimEnd();
  const tokens = actual.trim().split(/\s+/).filter(Boolean).join(' ') === expected.trim().split(/\s+/).filter(Boolean).join(' ');
  return {passed:exact || tokens,mode:exact ? 'exact' : tokens ? 'tokens' : 'different',actual,expected};
}
export function summarizeExecution(result = {}) {
  const fail = stage => stage && ((typeof stage.code === 'number' && stage.code !== 0) || stage.signal || stage.status);
  const run = result.run;
  const diagnostics = [];
  for (const [label,stage] of [['Compile',result.compile],['Runtime',run]]) if (stage) {
    if (stage.stderr) diagnostics.push({stage:label.toLowerCase(),text:String(stage.stderr)});
    if (stage.message) diagnostics.push({stage:label.toLowerCase(),text:String(stage.message)});
    if (stage.signal) diagnostics.push({stage:label.toLowerCase(),text:`Signal: ${stage.signal}`});
    if (typeof stage.code === 'number' && stage.code !== 0) diagnostics.push({stage:label.toLowerCase(),text:`Exit code: ${stage.code}`});
    if (label === 'Compile' && stage.stdout) diagnostics.push({stage:'compile',text:String(stage.stdout)});
  }
  if (result.error) diagnostics.push({stage:'connection',text:typeof result.error === 'string' ? result.error : result.error.message});
  return {successful:!!result.ok && !!run && run.code === 0 && !fail(result.compile) && !fail(run),actual:String(run?.stdout || ''),diagnostics,cancelled:!!result.cancelled};
}

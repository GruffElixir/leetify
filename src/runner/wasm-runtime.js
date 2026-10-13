export const LOCAL_RUNTIME = Object.freeze({ language: 'C++20 · local', version: 'Clang 20.1.2' });
export const LOCAL_LIMITS = Object.freeze({
  sourceBytes: 1048576,
  inputBytes: 1048576,
  outputBytes: 262144,
  memoryBytes: 268435456,
  loadMs: 60000,
  compileMs: 30000,
  runMs: 2000,
  idleMs: 60000,
});
export const localStage = (code = 0, stdout = '', stderr = '', extra = {}) => ({
  code,
  stdout,
  stderr,
  signal: null,
  status: null,
  ...extra,
});

import { compareOutputs, summarizeExecution } from '../domain/execution.js';
export function createRunBatch({ context, execute, onResult = () => {} }) {
  const captured = structuredClone(context);
  const id = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const controller = new AbortController();
  let cancelled = false;
  let promise;
  async function run() {
    const results = [];
    for (const sample of captured.cases) {
      if (cancelled) break;
      let raw;
      try {
        raw = await execute({
          ...captured,
          cases: undefined,
          stdin: sample.input,
          requestId: `${id}:${sample.id}`,
          signal: controller.signal,
        });
      } catch (error) {
        raw = { ok: false, error: { message: error.message || 'Execution failed.' } };
      }
      if (cancelled) break;
      const execution = summarizeExecution(raw);
      const comparison =
        execution.successful && sample.hasExpected
          ? compareOutputs(execution.actual, sample.expected)
          : null;
      const result = {
        id: sample.id,
        batchId: id,
        key: captured.key,
        language: captured.language,
        actual: execution.actual,
        input: sample.input,
        expected: sample.expected,
        hasExpected: sample.hasExpected,
        diagnostics: execution.diagnostics,
        status: !execution.successful
          ? 'error'
          : !sample.hasExpected
            ? 'ran'
            : comparison.passed
              ? 'passed'
              : 'failed',
        comparison: comparison?.mode,
        runtime: raw.runtime,
      };
      results.push(result);
      onResult(result);
    }
    return {
      id,
      key: captured.key,
      cancelled,
      results,
      total: captured.cases.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => ['failed', 'error'].includes(r.status)).length,
    };
  }
  return {
    id,
    run: () => (promise ||= run()),
    cancel: () => {
      cancelled = true;
      controller.abort();
    },
  };
}

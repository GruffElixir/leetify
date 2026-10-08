export class LeetifyError extends Error {
  constructor(code,message,retryable = false) { super(message); this.name = 'LeetifyError'; this.code = code; this.retryable = retryable; }
}
export function errorResult(code,message,retryable = false) { return {ok:false,error:{code,message,retryable}}; }
export function fromError(error) { return errorResult(error?.code || 'REQUEST_FAILED',error?.message || 'The request failed.',!!error?.retryable); }

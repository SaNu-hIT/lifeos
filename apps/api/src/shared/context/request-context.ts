import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context propagated via async-local-storage. Phase 02 carries the
 * requestId; later phases add userId (phase-05) and turnId (phase-15) here without
 * changing call sites.
 */
export interface RequestContext {
  requestId: string;
  /** Set by the auth guard once a request is authenticated (phase-05). */
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

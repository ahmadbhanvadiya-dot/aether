/**
 * Phase 10: on-demand code with retries. A chunk can fail to load on a flaky
 * connection, or after a new deployment replaced the hashed file an open tab still
 * asks for. Each loader is memoised (prefetch, React.lazy and the caller share one
 * request), retries twice, and forgets a failure so a later attempt starts afresh.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function memoImport<T>(factory: () => Promise<T>) {
  let pending: Promise<T> | null = null
  return () =>
    (pending ??= (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await factory()
        } catch (error) {
          if (attempt >= 2) throw error
          await wait(700 * (attempt + 1))
        }
      }
    })().catch((error) => {
      pending = null
      throw error
    }))
}

/** What the visitor sees when code could not be loaded. */
export const CHUNK_FAULT = {
  title: 'This part of AETHER could not be loaded',
  detail: 'The connection dropped, or AETHER was updated while this page was open. Reload to continue: your discoveries are saved.',
  reload: true,
  dismissible: true,
}

export const loadObservatoryUI = memoImport(() => import('../ui/ObservatoryUI'))

/** Set when the Observatory's interface failed to mount; opening it then reports the fault. */
export const observatoryUnavailable = { current: false }

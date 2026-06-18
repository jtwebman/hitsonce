import type { Env } from '../env.ts';
import type { Store } from './store.ts';
import { createD1Store } from './stores/d1.ts';

// The single place that picks a storage backend. Swap this (or branch on a var)
// to back HitsOnce with a different Store implementation.
export function createStore(env: Env): Store {
  return createD1Store(env.DB);
}

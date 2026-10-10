import { useSyncExternalStore } from 'react';
import { getPosRedirectsVersion, subscribePosRedirects } from '../lib/posRedirectStore';

export function usePosRedirectsRevision() {
  return useSyncExternalStore(subscribePosRedirects, getPosRedirectsVersion, () => 0);
}

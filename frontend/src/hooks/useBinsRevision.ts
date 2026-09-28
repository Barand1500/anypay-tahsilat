import { useEffect, useState } from 'react';
import { getBinsVersion, subscribeBins } from '../lib/binStore';

/** Katalog hydrate olunca detectBank yeniden hesaplansın */
export function useBinsRevision(): number {
  const [rev, setRev] = useState(getBinsVersion);
  useEffect(() => subscribeBins(() => setRev(getBinsVersion())), []);
  return rev;
}

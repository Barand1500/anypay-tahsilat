export type CentralCatalogChange = {
  resource: string;
  action: string;
  id: string;
};

/** Subscribe to central catalog changes detected by the authenticated app shell. */
export function onCentralCatalogChange(
  resources: string | readonly string[],
  callback: (change: CentralCatalogChange) => void,
): () => void {
  const accepted = new Set(typeof resources === 'string' ? [resources] : resources);
  const listener = (event: Event) => {
    const change = (event as CustomEvent<CentralCatalogChange>).detail;
    if (change && accepted.has(change.resource)) callback(change);
  };
  window.addEventListener('central-catalog-changed', listener);
  return () => window.removeEventListener('central-catalog-changed', listener);
}

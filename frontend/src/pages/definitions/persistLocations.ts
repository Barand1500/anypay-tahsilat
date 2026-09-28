import { api } from '../../lib/api';
import type { LocationLevel, LocationRow } from './mockApiSettings';

/** Modal sonrası: yeni / değişen lokasyonları API’ye yaz */
export async function persistLocationDiff(
  prev: LocationRow[],
  next: LocationRow[],
  token: string,
): Promise<void> {
  const prevMap = new Map(prev.map((r) => [r.id, r]));
  const idMap = new Map<string, string>();
  for (const r of prev) idMap.set(r.id, r.id);

  const order: LocationLevel[] = ['Ülke', 'İl', 'İlçe', 'Mahalle'];
  for (const level of order) {
    for (const row of next.filter((r) => r.level === level)) {
      const old = prevMap.get(row.id);
      const parentReal = row.parentId ? idMap.get(row.parentId) ?? row.parentId : null;

      if (!old) {
        const created = await api.post<LocationRow>(
          '/api/locations',
          { name: row.name, level: row.level, parentId: parentReal },
          token,
        );
        idMap.set(row.id, created.id);
        continue;
      }

      if (old.name !== row.name || old.parentId !== row.parentId) {
        await api.patch(
          `/api/locations/${encodeURIComponent(row.id)}`,
          { name: row.name, parentId: parentReal },
          token,
        );
      }
    }
  }
}

/** Ödeme isteği — hazır açıklamalar (localStorage) */

export type ReadyDescription = {
  id: string;
  title: string;
  text: string;
};

const LS_KEY = 'anypay.readyDescriptions.v1';

const SEED: ReadyDescription[] = [
  {
    id: 'open-balance',
    title: 'Açık bakiye tahsilatı',
    text: 'Sayın müşterimiz, cari hesabınızdaki açık bakiyenizin tahsilatı için ödeme talebi oluşturulmuştur. Ödemenizi güvenli ödeme linki üzerinden tamamlayabilirsiniz.',
  },
  {
    id: 'invoice',
    title: 'Fatura ödemesi',
    text: 'İlgili fatura / hizmet bedelinin tahsilatı için ödeme isteği oluşturulmuştur. Tutarı kontrol ederek ödemeyi tamamlayınız.',
  },
  {
    id: 'installment',
    title: 'Taksitli ödeme',
    text: 'Belirtilen tutarın taksitli ödeme seçenekleriyle tahsilatı için ödeme isteği oluşturulmuştur. Size uygun taksiti seçerek işlemi tamamlayabilirsiniz.',
  },
  {
    id: 'reminder',
    title: 'Ödeme hatırlatması',
    text: 'Muaccel hale gelen borcunuz için hatırlatma amaçlı ödeme isteği oluşturulmuştur. En kısa sürede ödemenizi gerçekleştirmenizi rica ederiz.',
  },
];

function uid() {
  return `rd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadReadyDescriptions(): ReadyDescription[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      localStorage.setItem(LS_KEY, JSON.stringify(SEED));
      return SEED.map((x) => ({ ...x }));
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return SEED.map((x) => ({ ...x }));
    return parsed
      .filter(
        (x): x is ReadyDescription =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as ReadyDescription).id === 'string' &&
          typeof (x as ReadyDescription).title === 'string' &&
          typeof (x as ReadyDescription).text === 'string',
      )
      .map((x) => ({ id: x.id, title: x.title, text: x.text }));
  } catch {
    return SEED.map((x) => ({ ...x }));
  }
}

function persist(list: ReadyDescription[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function saveReadyDescriptions(list: ReadyDescription[]) {
  persist(list);
}

export function addReadyDescription(title: string, text: string): ReadyDescription[] {
  const list = loadReadyDescriptions();
  list.push({ id: uid(), title: title.trim(), text: text.trim() });
  persist(list);
  return list;
}

export function updateReadyDescription(
  id: string,
  title: string,
  text: string,
): ReadyDescription[] {
  const list = loadReadyDescriptions().map((x) =>
    x.id === id ? { ...x, title: title.trim(), text: text.trim() } : x,
  );
  persist(list);
  return list;
}

export function deleteReadyDescription(id: string): ReadyDescription[] {
  const list = loadReadyDescriptions().filter((x) => x.id !== id);
  persist(list);
  return list;
}

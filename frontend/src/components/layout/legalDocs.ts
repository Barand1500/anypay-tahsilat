/** Footer sözleşmeler — metinler sonra doldurulacak */

export type LegalDocId =
  | 'kvkk'
  | 'hizmet'
  | 'guvenlik'
  | 'tahsilat'
  | 'iptal-iade'
  | 'iletisim'
  | 'uyelik';

export type LegalDoc = {
  id: LegalDocId;
  title: string;
  subtitle: string;
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    id: 'kvkk',
    title: 'KVKK ve Aydınlatma Metni',
    subtitle: 'Kişisel verilerin korunması',
  },
  {
    id: 'hizmet',
    title: 'Hizmet Sözleşmesi',
    subtitle: 'Hizmet kullanım koşulları',
  },
  {
    id: 'guvenlik',
    title: 'Güvenlik Bilgilendirmesi',
    subtitle: 'Güvenli ödeme ve veri güvenliği',
  },
  {
    id: 'tahsilat',
    title: 'Tahsilat Sözleşmesi',
    subtitle: 'Elektronik POS tahsilat koşulları',
  },
  {
    id: 'iptal-iade',
    title: 'İptal ve İade Politikası',
    subtitle: 'İptal, iade ve itiraz süreçleri',
  },
  {
    id: 'iletisim',
    title: 'İletişim Bilgileri',
    subtitle: 'Destek ve iletişim kanalları',
  },
  {
    id: 'uyelik',
    title: 'Üyelik Sözleşmesi',
    subtitle: 'Üyelik hak ve yükümlülükleri',
  },
];

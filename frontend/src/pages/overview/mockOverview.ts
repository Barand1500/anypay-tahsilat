/** Özet sayfası mock verisi — sonra API'ye bağlanacak */

export const mockOverview = {
  filters: {
    branchLabel: 'Şube/Departman Seçin',
    userLabel: 'Kullanıcı Seçin',
  },
  kpis: [
    {
      id: 'customers',
      title: 'Müşteriler',
      value: '11',
      meta: '11 Aktif, 0 Pasif Müşteri',
      tone: 'blue' as const,
    },
    {
      id: 'moves',
      title: 'Hareketler',
      value: '29 Başarılı',
      meta: '51 Hatalı',
      tone: 'green' as const,
    },
    {
      id: 'cancel',
      title: 'İptal / İade',
      value: '4 İptal',
      meta: '0 İade',
      tone: 'red' as const,
    },
    {
      id: 'requests',
      title: 'Ödeme İstekleri',
      value: '5 Ödenen',
      meta: '1 Bekleyen',
      tone: 'orange' as const,
    },
  ],
  periods: [
    {
      id: 'day',
      title: 'Bugün vs Dün',
      current: '0,00 ₺',
      previous: '0,00 ₺',
      changePct: 100,
      banks: [] as { id?: string; name: string; amount: string; logo?: string }[],
    },
    {
      id: 'week',
      title: 'Bu Hafta vs Geçen Hafta',
      current: '0,00 ₺',
      previous: '155.618,34 ₺',
      changePct: -100,
      banks: [] as { id?: string; name: string; amount: string; logo?: string }[],
    },
    {
      id: 'month',
      title: 'Bu Ay vs Geçen Ay',
      current: '203.698,34 ₺',
      previous: '192.347,95 ₺',
      changePct: 5.9,
      banks: [
        { id: 'qnb', name: 'QNB', amount: '197.208,34 ₺' },
        { id: 'akbank', name: 'AKBANK', amount: '6.490,00 ₺' },
      ],
    },
    {
      id: 'year',
      title: 'Bu Yıl vs Geçen Yıl',
      current: '554.839,31 ₺',
      previous: '0,00 ₺',
      changePct: 100,
      banks: [
        { id: 'qnb', name: 'QNB', amount: '344.438,29 ₺' },
        { id: 'akbank', name: 'AKBANK', amount: '197.039,00 ₺' },
        { id: 'tosla', name: 'Tosla', amount: '13.362,02 ₺' },
      ],
    },
  ],
  chart: {
    title: 'Hareketler',
    subtitle: 'Hareket akışınızı izleyebilirsiniz',
    range: 'Bugün',
  },
  pieDatasets: [
    {
      id: 'payment_status',
      label: 'Ödeme durumu',
      slices: [
        { id: 'ok', label: 'Başarılı', value: 29, color: '#16a34a' },
        { id: 'wait', label: 'Bekleyen', value: 8, color: '#f59e0b' },
        { id: 'fail', label: 'Hatalı', value: 51, color: '#e11d48' },
        { id: 'cancel', label: 'İptal', value: 4, color: '#64748b' },
      ],
    },
    {
      id: 'banks',
      label: 'Banka payı',
      slices: [
        { id: 'qnb', label: 'QNB', value: 62, color: '#2f80ed' },
        { id: 'akbank', label: 'Akbank', value: 24, color: '#ea580c' },
        { id: 'tosla', label: 'Tosla', value: 9, color: '#8b5cf6' },
        { id: 'other', label: 'Diğer', value: 5, color: '#94a3b8' },
      ],
    },
    {
      id: 'branches',
      label: 'Şube payı',
      slices: [
        { id: 'merkez', label: 'Merkez', value: 40, color: '#1f6fd8' },
        { id: 'ist', label: 'İstanbul Anadolu', value: 28, color: '#0d9488' },
        { id: 'ank', label: 'Ankara', value: 18, color: '#c026d3' },
        { id: 'izm', label: 'İzmir', value: 14, color: '#ca8a04' },
      ],
    },
  ],
};

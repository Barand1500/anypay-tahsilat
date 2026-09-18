# Kod Standartları

Bu proje **temiz başlangıç** prensibiyle yazılır. Karmaşıklık ve tekrar yasaktır.

---

## Genel ilkeler

1. **Tek sorumluluk:** Bir dosya / bileşen bir işi yapsın.
2. **Tekrar yok:** Aynı UI veya iş mantığı 2+ yerde kopyalanmaz → ortak component / hook / util.
3. **Widget mantığı:** Dashboard kartları, filtreler, tablolar yeniden kullanılabilir widget/component olur.
4. **Sayfa ince kalır:** Sayfa sadece layout + veri bağlama; ağır UI parçaları `components/` altında.
5. **Türkçe yorum:** Kritik bloklara kısa, anlamlı Türkçe yorum yazılır. Gereksiz / bariz yorum yazılmaz.
6. **Tip güvenliği:** TypeScript strict; `any` sadece geçici ve gerekçeli.
7. **İsimlendirme:** İngilizce kod (değişken, fonksiyon, dosya). Kullanıcıya görünen metinler Türkçe.
8. **Ortam sırları:** `.env` commit edilmez. Örnek `.env.example` tutulur.
9. **Kalıntı yok:** Revize sonrası eski kod, kullanılmayan import, yedek dosya (`*Old*`, yorum satırına alınmış blok) silinir. Ya kullanılır ya kaldırılır.

---

## Yorum stili (zorunlu format)

```ts
// Müşteri listesini şube filtresine göre çeker
async function fetchCustomers(branchId: string) {
  // ...
}
```

- Kısa cümle, ne yaptığını söylesin.
- "Bu bir fonksiyon" gibi boş yorum yazma.
- Karmaşık iş kurallarında *neden* yazılabilir.

---

## Frontend kuralları

- Klasör: `features/` veya ekran bazlı (`pages/Login`, `pages/Dashboard`).
- Ortak UI: `components/ui/` (Button, Input, Card…).
- İş widget’ları: `components/widgets/` (StatCard, PeriodCompareCard, ChartPanel…).
- Formlar: ortak Input + validation; kopya form markup yok.
- Stil: tutarlı CSS değişkenleri / tema; rastgele inline renk yağmuru yok.
- Responsive: mobil + masaüstü düşünülür.

### Login ekranı referansı

Mevcut site split-screen login’i temel alınır; daha temiz tipografi ve boşlukla modernleştirilir. Marka: Güzel Teknoloji / AnyPay bağlamı netleşince logo/metin güncellenir.

---

## Backend kuralları

- Route → controller/service → Prisma (veya repository).
- İş kuralı route içinde şişirilmez.
- Hata cevapları tutarlı JSON: `{ success, message, data? }`.
- Auth middleware merkezi olur.
- POS / banka entegrasyonları ayrı modül; sayfa koduna gömülmez.

---

## Veritabanı

- Prisma schema kaynak gerçeğe yakın tutulur.
- Legacy tablo/kolon isimleri map’lenebilir (`@@map`).
- Dump %100 doğru sayılmaz; migration öncesi doğrula.
- Üretimde `db push` dikkatli; ileride migration’a geçilebilir.

---

## Git / versiyon

- Küçük, anlamlı commit’ler.
- Örnek: `v0.1: proje iskeleti ve dokümantasyon`
- Örnek: `v0.2: login ekranı ve auth API iskeleti`
- Aniden tüm paneli tek commit’te yazma.

---

## Yapay zeka / geliştirici için

- Kullanıcı “sayfa sayfa” dediğinde tüm menüyü bir anda üretme.
- Önce ilgili kural/doc’a bak, sonra kod yaz.
- Belirsizse sor; tahminle şişirme.

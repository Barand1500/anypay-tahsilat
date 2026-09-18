# Veritabanı — Nasıl paylaşılır?

Mevcut DB: `anypay-tahsilat-db` (CloudPanel / Percona 8).

Şema **referans**tır; %100 doğru kabul edilmez. Yine de dump olursa modelleme ve API çok hızlanır.

---

## Önerilen yol: `.sql` dump (en iyi)

### A) phpMyAdmin ile (kolay)

1. CloudPanel → site → **Veritabanı** → phpMyAdmin **Yönet**
2. Sol menüden `anypay-tahsilat-db` seç
3. Üstten **Dışa Aktar (Export)**
4. Yöntem: **Hızlı** veya **Özel**
5. Format: **SQL**
6. Mümkünse:
   - Yapı + veri (ilk aşama için ideal)
   - Veya sadece yapı (daha küçük dosya; önce şema yeter)
7. İndirilen dosyayı proje klasörüne koy:

```text
docs/db/anypay-tahsilat-db.sql
```

İstersen iki dosya:

```text
docs/db/schema.sql   # sadece yapı
docs/db/data.sql     # veri (opsiyonel, büyük olabilir)
```

### B) SSH ile (daha temiz)

```bash
mysqldump -u anypay-tahsilat-user -p \
  --single-transaction --routines --triggers \
  anypay-tahsilat-db > anypay-tahsilat-db.sql
```

Sonra dosyayı bilgisayarına indirip `docs/db/` içine at.

---

## Alternatif: sadece tablo listesi + önemli tablolar

Dosya çok büyükse (yüzlerce MB):

1. Önce **sadece yapı** export et.
2. Kritik tabloları ayrıca export et:
   - `user`, `rol`, `izinler`
   - `musteriler`, `odemeler`, `odeme_istekleri`
   - `ayarlar`, `bankalar`, `ortak_sanal_pos`

---

## Güvenlik uyarısı

Dump içinde şifre hash’leri, API anahtarları, SMTP/SMS secret’ları olabilir.

- `docs/db/*.sql` → `.gitignore` ile **commit edilmesin** (repo public olabilir).
- Sadece lokal / Cursor sohbetinde paylaş.
- Canlı şifreleri sohbete düz metin yazma; `.env` kullan.

---

## Ben (AI) dump’ı nasıl kullanırım?

1. `docs/db/` altına `.sql` koyduğunu söyle.
2. Dosyayı okuyup tablo/kolonları çıkarırım.
3. Prisma `schema.prisma` taslağını buna göre öneririm.
4. Şüpheli / tutarsız yerleri işaretlerim — “doğru kabul etmem”.

---

## Şimdilik dump yoksa

Ekran görüntülerindeki tablo listesiyle ilerleriz; login için `user` tablosu yeterli olur. Diğer modüllerde dump şart hale gelebilir.

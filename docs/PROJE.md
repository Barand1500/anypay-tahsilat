# AnyPay Tahsilat — Proje Özeti

> Bu dosya proje vizyonunu, kapsamı ve ilerleme mantığını anlatır.
> Teknik kod kuralları için: `.cursor/rules/` ve `docs/KOD_STANDARTLARI.md`

---

## 1. Ne yapıyoruz?

Mevcut PHP tahsilat panelini ([tahsilat.guzelteknoloji.com](https://tahsilat.guzelteknoloji.com/)) referans alarak **React + Node.js** ile yeniden yazıyoruz.

- Daha modern, temiz ve tutarlı arayüz
- Aynı iş mantığı (müşteri, ödeme, rapor, tanımlama, ayarlar)
- CloudPanel üzerinde canlıya alma (`tahsilat.anypay.com.tr`)

**Önemli:** Eski site referanstır; birebir kopya değil, **daha iyi UX** hedeflenir.

---

## 2. Referans ortam (CloudPanel)

| Bilgi | Değer |
|--------|--------|
| Domain | `tahsilat.anypay.com.tr` |
| Site kullanıcısı | `anypay-tahsilat` |
| Kaynak repo | `/home/anypay-tahsilat/apps/anypay-tahsilat` (git burada) |
| Site kökü | `/home/anypay-tahsilat/htdocs/tahsilat.anypay.com.tr` (yayın; git değil) |
| IP | `46.197.176.51` |
| DB host | `127.0.0.1:3306` |
| DB adı | `anypay-tahsilat-db` |
| DB kullanıcı | `anypay-tahsilat-user` |
| DB motoru | Percona Server 8.0 (MySQL uyumlu) |
| Web | nginx + (eski sistemde PHP 8.1) |

---

## 3. Veritabanı politikası

- Veritabanı **hazır** ama **%100 doğru kabul edilmez**.
- Şema incelenir, gerekirse düzeltilir / sadeleştirilir / Prisma ile yeniden modellenir.
- Legacy tablo isimleri (Türkçe) korunabilir; yeni kodda anlamlı mapping yapılır.
- Dump dosyası: `docs/db/` klasörüne konur (bkz. `docs/VERITABANI.md`).

---

## 4. Teknoloji (kilitli — bkz. `docs/KARARLAR.md`)

| Katman | Teknoloji |
|--------|-----------|
| Marka | Güzel Teknoloji (logo mevcut) |
| Canlı | `tahsilat.anypay.com.tr` |
| Frontend | React (Vite) + TypeScript + Tailwind |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| DB | MySQL / Percona (mevcut dump referans) |
| Auth | E-posta + şifre → JWT (sonradan değişebilir) |
| Deploy | Git + `scripts/server-deploy.sh` — pratik notlar: `docs/DEPLOY.md` |

Yapı (hedef klasörler):

```text
anypay-tahsilat/
├── frontend/          # React uygulaması
├── backend/           # API
├── scripts/           # deploy vb.
├── docs/              # bilgi dosyaları
└── .cursor/rules/     # yapay zeka / kod kuralları
```

---

## 5. Çalışma şekli (çok kritik)

1. **Sayfa sayfa** ilerlenir — bir anda tüm sistem yazılmaz.
2. Sıra: bilgi dosyaları → proje iskeleti → **Login** → Özet → diğer ekranlar.
3. Her adım bitince kullanıcı onayı alınır, sonra sonraki sayfaya geçilir.
4. GitHub: `https://github.com/Barand1500/anypay-tahsilat.git`
5. Commit mesajları anlamlı ve Türkçe/İngilizce tutarlı: örn. `v0.1: proje iskeleti`, `v0.2: login ekranı`

---

## 6. Ekran haritası (referans menü)

Kaynak panel menüsü:

- **Giriş (Login)** ← ilk ekran
- Özet (Dashboard)
- Müşteriler
- Hareketler
- Ödeme İstekleri
- Raporlar (istatistik, tahsilat, banka vb.)
- Tanımlamalar (lokasyon, banka/kart, vergi dairesi, şube…)
- Ayarlar (genel, e-posta, SMS, ERP…)
- Hızlı Ödeme (sidebar CTA)

---

## 7. Deploy mantığı

**Önemli:** `htdocs` git repo değil. Pull/build → `apps/anypay-tahsilat`. Ayrıntı: **`docs/DEPLOY.md`**.

Tam deploy (backend hazırken):

```bash
bash /home/anypay-tahsilat/apps/anypay-tahsilat/scripts/server-deploy.sh
```

Akış (özet): `git pull` (apps) → npm install → frontend/backend build → htdocs’a kopyala → prisma → process restart → health check.

---

## 8. Durum

| Adım | Durum |
|------|--------|
| Proje bilgi / kural dosyaları | Yapılıyor |
| Repo iskeleti (frontend + backend) | Bekliyor |
| Login ekranı | Bekliyor |
| Deploy script | Login sonrası / iskelet ile |
| Diğer sayfalar | Sırayla |

---

*Son güncelleme: 2026-09-17*

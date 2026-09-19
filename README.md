<p align="center">
  <img src="docs/screenshots/logo.png" alt="Güzel Teknoloji" width="220" />
</p>

<h1 align="center">AnyPay Tahsilat</h1>

<p align="center">
  <strong>Güzel Teknoloji</strong> tahsilat panelinin modern yeniden yazımı<br/>
  React · Express · Prisma · JWT
</p>

<p align="center">
  <a href="https://tahsilat.anypay.com.tr">Canlı</a> ·
  <a href="https://tahsilat.guzelteknoloji.com/">Referans PHP</a> ·
  <a href="docs/PROJE.md">Proje özeti</a> ·
  <a href="docs/KARARLAR.md">Kararlar</a>
</p>

---

## Bu nedir?

Eski PHP tahsilat panelini referans alarak **daha sade, modern ve tutarlı** bir arayüz + API inşa ediyoruz. Birebir kopya değil; aynı iş mantığı, daha iyi UX.

| | |
|---|---|
| **Marka** | Güzel Teknoloji |
| **Canlı** | `tahsilat.anypay.com.tr` |
| **Repo** | [Barand1500/anypay-tahsilat](https://github.com/Barand1500/anypay-tahsilat) |

---

## Ekranlar & ilerleme

| Alan | Durum |
|------|--------|
| Login (Rive maskot, aurora) | Hazır |
| Özet (KPI, dönem kartları, hızlı işlemler, pasta, hareket grafiği) | Hazır (mock) |
| Layout (sidebar kitap kenarı, header, tema, profil) | Hazır |
| Modüller · Roller · Kullanıcılar | Hazır (mock) |
| Sürümler · Loglar · Sistem Sıfırlama | Hazır (mock) |
| **Müşteriler** | Hazır (mock: liste, form, detay, Excel CSV, ödeme al/iste) |
| **Hareketler** | Hazır (mock: filtre, liste, dekont) |
| Rapor · Tanım · Ayar · Ödeme İstekleri | Yakında |

<p align="center">
  <img src="docs/screenshots/role-add-hero.png" alt="Roller — Rol Ekle illüstrasyonu" width="480" />
  <br/>
  <em>Roller sayfası — “Rol Ekle” kartı illüstrasyonu</em>
</p>

---

## Öne çıkanlar

- **Açık / koyu tema** — GSAP “venom” geçiş, vurgu rengi (mavi / yeşil / mor)
- **Sidebar** — açık modda kitap kenarı seçim + yumuşak kayma; dar modda ikon menü
- **Klavye modu** — panelde hızlı gezinme
- **Hızlı erişim** — sidebar’dan header yuvalarına sürükle-bırak
- **Özet hızlı işlemler** — 4 slot, çark ile düzenleme (`localStorage`)
- **Yetki iskeleti** — rol bazlı görüntüle / kaydet / sil (mock)

---

## Stack

```text
frontend/   React 19 + Vite + Tailwind 4 + GSAP + Rive
backend/    Express + TypeScript + Prisma + JWT
docs/       Kararlar, standartlar, yol haritası
scripts/    CloudPanel deploy
```

---

## Hızlı başlangıç

```bash
npm run install:all

copy backend\.env.example backend\.env
# DATABASE_URL + JWT_SECRET

cd backend && npx prisma generate && npm run dev
# ayrı terminal
cd frontend && npm run dev
```

| Servis | Adres |
|--------|--------|
| Frontend | http://127.0.0.1:5173 |
| Backend | http://127.0.0.1:3010 |

**Geçici DEV giriş:** `admin@guzelteknoloji.com` / `123456`  
(`AUTH_DEV_BYPASS` / non-production — silinecek)

---

## Dokümantasyon

| Dosya | İçerik |
|--------|--------|
| [docs/KARARLAR.md](docs/KARARLAR.md) | Kilitli tercihler |
| [docs/PROJE.md](docs/PROJE.md) | Vizyon & CloudPanel |
| [docs/KOD_STANDARTLARI.md](docs/KOD_STANDARTLARI.md) | Kod kuralları |
| [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md) | Sayfa sırası |
| [docs/VERITABANI.md](docs/VERITABANI.md) | DB notları |
| `.cursor/rules/` | Agent kuralları |

---

## Çalışma ilkeleri

1. **Sayfa sayfa** — tüm paneli bir anda yazmıyoruz  
2. Onay olmadan büyük faza geçilmez  
3. UI metinleri **Türkçe**, kod **İngilizce**  
4. Modal: yalnızca **Esc / X** ile kapanır (overlay tıklama yok)  
5. `.env` ve `docs/db/*.sql` **commit edilmez**

---

## Deploy

```bash
bash scripts/server-deploy.sh
```

CloudPanel site: `anypay-tahsilat` → `tahsilat.anypay.com.tr`

---

## Marka

<p align="center">
  <img src="docs/screenshots/logo.png" alt="Logo (açık)" height="48" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/logo-white.png" alt="Logo (koyu zemin)" height="48" style="background:#1f6fd8;padding:8px 16px;border-radius:8px;" />
</p>

Logolar: `frontend/public/brand/`

---

<p align="center">
  <sub>Güzel Teknoloji® · AnyPay Tahsilat</sub>
</p>

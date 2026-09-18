# Yol Haritası

Küçük adımlarla ilerliyoruz. Bir adım bitmeden sonrakine geçilmez (kullanıcı onayı).

---

## Faz 0 — Bilgi & kurallar

- [x] `docs/PROJE.md`
- [x] `docs/KOD_STANDARTLARI.md`
- [x] `docs/VERITABANI.md`
- [x] `docs/YOL_HARITASI.md`
- [x] `docs/KARARLAR.md`
- [x] `.cursor/rules/` yapay zeka kuralları
- [x] Kullanıcı sorularına cevap
- [x] DB dump (`docs/db/anypay-tahsilat-db.sql`)

---

## Faz 1 — Proje iskeleti

- [x] Monorepo: `frontend/` + `backend/`
- [x] TypeScript + Tailwind (FE), Express (BE)
- [x] `.env.example`, `.gitignore`
- [x] Prisma bağlantı iskeleti (`user` odaklı)
- [x] Deploy script taslağı (yollar: anypay-tahsilat)
- [ ] İlk commit: `v0.1: proje iskeleti` (kullanıcı isterse)

---

## Faz 2 — Login

- [x] Login UI (modern split kart + soft blur, Güzel Teknoloji)
- [x] Rive Login Teddy — soft mouse bakış + şifrede göz kapatma
- [x] Auth API (login, me, logout) — JWT + bcrypt `$2y$`
- [x] Korumalı route iskeleti
- [ ] Commit: `v0.2: login ekranı` (kullanıcı isterse)

---

## Faz 3 — Shell (layout)

- [x] Sidebar (varsayılan açık, collapse)
- [x] Header (arama görünümü, profil görünümü, GSAP tema)
- [x] Ortak widget’lar (StatCard, PeriodCompare, ChartPanel)
- [ ] Commit (kullanıcı isterse)

---

## Faz 4 — Özet (Dashboard)

- [x] KPI + dönem + grafik (mock)
- [ ] API bağlama (sonra)
- [ ] Commit (kullanıcı isterse)

---

## Sonraki fazlar (sırayla)

5. Müşteriler  
6. Hareketler  
7. Ödeme İstekleri  
8. Hızlı Ödeme  
9. Raporlar  
10. Tanımlamalar  
11. Ayarlar  
12. POS entegrasyonları (QNB, Akbank, Tosla…)  

Her faz kendi commit’iyle kapanır.

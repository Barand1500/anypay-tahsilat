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
- [x] DB dump (`docs/db/`)

---

## Faz 1 — Proje iskeleti

- [x] Monorepo: `frontend/` + `backend/`
- [x] TypeScript + Tailwind (FE), Express (BE)
- [x] Prisma + Express + Vite
- [x] Deploy script (`scripts/server-deploy.sh`)

---

## Faz 2 — Login

- [x] Login UI (classic + globe)
- [x] Auth API (şifre + OTP + JWT)
- [x] Şifremi unuttum (e-posta kodu + reset)
- [x] Korumalı route

---

## Faz 3 — Shell (layout)

- [x] Sidebar / Header / Footer
- [x] Tema, kur şeridi, jest rüzgarı, kasa (vault)
- [x] Yetki (FE PermissionContext + BE `requireModulePerm`)

---

## Faz 4–11 — Panel modülleri

- [x] Özet (API)
- [x] Müşteriler
- [x] Hareketler + dekont PDF/e-posta
- [x] Ödeme istekleri + hızlı ödeme + public `/pay`
- [x] Raporlar
- [x] Tanımlamalar (POS, kart, anlaşmalar, sözleşmeler API, lokasyon…)
- [x] Ayarlar (genel, e-posta, SMS, ERP kaydı, vs.)
- [x] Kullanıcılar / roller / modüller / log / sürüm / sistem sıfırlama

---

## Faz 12 — POS / gateway

- [x] Akbank V2 SecurePay
- [x] NestPay / Payten (çoğu TR banka)
- [ ] Tosla / iyzico / Param vb. özel adapter’lar (isteğe bağlı)

---

## Kalan / iyileştirme

- ERP canlı bakiye (entegrasyon bekliyor)
- OTP DB’de (`otp_challenge`) — tamam
- Vault değer şifreleme (AES-GCM, `VAULT_ENC_KEY`) — tamam
- Profil foto (uploads + menü avatar) — tamam
- Favori müşteri yuvaları (gerçek müşteri listesi) — tamam
- Dekont PDF indirme + e-posta eki — tamam

---

*Son güncelleme: 2026-09-28*

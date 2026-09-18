# Kararlar (kilitlenen tercihler)

Bu dosya sohbette verilen yanıtların resmi kaydıdır. Değişirse burası güncellenir.

---

## Marka

- **Marka adı:** Güzel Teknoloji (GÜZEL Teknoloji®)
- **Logo:** Mevcut Güzel Teknoloji logosu kullanılır
- AnyPay yalnızca yayın domain / sunucu kimliği (`anypay-tahsilat`); ürün markası Güzel Teknoloji’dir

## Yayın

- **Canlı domain:** `https://tahsilat.anypay.com.tr`
- CloudPanel site user: `anypay-tahsilat`
- Site kök: `/home/anypay-tahsilat/htdocs/tahsilat.anypay.com.tr`
- Referans (eski PHP): `https://tahsilat.guzelteknoloji.com/`

## Auth

- İlk sürüm: **e-posta + şifre** (mevcut login ile aynı akış)
- “Şifremi unuttum” UI’da yer alır; backend sonra tamamlanabilir
- 2FA vb. şimdilik yok
- **Her şey sonradan değişebilir / güncellenebilir** — sabit kabul etme
- **Geçici DEV login (silinecek):** `admin@guzelteknoloji.com` / `123456`
  - `AUTH_DEV_BYPASS=1` veya non-production ortamda aktif
  - DB yoksa bile mock kullanıcı ile giriş

## Panel (Özet)

- Tema: yalnızca **Açık ↔ Koyu** (Sistem yok)
- Tema geçişi: GSAP — ikon ortaya gelir, renkler “patlama” ile yumuşak değişir
- Sidebar: varsayılan **açık**, collapse edilebilir
- Özet verisi: şimdilik **mock** — sonra API’ye bağlanacak
- Hızlı Ödeme / Profil: şimdilik sadece görünüm; sayfalar sırayla gelecek

## UI kütüphanesi

- **Tailwind CSS + kendi UI/widget bileşenlerimiz**
- Neden: sık revizyonda MUI/Ant gibi ağır setler kilit yaratır; Tailwind ile kod bizde kalır, kullanılmayan stil/bileşen kolay silinir
- Ortak parçalar: `components/ui/` ve `components/widgets/`

## Login maskot

- Layout: ortada yuvarlak split kart (sol maskot, sağ form), soft blur arka plan
- Animasyon: Rive `@rive-app/react-canvas` + `frontend/public/rive/login-teddy.riv`
- Kaynak: JcToon Animated Login Screen (CC BY) — Login Teddy ailesi
- State Machine: `Login Machine`
  - `isChecking` → bakış / takip açık
  - `isHandsUp` → şifre **gizli** iken göz kapatma
  - Şifre **görünür** VEYA şifre alanı odaktayken → göz kapatma (`coverEyes`)
  - Şifre gizli + başka alanda → bakış / mouse takip
  - `numLook` → soft **yatay** mouse bakış (0–100)
  - Dikey (yukarı) bakış: bu ücretsiz `.riv` dosyasında state input yok — eklenmedi
  - `trigSuccess` / `trigFail` → giriş sonucu
- Input stili: soft dolgu + focus’ta outlined / border üstü yüzen label
- Arka plan: kuzey ışıkları + kayan yıldızlar (`LoginSky`)
- Logo: `frontend/public/brand/logo.png` (şeffaf arka plan; webp yedek)
- Ayı konuşma balonu: sırayla mizahi selamlar (`MascotSpeechBubble`)
- Sol alt yazı: “Önce merhaba, sonra tahsilat.”

## Backend

- **Express + TypeScript**
- ORM: **Prisma** (MySQL / Percona)
- Auth: JWT (Bearer) — gerekirse session’a geçilebilir

## Temizlik kuralı (çok önemli)

- Revize sonrası **eski / kullanılmayan kod kalıntısı bırakılmaz**
- Dead import, yorumlanmış blok, yedek dosya (`LoginOld.tsx` vb.) silinir
- “Bir süre kalsın” yok — ya kullanılır ya kaldırılır

## Veritabanı

- Dump: `docs/db/anypay-tahsilat-db.sql` (gitignore; commit edilmez)
- Şema %100 doğru kabul edilmez
- `user.password`: PHP bcrypt `$2y$…` → Node `bcryptjs` ile doğrulanır
- Dump içinde banka/POS secret’ları olabilir → repoya ve sohbete sızdırma

## Sıra

1. Docs / kurallar  
2. İskelet  
3. Login  
4. Layout → Özet → diğer sayfalar  

---

*Güncelleme: 2026-09-17*

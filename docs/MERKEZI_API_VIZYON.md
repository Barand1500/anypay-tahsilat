# Merkez API vizyonu (mala anlatır gibi)

> Bu dosya: ne yapmak istediğimizi anlatır. Teknik detay / kod yok.  
> Okuyan: sen + sonra gelecek yapay zeka.  
> Referans örnek: `panel.anypay.com.tr` (merkez) → `demo.anypay.com.tr` (müşteri).  
> Bizim merkez: `api.guzelteknoloji.com` · Bizim müşteri: AnyPay Tahsilat.

---

## Tek cümleyle ne istiyoruz?

**Ortak bilgileri bir yerde tutup, satılan her AnyPay’in “API Ayarları”ndaki bir anahtarla o yerden beslenmesini istiyoruz.**  
Bir ilçe değişince, yeni BIN gelince, banka listesi güncellenince — on beş müşteriye ayrı ayrı dokunmayacağız; merkezde bir kez değişecek.

---

## Bugün nasıl?

- Her AnyPay müşterisinin kendi veritabanı var (doğru: firma verisi ayrı kalsın).
- Ama **herkese aynı olan** şeyler de müşteri DB’sinde duruyor: BIN listesi, iller/ilçeler, banka adları…  
  → Aynı listeyi 10–15 yerde güncellemek yorucu ve hata riski yüksek.

## Yarın nasıl olacak?

İki katman:

1. **Merkez (api.guzelteknoloji)**  
   Ortak listeleri ve (ileride) ortak “ağır işleri” burada yönetiriz.  
   Panelde hem genel API araçları kalır, hem de **Tahsilat menüsü** açılır.

2. **Müşteri (AnyPay Tahsilat)**  
   Zaten çalışan sistem. API Ayarları’nda bir anahtar:  
   - **Açık** → ortak veriler merkezden gelir; yerel o kısım pasif / yedek.  
   - **Kapalı** → eski yerel sistem aynen devam eder (bozulmaz).

AnyPay’in ödeme ekranı, taksit mantığı vs. yeniden yazılmaz. Sadece “bu listeyi / bu işi nereden alıyorum?” sorusu değişir.

---

## Örnek (adamlar nasıl yapmış?)

| Yer | Rol |
|-----|-----|
| panel.anypay.com.tr | Merkez beyin: firmalar, bankalar, BIN, iller, kart tanımları… |
| demo.anypay.com.tr | Bir müşteri paneli; ortak şeyler merkezden beslenir |

Biz de aynı fikri **Güzel Teknoloji API** üzerine kuruyoruz.  
Tasarımı kopyalamayacağız; **daha güzel, kendi dilimizde** yapacağız. Menü isimleri ve iş bölümü benzer olacak.

---

## api.guzelteknoloji panelinde menü nasıl değişecek?

**Mevcut tasarım bozulmaz.** Sol altta zaten ikonlar var (`?` rehber, klasör ağacı, görünüm, ayarlar).

Yapılacak:

1. `?` ikonunun **yanına** bir **Tahsilat** ikonu ekle.
2. Ona tıklayınca sol menü **Tahsilat menüsüne** geçer.
3. Aktif kaldığı sürece o menü kalır (yenilemede de tercihen hatırlanır).
4. Aynı ikona tekrar tıklayınca **eski API menüsüne** (Genel Yönetim, İstatistikler, Şema, Anahtarlar…) döner.

Yani iki “dünya”, bir panel:

| Mod | Sol menü (özet) |
|-----|------------------|
| **API (şu anki)** | Genel Yönetim, İstatistikler, API Deneme, Şema, API Anahtarları + kategori/klasör |
| **Tahsilat (yeni)** | Özet, Firmalar, Ödeme Altyapısı, Genel Tanımlar, Kart Yönetimi, Coğrafi Veriler, Sistem |

### Tahsilat menü ağacı (ekranda görünen her madde — içleri sonradan)

- **Özet**
- **Firmalar**
- **Ödeme Altyapısı**
  - Bankalar  
  - BIN Listesi  
  - Ana Sanal Poslar  
- **Genel Tanımlar**
  - Para Birimleri  
  - Sözleşmeler  
  - Vergi Daireleri  
- **Kart Yönetimi**
  - Kart Tipleri  
  - Kart Türleri  
  - Kart Markaları  
- **Coğrafi Veriler**
  - İller  
  - İlçeler  
- **Sistem**
  - Modüller  
  - Şablon Değişkenleri  
  - E-Posta Ayarları  
  - Sürümler  

**İlk iş:** sadece sol menüyü bu yapıya benzetmek (boş / “yakında” sayfalar yeter).  
İçerikleri (tablolar, formlar, API uçları) **tek tek** sonra doldurulur.

### Yapım notu — Ödeme Altyapısı (UI)

- **Bankalar:** liste (logo, ad, kısa ad) + Yeni Banka modal (logo, 3DS/API/XML URL).
- **BIN:** Banka dropdown’ı Bankalar listesinden gelir (`banksStore`).
- **Ana Sanal Poslar:** ad, banka, aktif; değişkenler (JSON/metin); banka Bankalar’dan.
- Kart Yönetimi tamam: Tip / Tür / Marka (markada logo). BIN dropdown’ları `cardMetaStore` + `banksStore`.

---

## AnyPay tarafı (müşteri)

- API Ayarları’nda **bir anahtar** (veya bağlan / bağlanma + hangi yolların açık olduğu).
- Bağlanınca: BIN okuma, şehir combo’su vb. merkezden gelir; ilgili yerel CRUD pasifleşir.
- İstemezse kapatır → eski yerel yol.

BIN için bu köprü / anahtar fikri zaten konuşuldu ve AnyPay’e eklendi.  
Sonraki adımlar: şehirler, bankalar… aynı mantıkla genişler.

---

## “Kod çalıştırma” ne demek? (ileride)

Şimdilik hedef: **A** — ağır işi merkezde yapıp sonucu API ile döndürmek  
(ör. sanal POS / ödeme tarafında müşteri sunucusunu yormamak).  

Başka ihtiyaçlar çıkarsa sonradan eklenir.  
İlk etap menü iskeleti + ortak veri; kod çalıştırma ikinci dalga.

---

## Ne yapmıyoruz (şimdilik)

- AnyPay ödeme / taksit çekirdeğini baştan yazmak yok.
- panel.anypay’ı birebir klonlamak yok (sadece benzer iş bölümü + daha iyi tasarım).
- Tüm menü içlerini bir günde doldurmak yok — önce menü geçişi, sonra sayfa sayfa.
- `fikir.txt` (webhook, sürüm, kota…) ayrı konular; bu vizyonla karıştırma.

---

## Sıra (kaba)

1. api.guzelteknoloji: alt çubuğa Tahsilat ikonu + menü modu geçişi (kendi tasarım dili).  
2. Tahsilat sol menü ağacını koy; sayfalar boş / yer tutucu.  
3. Birer birer doldur: önce BIN + coğrafi (AnyPay’in en çok rahatladığı), sonra bankalar / kart / …  
4. AnyPay anahtarını genişlet: hangi yollar açık (BIN, şehir…).  
5. İleride: merkezde kod / POS yükü.

---

## Onaylanan kararlar (bu konuşmadan)

1. Tasarım: benzer iş, **bizim dilimiz daha güzel**.  
2. Sol menü: ekrandaki tüm Tahsilat maddeleri olsun; içler sonra. Geçiş: `?` yanı Tahsilat ikonu, toggle.  
3. Kod çalıştırma: A tipi (yükten kurtarma), sonra.  
4. AnyPay: API Ayarları anahtarı; bağlanınca seçilen yollar merkez, yereli pasif; kapatınca eski sistem.  
5. Mevcut API paneli kalır; üstüne “ikinci menü dünyası” eklenir, silinmez.

---

---

## Tahsilat public API (AnyPay bağlanır)

Base (önerilen):

`https://api.guzelteknoloji.com/v1/tahsilat`

Header: `X-API-Key: <panelden üretilen anahtar>`  
Anahtarın ilgili kategoriye (veya **Tahsilat** klasörüne) yetkisi olmalı.

| Yol | Ne |
|-----|-----|
| `GET /` veya `/health` | Kaynak listesi |
| `GET /bins` | BIN kataloğu |
| `GET /bins/lookup?bin=` | Kart öneki lookup |
| `GET /banks` | Bankalar |
| `GET /provinces` | İller |
| `GET /districts?province=` | İlçeler (filtre opsiyonel) |
| `GET /card-types` / `card-kinds` / `card-brands` | Kart meta |

AnyPay API Ayarları: kaynak **uzak** + base URL yukarıdaki + anahtar.  
Kapalıysa yerel DB aynen devam.

Geriye uyum: eski `.../v1/bins` uçları da duruyor.

Kod çalıştırma (POS yükü merkezde): **sonra** — önce ortak veri köprüsü.

*Son güncelleme: 2026-10-15 — /v1/tahsilat sözleşmesi*

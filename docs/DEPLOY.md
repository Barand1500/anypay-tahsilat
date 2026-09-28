# Deploy — sunucu notları (unutma)

> Canlı: `https://tahsilat.anypay.com.tr`  
> Repo: `https://github.com/Barand1500/anypay-tahsilat.git`  
> Script: `scripts/server-deploy.sh`

---

## 1. İki klasör — karıştırma

| Yol | Ne | Git? |
|-----|-----|------|
| `/home/anypay-tahsilat/apps/anypay-tahsilat` | **Kaynak repo** (clone, pull, build) | Evet |
| `/home/anypay-tahsilat/htdocs/tahsilat.anypay.com.tr` | **Yayın / site kökü** (nginx + process) | **Hayır** |

- `htdocs` içinde `git pull` **çalışmaz** → `fatal: not a git repository`
- `htdocs/frontend` yok — frontend kaynak kodu `apps/.../frontend` altında
- Deploy her zaman: **apps’te pull + build** → çıktıyı **htdocs’a kopyala**

---

## 2. Hızlı frontend güncelleme (şimdiki geçici yöntem)

Backend / `.env` henüz tam bağlanmadan sadece UI yenilemek için:

```bash
# Repo yoksa bir kez:
mkdir -p /home/anypay-tahsilat/apps
cd /home/anypay-tahsilat/apps
git clone https://github.com/Barand1500/anypay-tahsilat.git

# Her güncellemede:
cd /home/anypay-tahsilat/apps/anypay-tahsilat
git pull
cd frontend && npm ci && npm run build

# dist → site (geçici: kök veya public — CloudPanel vhost’a bak)
rsync -a --delete dist/ /home/anypay-tahsilat/htdocs/tahsilat.anypay.com.tr/
# Tam script public/ kullanır: bkz. bölüm 3
```

Tarayıcı: **Ctrl+Shift+R**

---

## 3. Tam deploy (backend hazır olunca)

```bash
bash /home/anypay-tahsilat/apps/anypay-tahsilat/scripts/server-deploy.sh
```

Script varsayılanları:

- `REPO_DIR` = `/home/anypay-tahsilat/apps/anypay-tahsilat`
- `SITE_DIR` = `/home/anypay-tahsilat/htdocs/tahsilat.anypay.com.tr`
- `PORT` = `3012` (CloudPanel Node port; health: `http://127.0.0.1:$PORT/api/health`)
- `PM2_NAME` = `anypay-tahsilat`
- Frontend → `$SITE_DIR/public/` (`.env` silinmez)
- Backend → `$SITE_DIR/dist/` + prisma + site `package.json`
- Restart: `pm2 restart anypay-tahsilat`

Sonraki güncellemeler (tek komut):

```bash
bash /home/anypay-tahsilat/apps/anypay-tahsilat/scripts/server-deploy.sh
```

---

## 4. CloudPanel / nginx (öğrenilenler)

- Site user: `anypay-tahsilat`
- Node reverse proxy app_port genelde **3012** veya script’teki **3010** — vhost / CloudPanel ayarına bak; boş port = **502**
- Proxy varken sadece `htdocs`’a dosya koymak yetmez; **process dinlemiyorsa** 502 olur
- Geçici: `npx serve -s … -l 3012` veya PM2 ile static SPA
- Kalıcı hedef: Express backend aynı portta (`/api` + static)

---

## 5. Auth / API

- Demo login bypass **kaldırıldı** — yalnızca gerçek JWT (`/api/auth/login`, OTP, şifremi unuttum).
- API yokken veya HTML dönerse `ApiUnavailableError` (`frontend/src/lib/api.ts`).
- Backend port: CloudPanel genelde **3012**; lokal default **3010** — vhost ile eşleştir.
- Sağlık: `GET /api/health`
- Kasa değer şifreleme: `VAULT_ENC_KEY` (yoksa `JWT_SECRET`) — production’da ayrı uzun bir secret koy; değiştirince eski kayıtlar çözülemez.
- Profil foto: `uploads/` altında; site kökünde `uploads` yazılabilir olmalı.

---

## 6. Commit / push alışkanlığı

- `fikir.txt` commit edilmez
- `.env` ve `docs/db/*.sql` commit edilmez
- Canlıya almak için: lokal commit + `git push` → sunucuda `apps` içinde `git pull` + build

---

## 7. Kontrol listesi (sorun çıkınca)

1. `ls /home/anypay-tahsilat/apps/anypay-tahsilat/.git` — repo var mı?
2. `git -C … log -1 --oneline` — son commit push’taki ile aynı mı?
3. `ss -tlnp | grep 301` — hangi port dinliyor?
4. `curl -sI http://127.0.0.1:PORT/` — process ayakta mı?
5. `curl -s http://127.0.0.1:PORT/api/health` — JSON `ok` mi?
6. Hard refresh (eski JS cache)

---

*Güncelleme: 2026-09-28 — demo bypass yok; health + deploy akışı*

#!/usr/bin/env bash
# =============================================================================
# AnyPay Tahsilat — Sunucu deploy (git pull + build + restart)
#
#   /home/anypay-tahsilat/apps/anypay-tahsilat/scripts/server-deploy.sh
# =============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/anypay-tahsilat/apps/anypay-tahsilat}"
SITE_DIR="${SITE_DIR:-/home/anypay-tahsilat/htdocs/tahsilat.anypay.com.tr}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3010}"
TOTAL_STEPS=7

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_CYAN=$'\033[36m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_MAGENTA=$'\033[35m'
else
  C_RESET='' C_DIM='' C_BOLD='' C_CYAN='' C_GREEN='' C_YELLOW='' C_RED='' C_MAGENTA=''
fi

STEP=0
STARTED_AT=$(date +%s)

banner() {
  printf '\n'
  printf '%s╔══════════════════════════════════════════════════════╗%s\n' "$C_CYAN" "$C_RESET"
  printf '%s║%s  %sANYPAY TAHSILAT DEPLOY%s                              %s║%s\n' "$C_CYAN" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_CYAN" "$C_RESET"
  printf '%s║%s  %s%-50s%s%s║%s\n' "$C_CYAN" "$C_RESET" "$C_DIM" "$(date '+%Y-%m-%d %H:%M:%S')" "$C_RESET" "$C_CYAN" "$C_RESET"
  printf '%s╚══════════════════════════════════════════════════════╝%s\n' "$C_CYAN" "$C_RESET"
}

step() {
  STEP=$((STEP + 1))
  local title="$1"
  printf '\n%s[%s/%s]%s %s%s%s\n' "$C_MAGENTA" "$STEP" "$TOTAL_STEPS" "$C_RESET" "$C_BOLD" "$title" "$C_RESET"
}

info()  { printf '  %s•%s %s\n' "$C_DIM" "$C_RESET" "$*"; }
ok()    { printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn()  { printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()   { printf '\n%s✗ HATA:%s %s\n\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

elapsed() {
  local now
  now=$(date +%s)
  echo $((now - STARTED_AT))
}

banner

[[ -d "$REPO_DIR/.git" ]] || die "Repo yok: $REPO_DIR — önce git clone yap."
[[ -d "$SITE_DIR" ]] || die "Site klasörü yok: $SITE_DIR"
[[ -f "$SITE_DIR/.env" ]] || die "Site .env yok: $SITE_DIR/.env"

info "Repo : $REPO_DIR"
info "Site : $SITE_DIR"
info "Dal  : $BRANCH"
info "Port : $PORT"

# ---------------------------------------------------------------------------
step "Git güncellemesi"
cd "$REPO_DIR"

BEFORE=$(git rev-parse HEAD)
BEFORE_SHORT=$(git rev-parse --short HEAD)
info "Şu an: $BEFORE_SHORT — $(git log -1 --pretty=format:'%s')"

git fetch origin --quiet
git checkout "$BRANCH" --quiet
git reset --hard "origin/$BRANCH" --quiet
git clean -fd --quiet \
  -e node_modules \
  -e frontend/node_modules \
  -e backend/node_modules \
  -e frontend/dist \
  -e backend/dist \
  2>/dev/null || true

AFTER=$(git rev-parse HEAD)
AFTER_SHORT=$(git rev-parse --short HEAD)

if [[ "$BEFORE" == "$AFTER" ]]; then
  ok "Zaten güncel ($AFTER_SHORT) — yeni commit yok"
else
  COUNT=$(git rev-list --count "${BEFORE}..${AFTER}" 2>/dev/null || echo "?")
  ok "$COUNT commit çekildi: $BEFORE_SHORT → $AFTER_SHORT"
  printf '\n  %sGelen değişiklikler:%s\n' "$C_CYAN" "$C_RESET"
  git log --pretty=format:'  %C(yellow)%h%Creset  %s  %C(dim)(%an)%Creset' "${BEFORE}..${AFTER}" 2>/dev/null || true
  printf '\n'
fi

# ---------------------------------------------------------------------------
step "Bağımlılıklar (kaynak repo)"
info "frontend + backend npm install..."
npm install --prefix frontend --no-fund --no-audit --silent
npm install --prefix backend --no-fund --no-audit --silent
ok "Bağımlılıklar hazır"

# ---------------------------------------------------------------------------
step "Frontend build"
npm run build --prefix frontend
ok "frontend/dist hazır"

# ---------------------------------------------------------------------------
step "Backend build"
npm run build --prefix backend
ok "backend/dist hazır"
[[ -d frontend/dist && -d backend/dist ]] || die "Build çıktısı eksik"

# ---------------------------------------------------------------------------
step "Canlı siteye kopyala (.env / uploads korunur)"
TOUCH_TEST="$SITE_DIR/.deploy-write-test"
if ! touch "$TOUCH_TEST" 2>/dev/null; then
  die "Site klasörüne yazılamıyor ($SITE_DIR). İzin için: chown -R \$(whoami) $SITE_DIR"
fi
rm -f "$TOUCH_TEST"

rm -rf "$SITE_DIR/public"
mkdir -p "$SITE_DIR/public"
cp -a frontend/dist/. "$SITE_DIR/public/"
ok "public/ güncellendi"

rm -rf "$SITE_DIR/dist"
mkdir -p "$SITE_DIR/dist"
cp -a backend/dist/. "$SITE_DIR/dist/"
ok "dist/ güncellendi"

rm -rf "$SITE_DIR/prisma"
mkdir -p "$SITE_DIR/prisma"
cp -a backend/prisma/. "$SITE_DIR/prisma/"
ok "prisma/ güncellendi"

REPO_DIR="$REPO_DIR" SITE_DIR="$SITE_DIR" node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const repo = process.env.REPO_DIR;
const site = process.env.SITE_DIR;
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'backend/package.json'), 'utf8'));
const out = {
  name: 'anypay-tahsilat-server',
  version: pkg.version,
  private: true,
  type: 'module',
  scripts: {
    start: 'node dist/index.js',
    'db:generate': 'prisma generate',
    'db:push': 'prisma generate',
    setup: 'prisma generate',
  },
  dependencies: { ...pkg.dependencies },
  prisma: { schema: 'prisma/schema.prisma' },
};
fs.writeFileSync(path.join(site, 'package.json'), JSON.stringify(out, null, 2) + '\n');
NODE
ok "package.json yazıldı"
mkdir -p "$SITE_DIR/uploads"

if [[ -f "$SITE_DIR/package-lock.json" ]]; then
  if rm -f "$SITE_DIR/package-lock.json" 2>/dev/null; then
    info "Eski package-lock.json kaldırıldı"
  else
    warn "package-lock.json silinemedi — --no-package-lock ile devam"
  fi
fi

# ---------------------------------------------------------------------------
step "Site npm install + prisma generate"
cd "$SITE_DIR"
npm install --omit=dev --no-fund --no-audit --no-package-lock
ok "Production bağımlılıkları kuruldu"
# Mevcut DB'ye kör push yapmıyoruz — sadece client generate
npx prisma generate
ok "Prisma client hazır"

# ---------------------------------------------------------------------------
step "Servisi yeniden başlat (port $PORT)"
fuser -k "${PORT}/tcp" 2>/dev/null || true
if command -v lsof >/dev/null 2>&1; then
  # shellcheck disable=SC2046
  kill $(lsof -t -i:"$PORT") 2>/dev/null || true
fi
sleep 2
nohup npm start >> logs-start.log 2>&1 &
sleep 3

if HEALTH=$(curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null); then
  ok "Health: $HEALTH"
else
  die "Health check başarısız — $SITE_DIR/logs-start.log dosyasına bak"
fi

SEC=$(elapsed)
printf '\n%s╔══════════════════════════════════════════════════════╗%s\n' "$C_GREEN" "$C_RESET"
printf '%s║%s  %sDEPLOY TAMAM%s  (%ss)                                %s║%s\n' "$C_GREEN" "$C_RESET" "$C_BOLD" "$C_RESET" "$SEC" "$C_GREEN" "$C_RESET"
printf '%s║%s  Commit: %-42s%s║%s\n' "$C_GREEN" "$C_RESET" "$AFTER_SHORT" "$C_GREEN" "$C_RESET"
printf '%s║%s  Tarayıcıda Ctrl+F5 yap.                            %s║%s\n' "$C_GREEN" "$C_RESET" "$C_GREEN" "$C_RESET"
printf '%s╚══════════════════════════════════════════════════════╝%s\n\n' "$C_GREEN" "$C_RESET"

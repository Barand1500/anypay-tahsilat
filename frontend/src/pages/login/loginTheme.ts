/** Giriş ekranı teması + dünya şeridi yazıları — şimdilik localStorage */

export type LoginTheme = 'classic' | 'globe';

export type LoginBrandWords = {
  word1: string;
  word2: string;
};

const THEME_KEY = 'anypay_tahsilat_login_theme';
const BRAND_KEY = 'anypay_tahsilat_login_brand_words';

export const DEFAULT_BRAND_WORDS: LoginBrandWords = {
  word1: 'GÜZEL',
  word2: 'TEKNOLOJİ',
};

export function getLoginTheme(): LoginTheme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'globe' || v === 'classic') return v;
  } catch {
    /* ignore */
  }
  return 'classic';
}

export function setLoginTheme(theme: LoginTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('anypay:login-theme', { detail: theme }));
}

function clipWord(raw: string): string {
  return raw.replace(/\s+/g, ' ').trimStart().slice(0, 16);
}

export function getLoginBrandWords(): LoginBrandWords {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LoginBrandWords>;
      const w1 = String(parsed.word1 ?? '').trim().slice(0, 16);
      const w2 = String(parsed.word2 ?? '').trim().slice(0, 16);
      return {
        word1: w1 || DEFAULT_BRAND_WORDS.word1,
        word2: w2 || DEFAULT_BRAND_WORDS.word2,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_BRAND_WORDS };
}

/** Ham değeri saklar; boşsa okurken varsayılana düşülür */
export function setLoginBrandWords(words: LoginBrandWords) {
  const next: LoginBrandWords = {
    word1: clipWord(words.word1).trimEnd(),
    word2: clipWord(words.word2).trimEnd(),
  };
  try {
    localStorage.setItem(BRAND_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent('anypay:login-brand-words', {
      detail: {
        word1: next.word1 || DEFAULT_BRAND_WORDS.word1,
        word2: next.word2 || DEFAULT_BRAND_WORDS.word2,
      },
    }),
  );
}

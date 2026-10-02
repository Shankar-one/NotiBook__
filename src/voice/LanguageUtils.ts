export type UserLanguage = 'english' | 'hindi' | 'hinglish';
export type PreferredLanguage = 'english' | 'auto' | 'hinglish' | 'hindi';

export function getStoredLanguagePreference(): PreferredLanguage {
  return 'english';
}

export function setStoredLanguagePreference(_pref: PreferredLanguage): void {
  // Phase 1: English-only mode. Kept modular for future multilingual expansion.
}

/**
 * Phase 1: English-only mode.
 * Kept modular so language detection can be plugged in later without changing callers.
 */
export function detectLanguage(_text?: string, _preferredLang?: PreferredLanguage): UserLanguage {
  return 'english';
}

export function formatLocalizedResponse(
  _lang: UserLanguage,
  templates: {
    hindi?: string;
    hinglish?: string;
    english: string;
  }
): string {
  return templates.english;
}

export function getWakeGreetingText(_lang?: UserLanguage): string {
  return 'Yes, I am listening.';
}

export function toDevanagariForHindiTTS(text: string): string {
  return prepareEnglishForTTS(text);
}

export function prepareEnglishForTTS(text: string): string {
  if (!text) return '';
  let processed = text;

  processed = processed.replace(/₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/g, (_, num) => {
    return `${String(num).replace(/,/g, '')} rupees`;
  });

  processed = processed.replace(/#INV-(\d+)/gi, 'Invoice $1');
  processed = processed.replace(/["'`]/g, '');
  return processed.replace(/\s+/g, ' ').trim();
}

export const LocalizedClarifications = {
  whichCustomer: (_lang?: UserLanguage) => 'Which customer are you referring to?',
  howMuchAmount: (_lang?: UserLanguage) => 'What is the transaction amount?',
  creditOrDebit: (_lang?: UserLanguage) =>
    'Is this a receivable (money owed to you) or a payable (money you owe)?',
  customerNotFound: (name: string, _lang?: UserLanguage) =>
    `Could not find any customer named "${name}".`,
  genericError: (details: string, _lang?: UserLanguage) =>
    `Sorry, this action could not be completed: ${details}`,
};

export function cleanPartyOrCustomerName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/^(?:mr\.?|mrs\.?|ms\.?|customer|named|called)\s+/i, '')
    .replace(/(?:'s|\s+account|\s+ledger)$/i, '')
    .trim();
}

const ENGLISH_NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Parses explicit numeric or spoken English financial amounts (e.g., "1000", "a thousand", "another thousand",
 * "2.5 thousand", "five hundred", "750", "1500") without ever mistaking indefinite articles ("a", "one") for ₹1.
 */
export function parseSpokenIndianAmount(rawText: string): number | null {
  if (!rawText || !rawText.trim()) return null;
  const lower = rawText.toLowerCase().trim();

  // 1. Self-repair / modification ("actually make that 1500", "change it to 1500", "make it 1500")
  const correctionMatch = lower.match(
    /(?:actually\s+make\s+that|make\s+that|make\s+it|change\s+(?:it|that|the\s+amount)\s+to|update\s+(?:it|that)\s+to)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i
  );
  if (correctionMatch && correctionMatch[1]) {
    const val = parseFloat(correctionMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. "a thousand" / "another thousand" / "one thousand" / "a hundred" / "one hundred"
  if (/\b(?:a|an|one|another)\s+thousand\b/i.test(lower)) {
    const extraMatch = lower.match(/\b(?:a|an|one|another)\s+thousand\s+(?:and\s+)?(\d+)/i);
    if (extraMatch && extraMatch[1]) {
      return 1000 + parseFloat(extraMatch[1]);
    }
    return 1000;
  }
  if (/\b(?:a|an|one|another)\s+hundred\b/i.test(lower)) {
    return 100;
  }
  if (/\bhalf\s+a\s+thousand\b/i.test(lower)) {
    return 500;
  }

  // 3. Numeric with multiplier: "2.5 thousand", "5 hundred", "1.5k"
  const numMultMatch = lower.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(thousand|hundred|lakh|k)\b/i);
  if (numMultMatch) {
    const base = parseFloat(numMultMatch[1].replace(/,/g, ''));
    const unit = numMultMatch[2].toLowerCase();
    if (!isNaN(base) && base > 0) {
      if (unit === 'thousand' || unit === 'k') return Math.round(base * 1000);
      if (unit === 'hundred') return Math.round(base * 100);
      if (unit === 'lakh') return Math.round(base * 100000);
    }
  }

  // 4. Spoken English word multiplier: "five hundred", "two thousand", "fifteen hundred"
  const wordMultMatch = lower.match(
    /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty)\s+(thousand|hundred)\b/i
  );
  if (wordMultMatch) {
    const base = ENGLISH_NUMBER_WORDS[wordMultMatch[1].toLowerCase()];
    const mult = wordMultMatch[2].toLowerCase() === 'thousand' ? 1000 : 100;
    if (base) return base * mult;
  }

  // 5. Explicit digits (ignoring 10-digit phone numbers)
  const digitMatches = Array.from(
    lower.matchAll(/(?:₹|rs\.?|inr|\$)?\s*(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees|dollars)?/gi)
  );
  for (const m of digitMatches) {
    const rawNum = m[1].replace(/,/g, '');
    if (rawNum.length >= 10) continue;
    const parsed = parseFloat(rawNum);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export function isConfirmationUtterance(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ');
  const exactConfirmations = new Set([
    'yes',
    'yep',
    'yeah',
    'sure',
    'confirm',
    'confirmed',
    'save',
    'save it',
    'yes save it',
    'yes please',
    'yes confirm',
    'do it',
    'proceed',
    'ok save',
    'okay save',
    'go ahead',
    'confirm and save',
    'approve',
    'correct',
    'that is correct',
    'right',
  ]);
  return exactConfirmations.has(clean);
}

export function isCancellationUtterance(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ');
  const exactCancellations = new Set([
    'no',
    'nope',
    'cancel',
    'cancel it',
    'cancel that',
    'stop',
    'abort',
    'dont save',
    "don't save",
    'never mind',
    'discard',
    'no cancel',
    'do not save',
  ]);
  return exactCancellations.has(clean);
}

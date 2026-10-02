export type UserLanguage = 'hindi' | 'hinglish' | 'english';
export type PreferredLanguage = 'auto' | 'english' | 'hinglish' | 'hindi';

const LANGUAGE_STORAGE_KEY = 'notibook_preferred_language';

export function getStoredLanguagePreference(): PreferredLanguage {
  if (typeof window === 'undefined') return 'auto';
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'english' || stored === 'hinglish' || stored === 'hindi' || stored === 'auto') {
    return stored;
  }
  return 'auto';
}

export function setStoredLanguagePreference(pref: PreferredLanguage): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, pref);
}

/**
 * Continuously detects whether the user is speaking Hindi (Devanagari),
 * Hinglish (Hindi phrasing written in Roman script), or English.
 * If user has set an explicit language preference (other than 'auto'), that preference is respected.
 */
export function detectLanguage(text: string, preferredLang?: PreferredLanguage): UserLanguage {
  if (!text) {
    if (preferredLang && preferredLang !== 'auto') {
      return preferredLang;
    }
    const stored = getStoredLanguagePreference();
    return stored !== 'auto' ? stored : 'hinglish';
  }

  // If explicit preference is set and user typed/spoke in that context
  const activePref = preferredLang || getStoredLanguagePreference();

  // 1. Check for Devanagari script (Unicode range \u0900-\u097F)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hindi';
  }

  // If user explicitly chose English, check if text has strong Hindi marker; if not, stick to English
  if (activePref === 'english') {
    // Only switch to hinglish if strong unambiguous Hindi words appear
    const strongHindiMarker = /\b(karo|karke|batao|diya|diye|kijiye|hoga|raha|rahi|mera|meri|uska|aap|hum|kya|kyun|kaise|udhar|jama|rupaye|khata|hisab|dhanyawad)\b/i.test(text);
    if (!strongHindiMarker) {
      return 'english';
    }
  }

  // If user explicitly chose Hindi (Romanized input)
  if (activePref === 'hindi') {
    return 'hindi';
  }

  // If user explicitly chose Hinglish
  if (activePref === 'hinglish') {
    // If it's pure English command without any Hindi markers, still respect Hinglish style
    return 'hinglish';
  }

  const lower = text.toLowerCase();

  // 2. Check for unambiguous Hinglish vocabulary, colloquial markers, and verbs
  const unambiguousHinglishWords = [
    'karo', 'karke', 'banao', 'batao', 'bataiye',
    'diya', 'diye', 'liya', 'liye', 'kijiye',
    'hoga', 'hogi', 'honge', 'raha', 'rahi', 'rahe',
    'mera', 'meri', 'mere', 'tera', 'teri', 'tere', 'uska', 'uski', 'uske', 'usmein', 'usme',
    'isme', 'ismein', 'iska', 'iski', 'unka', 'unki', 'unhe', 'unko', 'kiska', 'kiski',
    'aap', 'tum', 'hum', 'woh', 'yeh', 'mujhe', 'humko',
    'kitna', 'kitne', 'kitni', 'kaun', 'kya', 'kyun', 'kaisa', 'kaisi', 'kaise', 'kahan',
    'kholo', 'dikhao', 'dikhaye', 'dekho', 'bhejo', 'hatao', 'jodo',
    'udhar', 'jama', 'rupaye', 'rupees', 'paisa', 'paise', 'kharcha', 'kharch', 'bikri', 'munafa',
    'baki', 'dhanyawad', 'shukriya', 'namaste', 'bhai', 'bhaiya', 'khatabook', 'khata', 'hisab',
    'dalo', 'likho', 'chahiye', 'sun', 'suno'
  ];

  const words = lower.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const hasUnambiguousHinglish = words.some(w => unambiguousHinglishWords.includes(w));

  // Hinglish phrases with ambiguous short words like "do" (give) or "me" (in)
  const hasHinglishPhrases = /\b(kar\s+do|de\s+do|bata\s+do|hata\s+do|bhej\s+do|market\s+me|khata\s+me|dukan\s+me|us\s+me|is\s+me|ka\s+balance|ki\s+last|hai\s+ya|hai\s+kya|main\s+sun|sun\s+raha)\b/i.test(lower);

  if (hasUnambiguousHinglish || hasHinglishPhrases) {
    return 'hinglish';
  }

  // 3. Otherwise treat as English
  return 'english';
}

export function formatLocalizedResponse(
  lang: UserLanguage,
  templates: {
    hindi: string;
    hinglish: string;
    english: string;
  }
): string {
  if (lang === 'hindi') return templates.hindi;
  if (lang === 'english') return templates.english;
  return templates.hinglish;
}

/**
 * Wake response text matching the voice language
 */
export function getWakeGreetingText(lang: UserLanguage): string {
  if (lang === 'hindi') {
    return 'हाँ, मैं सुन रहा हूँ।';
  }
  if (lang === 'english') {
    return 'Yes, I am listening.';
  }
  return 'Main sun raha hu.';
}

/**
 * Common clarification questions adhering strictly to user language
 */
export const LocalizedClarifications = {
  whichCustomer: (lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: 'आप किस कस्टमर की बात कर रहे हैं?',
      hinglish: 'Aap kis customer ki baat kar rahe hain?',
      english: 'Which customer are you referring to?',
    }),
  howMuchAmount: (lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: 'कितनी राशि जोड़नी है?',
      hinglish: 'Kitni amount add karni hai?',
      english: 'What is the amount?',
    }),
  creditOrDebit: (lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: 'पैसे जमा (क्रेडिट) हुए हैं या उधार (डेबिट) दिए हैं?',
      hinglish: 'Paisa jama (credit) hua hai ya udhar (debit) diya hai?',
      english: 'Is this payment received (credit) or given on credit (debit)?',
    }),
  customerNotFound: (name: string, lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: `माफ़ कीजिए, "${name}" नाम का कोई कस्टमर नहीं मिला।`,
      hinglish: `Sorry, "${name}" naam ka koi customer nahi mila.`,
      english: `Sorry, could not find any customer named "${name}".`,
    }),
  genericError: (details: string, lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: `माफ़ कीजिए, यह कार्य पूरा नहीं हो सका: ${details}`,
      hinglish: `Sorry, ye kaam complete nahi ho paya: ${details}`,
      english: `Sorry, this action could not be completed: ${details}`,
    }),
};

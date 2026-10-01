export type UserLanguage = 'hindi' | 'hinglish' | 'english';

/**
 * Continuously detects whether the user is speaking Hindi (Devanagari),
 * Hinglish (Hindi/Urdu phrasing written in Roman script), or English.
 */
export function detectLanguage(text: string): UserLanguage {
  if (!text) return 'hinglish';

  // 1. Check for Devanagari script (Unicode range \u0900-\u097F)
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hindi';
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
    'dalo', 'likho', 'chahiye'
  ];

  const words = lower.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const hasUnambiguousHinglish = words.some(w => unambiguousHinglishWords.includes(w));

  // Hinglish phrases with ambiguous short words like "do" (give) or "me" (in)
  const hasHinglishPhrases = /\b(kar\s+do|de\s+do|bata\s+do|hata\s+do|bhej\s+do|market\s+me|khata\s+me|dukan\s+me|us\s+me|is\s+me|ka\s+balance|ki\s+last|hai\s+ya|hai\s+kya)\b/i.test(lower);

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


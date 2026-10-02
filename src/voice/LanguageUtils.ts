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
 * Hinglish (Hindi grammar/phrasing in Roman script), or English.
 * Evaluates dynamically per turn without locking the conversation.
 */
export function detectLanguage(text: string, _legacyPref?: PreferredLanguage): UserLanguage {
  if (!text || !text.trim()) {
    return 'hinglish';
  }

  const raw = text.trim();

  // 1. Check for Devanagari script (Unicode range \u0900-\u097F)
  if (/[\u0900-\u097F]/.test(raw)) {
    return 'hindi';
  }

  const lower = raw.toLowerCase();

  // 2. Strong English grammatical syntax indicators
  // Phrases with clear English syntax structure
  const hasEnglishSyntax = 
    /^(?:create|add|show|check|open|get|find|who|what|how|where|when|list|delete|remove|update|set|mark|is|are|can|please)\b/i.test(lower) ||
    /\b(?:create\s+a\s+customer|add\s+a\s+customer|as\s+a\s+customer|as\s+customer|and\s+add|and\s+put|as\s+due|as\s+udhar|as\s+outstanding|show\s+me|tell\s+me|his\s+last|her\s+last|their\s+last|last\s+payment|last\s+transaction|how\s+much|who\s+owes|payment\s+received\s+from|received\s+from|what\s+is|what's|how\s+many|pending\s+dues|open\s+the|open\s+ledger|added\s+as)\b/i.test(lower);

  // 3. Strong Hindi/Hinglish grammatical particles & verb inflections
  // These indicate Hindi grammar regardless of loanwords
  const strongHindiGrammar = 
    /\b(?:karo|karke|banao|batao|bataiye|diya|diye|liya|liye|kijiye|hoga|hogi|honge|raha|rahi|rahe|hoon|hai|hain|tha|thi|the)\b/i.test(lower) ||
    /\b(?:uska|uski|uske|usmein|usme|usne|unka|unki|unke|unhe|unko|unhone|iska|iski|iske|isme|ismein|isne)\b/i.test(lower) ||
    /\b(?:mera|meri|mere|tera|teri|tere|apna|apni|apne|humara|humari|humare)\b/i.test(lower) ||
    /\b(?:kitna|kitne|kitni|kaun|kya|kyun|kaisa|kaisi|kaise|kahan|kab|kisko|kisne)\b/i.test(lower) ||
    /\b(?:bana\s+do|likh\s+do|kar\s+do|de\s+do|bata\s+do|hata\s+do|khol\s+do|khol\s+raha|de\s+diye|aa\s+chuka|aa\s+gaya|mil\s+gaya|jama\s+karo|udhar\s+likho|hisaab\s+batao|baaki\s+hai|baki\s+hai)\b/i.test(lower) ||
    /\b(?:ko\s+customer|ko\s+add|ka\s+balance|ki\s+payment|ke\s+khate|khate\s+mein|se\s+minus)\b/i.test(lower);

  // If sentence has explicit Hindi grammar and verb markers, it is Hinglish
  if (strongHindiGrammar && !hasEnglishSyntax) {
    return 'hinglish';
  }

  // If sentence has clear English structure and syntax (e.g. "create a customer Ram and add Rs 1000 as Udhar")
  if (hasEnglishSyntax) {
    // Only treat as Hinglish if it ends with Hindi verbs like "karo", "batao", "hai"
    const endsWithHindiVerb = /\b(?:karo|banao|batao|diya|diye|kijiye|hai|hoon|khol\s+do)$/i.test(lower);
    if (!endsWithHindiVerb) {
      return 'english';
    }
  }

  // Check general vocabulary ratio if still undecided
  const englishGrammarWords = new Set([
    'the', 'is', 'are', 'was', 'were', 'and', 'or', 'to', 'for', 'with', 'from',
    'create', 'add', 'customer', 'due', 'amount', 'show', 'me', 'his', 'her', 'their',
    'last', 'payment', 'balance', 'open', 'bill', 'invoice', 'report', 'today', 'yesterday'
  ]);
  const hinglishWords = new Set([
    'ko', 'ka', 'ki', 'ke', 'se', 'ne', 'mein', 'me', 'pe', 'par',
    'karo', 'banao', 'batao', 'likho', 'diya', 'diye', 'mila', 'mile',
    'hai', 'hain', 'tha', 'thi', 'the', 'aur', 'phir', 'ab',
    'uska', 'usme', 'usne', 'iska', 'isme', 'isne', 'kitna', 'kitne',
    'udhar', 'jama', 'rupaye', 'khata', 'hisab', 'baaki'
  ]);

  const tokens = lower.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  let englishCount = 0;
  let hinglishCount = 0;

  for (const t of tokens) {
    if (englishGrammarWords.has(t)) englishCount++;
    if (hinglishWords.has(t)) hinglishCount++;
  }

  if (englishCount > hinglishCount) {
    return 'english';
  }
  if (hinglishCount > 0) {
    return 'hinglish';
  }

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

/**
 * Sanitizes and cleans customer or party names from conversational utterances or voice transcripts.
 */
export function cleanPartyOrCustomerName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/^(?:अरे|जार्विस|भाई|सुनो|please|hey\s+jarvis|customer|grahak|naya|new|mr\.?|shri|mrs\.?)\s+/i, '');
  cleaned = cleaned.replace(/\s+(?:ke\s+khate\s+me|ke\s+account\s+me|ka\s+khata|ke\s+khate|ke|ki|ka|ko|se|pe|ji|bhai|bhaiya|saheb)$/i, '');
  cleaned = cleaned.replace(/\s+(?:के\s+खाते\s+में|के\s+खाते|के\s+अकाउंट\s+में|का\s+खाता|के|की|का|को|से|पे|पर|जी|भाई|साहब)$/i, '');
  return cleaned.trim();
}


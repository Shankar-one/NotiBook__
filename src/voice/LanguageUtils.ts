export type UserLanguage = 'hindi' | 'hinglish' | 'english';
export type PreferredLanguage = 'auto' | 'english' | 'hinglish' | 'hindi';

const LANGUAGE_STORAGE_KEY = 'notibook_voice_language_mode';

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

// Unambiguous Hindi words written in Roman script (excludes English words like "me", "do", "to", "in", "is", "the", "he")
const UNAMBIGUOUS_ROMAN_HINDI_WORDS = new Set([
  'ka', 'ki', 'ke', 'ko', 'se', 'ne', 'mein', 'par', 'pe',
  'karo', 'karke', 'karein', 'kijiye', 'karna', 'karni', 'karne',
  'banao', 'banaen', 'banaye', 'banayein', 'banaiye', 'banana',
  'batao', 'bataiye', 'batayein', 'bataye', 'batana',
  'diya', 'diye', 'liya', 'liye', 'dena', 'lena',
  'hoga', 'hogi', 'honge', 'raha', 'rahi', 'rahe',
  'hai', 'hain', 'tha', 'thi', 'theek', 'thik', 'haan', 'nahi', 'naa',
  'mera', 'meri', 'mere', 'tera', 'teri', 'tere',
  'uska', 'uski', 'uske', 'usmein', 'usme', 'usse',
  'isme', 'ismein', 'iska', 'iski', 'iske',
  'unka', 'unki', 'unke', 'unhe', 'unko', 'unse', 'unhone', 'usne',
  'kiska', 'kiski', 'kiske', 'kisko', 'kisne',
  'aap', 'tum', 'hum', 'woh', 'yeh', 'mujhe', 'humko',
  'kitna', 'kitne', 'kitni', 'kaun', 'kya', 'kyun', 'kaisa', 'kaisi', 'kaise', 'kahan',
  'kholo', 'kholiye', 'kholein', 'dikhao', 'dikhaye', 'dikhaiye', 'dekho',
  'bhejo', 'hatao', 'jodo', 'jodein', 'jodiye',
  'udhar', 'udhari', 'jama', 'rupaye', 'rupaya', 'paisa', 'paise',
  'kharcha', 'kharch', 'bikri', 'munafa', 'baki', 'baaki', 'bakaya',
  'dhanyawad', 'shukriya', 'namaste', 'bhai', 'bhaiya', 'grahak',
  'khatabook', 'khata', 'khate', 'hisab', 'hisaab',
  'dalo', 'daalo', 'likho', 'likhein', 'likhiye', 'chahiye',
  'sun', 'suno', 'naya', 'naye', 'nayi', 'samaan', 'saman',
  'becha', 'kharida', 'mila', 'mile', 'gaya', 'gaye', 'gayi',
  'aur', 'ya', 'bas', 'alvida', 'aaj', 'kal', 'abhi', 'pehle',
  'badhao', 'ghatao', 'kam'
]);

const ROMAN_HINDI_PHRASES = /\b(kar\s+do|de\s+do|bata\s+do|bana\s+do|hata\s+do|bhej\s+do|likh\s+do|jod\s+do|khol\s+do|dikha\s+do|daal\s+do|market\s+me|khata\s+me|khate\s+me|account\s+me|dukan\s+me|list\s+me|us\s+me|is\s+me|ka\s+balance|ke\s+account|ke\s+khate|naam\s+se|naam\s+ka|main\s+sun|sun\s+raha|aa\s+gaya|mil\s+gaya|minus\s+karo|add\s+karo)\b/i;

const ENGLISH_GRAMMAR_START = /^(?:what|who|where|when|how|why|show|open|create|add|delete|remove|cancel|give|tell|check|view|list|take|go|can|could|please|is|are|do|does|did|record|update|set|thank|thanks|yes|no|stop|exit|close|bye|hello|hi)\b/i;

/**
 * Automatically detects whether the user is speaking/typing in Hindi or English.
 * - Any Devanagari script OR Hindi words/grammar in Roman script -> 'hindi'
 * - Pure English utterances -> 'english'
 */
export function detectLanguage(text: string, preferredLang?: PreferredLanguage): UserLanguage {
  const activePref = preferredLang || getStoredLanguagePreference();

  if (!text || !text.trim()) {
    if (activePref === 'english') return 'english';
    if (activePref === 'hindi' || activePref === 'hinglish') return 'hindi';
    return 'english';
  }

  const trimmed = text.trim();

  // 1. Check for Devanagari script (Unicode range \u0900-\u097F) -> Always Hindi
  if (/[\u0900-\u097F]/.test(trimmed)) {
    return 'hindi';
  }

  const lower = trimmed.toLowerCase();
  const words = lower.split(/[^a-zA-Z0-9]+/).filter(Boolean);

  // 2. Count unambiguous Roman-Hindi words & phrase patterns
  const hindiWordMatches = words.filter((w) => UNAMBIGUOUS_ROMAN_HINDI_WORDS.has(w));
  const hasHindiPhrase = ROMAN_HINDI_PHRASES.test(lower);

  // Check if it's an English sentence that only borrowed a single domain noun like "udhar" or "khata"
  // e.g. "What is total market udhar?" or "Create a customer Ram and add Rs 1000 as Udhar"
  if (
    ENGLISH_GRAMMAR_START.test(lower) &&
    !hasHindiPhrase &&
    hindiWordMatches.every((w) => w === 'udhar' || w === 'udhari' || w === 'khata' || w === 'jama')
  ) {
    return 'english';
  }

  if (hindiWordMatches.length > 0 || hasHindiPhrase) {
    return activePref === 'hinglish' ? 'hinglish' : 'hindi';
  }

  // 3. No Hindi markers found -> Pure English utterance
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
  if (lang === 'english') return templates.english;
  if (lang === 'hinglish') return templates.hinglish;
  return templates.hindi;
}

/**
 * Wake response text matching the detected/active voice language
 */
export function getWakeGreetingText(lang: UserLanguage): string {
  if (lang === 'english') {
    return 'Yes, I am listening.';
  }
  return 'हाँ, मैं सुन रहा हूँ।';
}

/**
 * Dictionary of common English/Hinglish words & Indian names to Devanagari
 * so that Hindi TTS engines pronounce every word in a genuine Hindi voice
 * without switching to an English male phoneme reader mid-sentence.
 */
const WORD_TO_DEVANAGARI: Record<string, string> = {
  // Common names in NotiBook
  rahul: 'राहुल',
  sharma: 'शर्मा',
  amit: 'अमित',
  verma: 'वर्मा',
  sunita: 'सुनीता',
  patel: 'पटेल',
  vikas: 'विकास',
  gupta: 'गुप्ता',
  ravi: 'रवि',
  kumar: 'कुमार',
  prince: 'प्रिंस',
  ram: 'राम',
  suresh: 'सुरेश',
  ramesh: 'रमेश',
  kripa: 'कृपा',
  shankar: 'शंकर',
  walk: 'वॉक',
  in: 'इन',
  // Common business & UI words
  customer: 'कस्टमर',
  customers: 'कस्टमर्स',
  account: 'अकाउंट',
  balance: 'बैलेंस',
  payment: 'पेमेंट',
  credit: 'क्रेडिट',
  debit: 'डेबिट',
  cash: 'कैश',
  upi: 'यूपीआई',
  bank: 'बैंक',
  transfer: 'ट्रांसफर',
  bill: 'बिल',
  billing: 'बिलिंग',
  invoice: 'इनवॉइस',
  invoices: 'इनवॉइस',
  stock: 'स्टॉक',
  stocks: 'स्टॉक्स',
  inventory: 'इन्वेंट्री',
  transaction: 'ट्रांजैक्शन',
  transactions: 'ट्रांजैक्शन्स',
  passbook: 'पासबुक',
  daybook: 'डेबुक',
  ledger: 'लेजर',
  settings: 'सेटिंग्स',
  home: 'होम',
  dashboard: 'डैशबोर्ड',
  notibook: 'नोटीबुक',
  jarvis: 'जार्विस',
  total: 'टोटल',
  market: 'मार्केट',
  pending: 'पेंडिंग',
  settled: 'सेटल्ड',
  advance: 'एडवांस',
  deposit: 'डिपॉजिट',
  details: 'डिटेल्स',
  update: 'अपडेट',
  delete: 'डिलीट',
  cancel: 'कैंसिल',
  receive: 'रिसीव',
  received: 'रिसीव',
  add: 'ऐड',
  open: 'ओपन',
  list: 'लिस्ट',
  tab: 'टैब',
  page: 'पेज',
  done: 'हो गया',
  sorry: 'माफ़ कीजिए',
  ok: 'ठीक है',
  okay: 'ठीक है',
  // Common Hinglish words
  main: 'मैं',
  sun: 'सुन',
  raha: 'रहा',
  rahi: 'रही',
  rahe: 'रहे',
  hu: 'हूँ',
  hoon: 'हूँ',
  haan: 'हाँ',
  nahi: 'नहीं',
  batayein: 'बताइए',
  bataiye: 'बताइए',
  batao: 'बताओ',
  kya: 'क्या',
  karna: 'करना',
  karni: 'करनी',
  karo: 'करो',
  karein: 'करें',
  karke: 'करके',
  hai: 'है',
  hain: 'हैं',
  tha: 'था',
  thi: 'थी',
  ho: 'हो',
  gaya: 'गया',
  gaye: 'गए',
  gayi: 'गई',
  diya: 'दिया',
  diye: 'दिए',
  liya: 'लिया',
  liye: 'लिए',
  ka: 'का',
  ki: 'की',
  ke: 'के',
  ko: 'को',
  se: 'से',
  ne: 'ने',
  mein: 'में',
  me: 'में',
  par: 'पर',
  pe: 'पे',
  aur: 'और',
  ya: 'या',
  ab: 'अब',
  aap: 'आप',
  aapke: 'आपके',
  aapka: 'आपका',
  unka: 'उनका',
  unke: 'उनके',
  unse: 'उनसे',
  unhe: 'उन्हें',
  uska: 'उसका',
  uske: 'उसके',
  usmein: 'उसमें',
  usme: 'उसमें',
  naya: 'नया',
  naye: 'नए',
  khata: 'खाता',
  khate: 'खाते',
  udhar: 'उधार',
  udhaar: 'उधार',
  jama: 'जमा',
  baaki: 'बाकी',
  baki: 'बाकी',
  rupaye: 'रुपये',
  rs: 'रुपये',
  pehle: 'पहले',
  mila: 'मिला',
  mile: 'मिले',
  mil: 'मिल',
  theek: 'ठीक',
  dhanyawad: 'धन्यवाद',
  alvida: 'अलविदा',
  aaj: 'आज',
  kal: 'कल',
  kis: 'किस',
  kiske: 'किसके',
  kitna: 'कितना',
  kitne: 'कितने',
  kitni: 'कितनी',
  koi: 'कोई',
  naam: 'नाम',
  paas: 'पास',
  entry: 'एंट्री',
  pcs: 'पीस',
  pack: 'पैक',
  packet: 'पैकेट',
  can: 'कैन',
  bag: 'बैग',
  jar: 'जार',
};

/**
 * Simple phonetic transliteration fallback for any remaining Latin word into Devanagari
 * so Hindi TTS never triggers an English voice.
 */
function transliterateLatinWordToDevanagari(word: string): string {
  const lower = word.toLowerCase();
  if (WORD_TO_DEVANAGARI[lower]) {
    return WORD_TO_DEVANAGARI[lower];
  }
  if (!/[a-z]/i.test(lower)) return word;

  let s = lower;
  const digraphs: Array<[RegExp, string]> = [
    [/sh/g, 'श'],
    [/chh/g, 'छ'],
    [/ch/g, 'च'],
    [/kh/g, 'ख'],
    [/gh/g, 'घ'],
    [/th/g, 'थ'],
    [/dh/g, 'ध'],
    [/ph/g, 'फ'],
    [/bh/g, 'भ'],
    [/aa/g, 'आ'],
    [/ee/g, 'ई'],
    [/oo/g, 'ऊ'],
    [/ai/g, 'ै'],
    [/au/g, 'ौ'],
  ];
  for (const [rgx, rep] of digraphs) {
    s = s.replace(rgx, rep);
  }

  const chars: Record<string, string> = {
    a: 'अ', b: 'ब', c: 'क', d: 'द', e: 'ए', f: 'फ', g: 'ग',
    h: 'ह', i: 'इ', j: 'ज', k: 'क', l: 'ल', m: 'म', n: 'न',
    o: 'ओ', p: 'प', q: 'क', r: 'र', s: 'स', t: 'त', u: 'उ',
    v: 'व', w: 'व', x: 'क्स', y: 'य', z: 'ज़',
  };

  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += chars[ch] ?? ch;
  }
  return out;
}

/**
 * Converts a Hindi or Hinglish response string into pure Devanagari for Hindi TTS playback.
 */
export function toDevanagariForHindiTTS(text: string): string {
  if (!text) return '';
  let processed = text;

  // Format currency: ₹3,100 -> 3100 रुपये
  processed = processed.replace(/₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/g, (_, num) => {
    return `${String(num).replace(/,/g, '')} रुपये`;
  });

  // Remove invoice hash: #INV-1001 -> बिल 1001
  processed = processed.replace(/#INV-(\d+)/gi, 'बिल $1');

  // Strip quotes that can cause TTS pauses
  processed = processed.replace(/["'`]/g, '');

  // Convert any remaining Latin words to Devanagari
  processed = processed.replace(/\b([a-zA-Z]+)\b/g, (match) => {
    return transliterateLatinWordToDevanagari(match);
  });

  return processed.replace(/\s+/g, ' ').trim();
}

/**
 * Formats an English response string for clean English TTS playback.
 */
export function prepareEnglishForTTS(text: string): string {
  if (!text) return '';
  let processed = text;

  // Format currency: ₹3,100 -> 3100 rupees
  processed = processed.replace(/₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/g, (_, num) => {
    return `${String(num).replace(/,/g, '')} rupees`;
  });

  // Format #INV-1001 -> Invoice 1001
  processed = processed.replace(/#INV-(\d+)/gi, 'Invoice $1');

  processed = processed.replace(/["'`]/g, '');
  return processed.replace(/\s+/g, ' ').trim();
}

/**
 * Common clarification questions adhering strictly to user language
 */
export const LocalizedClarifications = {
  whichCustomer: (lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: 'आप किस कस्टमर की बात कर रहे हैं?',
      hinglish: 'आप किस कस्टमर की बात कर रहे हैं?',
      english: 'Which customer are you referring to?',
    }),
  howMuchAmount: (lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: 'कितनी राशि जोड़नी है?',
      hinglish: 'कितनी राशि जोड़नी है?',
      english: 'What is the amount?',
    }),
  creditOrDebit: (lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: 'पैसे जमा (क्रेडिट) हुए हैं या उधार (डेबिट) दिए हैं?',
      hinglish: 'पैसे जमा (क्रेडिट) हुए हैं या उधार (डेबिट) दिए हैं?',
      english: 'Is this payment received (credit) or given on credit (debit)?',
    }),
  customerNotFound: (name: string, lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: `माफ़ कीजिए, "${name}" नाम का कोई कस्टमर नहीं मिला।`,
      hinglish: `माफ़ कीजिए, "${name}" नाम का कोई कस्टमर नहीं मिला।`,
      english: `Sorry, could not find any customer named "${name}".`,
    }),
  genericError: (details: string, lang: UserLanguage) =>
    formatLocalizedResponse(lang, {
      hindi: `माफ़ कीजिए, यह कार्य पूरा नहीं हो सका: ${details}`,
      hinglish: `माफ़ कीजिए, यह कार्य पूरा नहीं हो सका: ${details}`,
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
  cleaned = cleaned.replace(/\s+(?:ke\s+khate\s+me|ke\s+account\s+me|ka\s+khata|ke\s+khate|karke|naam\s+ka|naam\s+se|ke|ki|ka|ko|se|pe|ji|bhai|bhaiya|saheb)$/i, '');
  cleaned = cleaned.replace(/\s+(?:के\s+खाते\s+में|के\s+खाते|के\s+अकाउंट\s+में|का\s+खाता|करके|नाम\s+का|नाम\s+से|के|की|का|को|से|पे|पर|जी|भाई|साहब)$/i, '');
  return cleaned.trim();
}

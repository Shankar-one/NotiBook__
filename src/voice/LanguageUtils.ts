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
  'badhao', 'ghatao', 'kam', 'lene', 'dene', 'wapas', 'waapas',
  'sau', 'hazaar', 'hazar', 'lakh', 'paanch', 'panch', 'chaar', 'teen', 'saat', 'aath', 'das', 'pachaas'
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

const NUMBER_WORDS_MAP: Record<string, number> = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
  // Roman Hindi / Hinglish
  ek: 1, do: 2, teen: 3, chaar: 4, char: 4, paanch: 5, panch: 5, chhah: 6, chhe: 6, che: 6,
  saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, no: 9, das: 10, dus: 10,
  gyarah: 11, barah: 12, terah: 13, chaudah: 14, pandrah: 15, solah: 16, satrah: 17,
  atharah: 18, unnis: 19, bees: 20, pachis: 25, pachees: 25, tees: 30, chalis: 40,
  pachaas: 50, pachas: 50, saath: 60, sattar: 70, assi: 80, nabbe: 90,
  // Devanagari Hindi
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'छे': 6,
  'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13,
  'चौदह': 14, 'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19,
  'बीस': 20, 'पच्चीस': 25, 'तीस': 30, 'चालीस': 40, 'पचास': 50, 'साठ': 60,
  'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90,
  '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9, '०': 0,
};

/**
 * Parses Indian spoken/written amounts across Hindi, Hinglish, and English:
 * Supports:
 * - "500", "500 rupees", "₹500", "₹2,450", "1,000", "1000"
 * - "paanch sau", "पाँच सौ", "5 hundred", "5 sau"
 * - "1 thousand", "2 hazaar", "दो हजार", "2.5 thousand", "dhai hazaar", "dedh hazaar", "dedh sau", "dhai sau"
 * - Never invents an amount: returns null if no valid amount is found.
 */
export function parseSpokenIndianAmount(rawText: string): number | null {
  if (!rawText || !rawText.trim()) return null;

  // Normalize Devanagari digits to ASCII digits
  let text = rawText
    .replace(/०/g, '0')
    .replace(/१/g, '1')
    .replace(/२/g, '2')
    .replace(/३/g, '3')
    .replace(/४/g, '4')
    .replace(/५/g, '5')
    .replace(/६/g, '6')
    .replace(/७/g, '7')
    .replace(/८/g, '8')
    .replace(/९/g, '9')
    .trim();

  const lower = text.toLowerCase();

  // 1. Self-correction handling: "500... sorry 1000" or "500 nahi 1000"
  const correctionMatch = lower.match(/(?:sorry|nahi|नहीं|मतलब|i\s+mean|actually)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
  if (correctionMatch && correctionMatch[1]) {
    const val = parseFloat(correctionMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Special fractional Hindi multipliers (dedh = 1.5, dhai = 2.5, sawa = 1.25, paune = 0.75)
  if (/\b(dedh\s+hazaar|dedh\s+hazar|डेढ़\s*हजार|डेढ़\s*हज़ार)\b/i.test(lower)) return 1500;
  if (/\b(dhai\s+hazaar|dhai\s+hazar|aadha\s+hazaar|ढाई\s*हजार|ढाई\s*हज़ार)\b/i.test(lower)) return 2500;
  if (/\b(sawa\s+hazaar|sawa\s+hazar|सवा\s*हजार|सवा\s*हज़ार)\b/i.test(lower)) return 1250;
  if (/\b(dedh\s+sau|डेढ़\s*सौ)\b/i.test(lower)) return 150;
  if (/\b(dhai\s+sau|ढाई\s*सौ)\b/i.test(lower)) return 250;
  if (/\b(sawa\s+sau|सवा\s*सौ)\b/i.test(lower)) return 125;
  if (/\b(dedh\s+lakh|डेढ़\s*लाख)\b/i.test(lower)) return 150000;
  if (/\b(dhai\s+lakh|ढाई\s*लाख)\b/i.test(lower)) return 250000;

  // "saadhe <N> hazaar" or "saadhe <N> sau"
  const saadheMatch = lower.match(/(?:saadhe|sade|sadhe|साढ़े)\s+([a-zA-Z\u0900-\u097F]+|\d+)\s+(hazaar|hazar|thousand|हजार|हज़ार|sau|hundred|सौ)/i);
  if (saadheMatch) {
    const baseRaw = saadheMatch[1];
    const baseNum = /^\d+$/.test(baseRaw) ? parseInt(baseRaw, 10) : NUMBER_WORDS_MAP[baseRaw];
    const mult = /hazaar|hazar|thousand|हजार|हज़ार/i.test(saadheMatch[2]) ? 1000 : 100;
    if (baseNum && baseNum > 0) {
      return (baseNum + 0.5) * mult;
    }
  }

  // 3. Numeric with explicit multiplier: e.g. "2.5 thousand", "5 hundred", "2 hazaar", "5 sau", "1.5 lakh", "2k"
  const numMultMatch = lower.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(thousand|hazaar|hazar|हजार|हज़ार|hundred|sau|सौ|lakh|lac|लाख|k)\b/i);
  if (numMultMatch) {
    const base = parseFloat(numMultMatch[1].replace(/,/g, ''));
    const unit = numMultMatch[2].toLowerCase();
    if (!isNaN(base) && base > 0) {
      if (unit === 'thousand' || unit === 'hazaar' || unit === 'hazar' || unit === 'हजार' || unit === 'हज़ार' || unit === 'k') {
        return Math.round(base * 1000);
      }
      if (unit === 'hundred' || unit === 'sau' || unit === 'सौ') {
        return Math.round(base * 100);
      }
      if (unit === 'lakh' || unit === 'lac' || unit === 'लाख') {
        return Math.round(base * 100000);
      }
    }
  }

  // 4. Word-based compound amounts: e.g. "do hazaar paanch sau", "paanch sau", "पाँच सौ", "दो हजार", "five hundred", "two thousand"
  const tokens = lower
    .replace(/[₹,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let totalWordAmount = 0;
  let currentChunk = 0;
  let matchedAnyWordNumber = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NUMBER_WORDS_MAP[t] !== undefined) {
      // Avoid treating English "no" as 9 unless followed by sau/hazaar/rupaye
      if (t === 'no' && !['sau', 'hundred', 'hazaar', 'hazar', 'thousand', 'rupaye', 'rupees'].includes(tokens[i + 1] || '')) {
        continue;
      }
      // Avoid treating English verb "do" as Hindi 2 unless followed by sau/hazaar/lakh/rupaye/सौ/हजार
      if (t === 'do' && !['sau', 'hundred', 'hazaar', 'hazar', 'thousand', 'lakh', 'rupaye', 'rupees', 'सौ', 'हजार', 'हज़ार'].includes(tokens[i + 1] || '')) {
        continue;
      }
      currentChunk += NUMBER_WORDS_MAP[t];
      matchedAnyWordNumber = true;
    } else if (t === 'sau' || t === 'hundred' || t === 'सौ') {
      currentChunk = (currentChunk || 1) * 100;
      totalWordAmount += currentChunk;
      currentChunk = 0;
      matchedAnyWordNumber = true;
    } else if (t === 'hazaar' || t === 'hazar' || t === 'thousand' || t === 'हजार' || t === 'हज़ार') {
      currentChunk = (currentChunk || 1) * 1000;
      totalWordAmount += currentChunk;
      currentChunk = 0;
      matchedAnyWordNumber = true;
    } else if (t === 'lakh' || t === 'lac' || t === 'लाख') {
      currentChunk = (currentChunk || 1) * 100000;
      totalWordAmount += currentChunk;
      currentChunk = 0;
      matchedAnyWordNumber = true;
    }
  }
  totalWordAmount += currentChunk;

  if (matchedAnyWordNumber && totalWordAmount > 0) {
    return totalWordAmount;
  }

  // 5. Standard digits (with or without commas/currency symbols): "₹2,450", "1,000", "500 rupees", "500"
  // Ignore phone numbers (10 digits)
  const digitMatches = Array.from(lower.matchAll(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees|rupaye|rupaya|रुपये|रुपए)?/gi));
  for (const m of digitMatches) {
    const rawNum = m[1].replace(/,/g, '');
    if (rawNum.length >= 10) continue; // Skip 10-digit phone numbers
    const parsed = parseFloat(rawNum);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

/**
 * Checks if an utterance is a direct confirmation ("yes", "haan", "save karo", "confirm")
 */
export function isConfirmationUtterance(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.,!?।]/g, '');
  const exactConfirmations = new Set([
    'yes', 'yep', 'yeah', 'sure', 'confirm', 'confirmed', 'save', 'save it', 'do it', 'proceed', 'ok save', 'okay save',
    'haan', 'ha', 'han', 'haanji', 'haan ji', 'ji haan', 'sahi hai', 'kar do', 'kardo', 'save karo', 'save kar do',
    'confirm karo', 'haan kar do', 'haan save karo', 'theek hai save karo', 'bilkul',
    'हाँ', 'हां', 'जी हाँ', 'सही है', 'कर दो', 'सेव करो', 'सेव कर दो', 'कन्फर्म', 'कन्फर्म करो', 'हाँ कर दो', 'बिल्कुल'
  ]);
  return exactConfirmations.has(clean);
}

/**
 * Checks if an utterance is a direct cancellation ("no", "nahi", "cancel", "mat karo")
 */
export function isCancellationUtterance(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.,!?।]/g, '');
  const exactCancellations = new Set([
    'no', 'nope', 'cancel', 'cancel it', 'stop', 'abort', 'dont save', "don't save", 'never mind',
    'nahi', 'na', 'naa', 'mat karo', 'cancel karo', 'cancel kar do', 'rehne do', 'chhod do', 'ruko', 'galat hai',
    'नहीं', 'ना', 'मत करो', 'कैंसिल', 'कैंसिल करो', 'रहने दो', 'छोड़ दो', 'रुको', 'गलत है'
  ]);
  return exactCancellations.has(clean);
}


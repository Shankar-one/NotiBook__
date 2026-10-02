import { Customer } from '../types';
import { parseSpokenIndianAmount } from './LanguageUtils';

export type CustomerResolutionStatus = 
  | 'EXACT' 
  | 'NORMALIZED' 
  | 'PHONE' 
  | 'AMBIGUOUS' 
  | 'NOT_FOUND'
  | 'NO_NAME_PROVIDED';

export interface CustomerResolutionResult {
  status: CustomerResolutionStatus;
  customer?: Customer;
  candidates?: Customer[];
  searchedName?: string;
}

const DEVANAGARI_TO_ROMAN_NAMES: Record<string, string> = {
  'राम': 'Ram',
  'राहुल': 'Rahul',
  'शर्मा': 'Sharma',
  'अमित': 'Amit',
  'वर्मा': 'Verma',
  'सुनीता': 'Sunita',
  'पटेल': 'Patel',
  'विकास': 'Vikas',
  'गुप्ता': 'Gupta',
  'रवि': 'Ravi',
  'कुमार': 'Kumar',
  'प्रिंस': 'Prince',
  'सुरेश': 'Suresh',
  'रमेश': 'Ramesh',
  'कृपा': 'Kripa',
  'शंकर': 'Shankar',
  'मोहन': 'Mohan',
  'सोहन': 'Sohan',
  'रोहन': 'Rohan',
  'अजय': 'Ajay',
  'विजय': 'Vijay',
  'संजय': 'Sanjay',
  'दीपक': 'Deepak',
  'राजेश': 'Rajesh',
  'महेश': 'Mahesh',
  'दिनेश': 'Dinesh',
  'मुकेश': 'Mukesh',
  'राकेश': 'Rakesh',
  'अनिल': 'Anil',
  'सुनील': 'Sunil',
  'मनोज': 'Manoj',
  'विनोद': 'Vinod',
  'पंकज': 'Pankaj',
  'नीरज': 'Neeraj',
  'गौरव': 'Gaurav',
  'सौरव': 'Saurav',
  'संदीप': 'Sandeep',
  'प्रदीप': 'Pradeep',
  'कुलदीप': 'Kuldeep',
  'आकाश': 'Akash',
  'प्रकाश': 'Prakash',
  'सुभाष': 'Subhash',
  'नितिन': 'Nitin',
  'सचिन': 'Sachin',
  'विपिन': 'Vipin',
  'ललित': 'Lalit',
  'कपिल': 'Kapil',
  'अंकित': 'Ankit',
  'रोहित': 'Rohit',
  'मोहित': 'Mohit',
  'सुमित': 'Sumit',
};

export function normalizeDevanagariNameToRoman(text: string): string {
  if (!text) return '';
  return text
    .split(/\s+/)
    .map(w => DEVANAGARI_TO_ROMAN_NAMES[w] || w)
    .join(' ');
}

// UI terms, actions, pronouns, numbers, and common words that must NEVER be extracted as customer names
export const FORBIDDEN_CUSTOMER_PHRASES = new Set([
  'account', 'khata', 'khate', 'customer', 'customers', 'grahak', 'entry', 'balance', 'udhar', 'jama',
  'paisa', 'paise', 'rupaye', 'rupees', 'rs', 'inr', 'batao', 'dikhao', 'kholo', 'karo', 'de do',
  'minus', 'hisab', 'payment', 'today', 'kal', 'yesterday', 'bill', 'receipt', 'invoice',
  'tab', 'page', 'screen', 'section', 'view', 'list', 'menu', 'sidebar', 'dashboard', 'home',
  'setting', 'settings', 'search', 'billing', 'inventory', 'stock', 'stocks', 'transaction', 'transactions',
  'passbook', 'daybook', 'ledger', 'parties', 'party', 'modal', 'form', 'history', 'report',
  'aa chuka', 'aa chuka hai', 'aa gaya', 'mil gaya', 'de diye', 'diye', 'minus karke',
  'minus karke batao', 'minus karo', 'to khate', 'to khate mein', 'khate mein se', 'khate mein',
  'account mein', 'account mein se', 'usme', 'usmein', 'unke', 'uska', 'iski', 'iske',
  'pay kar di', 'payment kar di', 'receive hua', 'receive hue', 'karke batao', 'bata do',
  'karke', 'naam', 'naam ka', 'naam se', 'banaen', 'banaye', 'banayein', 'banao', 'jodo', 'jodein',
  'maine', 'mujhe', 'humne', 'humein', 'humko', 'apne', 'aapne', 'usne', 'unhone',
  'lene', 'lena', 'dene', 'dena', 'wapas', 'waapas', 'return', 'collect', 'owes', 'owe', 'gave', 'give', 'paid', 'pay', 'received', 'receive',
  'need', 'want', 'from', 'to', 'for', 'with', 'in', 'on', 'at', 'by', 'me', 'my', 'i', 'we', 'you', 'he', 'she', 'they', 'him', 'her', 'them',
  'paanch', 'panch', 'sau', 'hazaar', 'hazar', 'hundred', 'thousand', 'lakh', 'ek', 'do', 'teen', 'chaar', 'char', 'saat', 'aath', 'das', 'dedh', 'dhai', 'sawa',
  'total', 'market', 'sabka', 'kul', 'baki', 'baaki', 'bakaya', 'receivable', 'payable', 'credit', 'debit', 'aur', 'more',
  'अकाउंट', 'खाता', 'खाते', 'कस्टमर', 'ग्राहक', 'एंट्री', 'बैलेंस', 'उधार', 'उधर', 'जमा',
  'पैसा', 'पैसे', 'रुपये', 'रुपए', 'बताओ', 'दिखाओ', 'खोलो', 'करो', 'दे दो', 'माइनस',
  'माइनस करके बताओ', 'माइनस करो', 'आ चुका है', 'आ गया', 'मिल गया', 'दे दिए', 'खाते में',
  'खाते में से', 'कम करो', 'पेमेंट कर दी', 'पेज', 'टैब', 'स्क्रीन', 'लिस्ट', 'करके', 'बनाएं', 'बनाओ',
  'मैंने', 'मुझे', 'हमने', 'हमें', 'लेने', 'लेना', 'देने', 'देना', 'वापस', 'दिए', 'दिया', 'पाँच', 'पांच', 'सौ', 'हजार', 'हज़ार', 'दो', 'एक', 'तीन', 'चार'
]);

/**
 * Normalizes customer name by trimming, lowercasing, and removing common Indian honorifics and suffixes
 */
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  let cleaned = normalizeDevanagariNameToRoman(name).trim().toLowerCase();

  cleaned = cleaned.replace(/^(?:shri|shree|mr\.?|mrs\.?|ms\.?|customer|grahak|naya|new)\s+/i, '');
  cleaned = cleaned.replace(/\s+(?:ji|bhai|bhaiya|saheb|sahab|babu|sir|madam)$/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

/**
 * Cleans extracted candidate name to remove conversational filler particles, pronouns, prepositions, and UI words.
 */
export function cleanExtractedCustomerName(rawName: string): string {
  if (!rawName) return '';
  let text = rawName.trim();

  // Remove common conversational and pronoun prefixes ("Maine", "Mujhe", "I", "Hey Jarvis", etc.)
  text = text.replace(/^(?:अरे|भाई|सुनो|जार्विस|मैंने|मुझे|हमने|हमें|कृपया|jarvis|hey\s+jarvis|please|zara|ek|naya|new|maine|mujhe|humne|humein|humko|i\s+need\s+to\s+collect|i\s+gave|i\s+paid|i|we|collect|from|to|for|add|record|update)\s+/i, '');
  text = text.replace(/^(?:maine|mujhe|humne|मैंने|मुझे|हमने|from|to|for)\s+/i, '');

  // Remove trailing prepositions, verbs, and markers
  text = text.replace(/(?:\s+(?:karke|naam\s+ka|naam\s+se|naam\s+ke|naam|ka|ki|ke|ko|se|ne|pe|par|owes\s+me|owes|paid\s+me|paid|gave\s+me|gave|lene\s+hain|lena\s+hai|diye|diya|wapas\s+diye|करके|नाम\s+का|नाम\s+से|नाम|में|पे|पर|का|की|के|को|से|ने))+$/i, '');
  text = text.replace(/^(?:se|ko|ne|ka|ki|ke|to|in|for|from)\s+/i, '');

  // Remove transaction/action phrases
  text = text.replace(/\s+(?:ke\s+khate\s+mein\s+se|ke\s+khate\s+mein|to\s+khate\s+mein|khate\s+mein\s+se|khate\s+mein|account\s+mein|mein|me)$/i, '');
  text = text.replace(/\s+(?:aa\s+chuka\s+hai|aa\s+chuka|aa\s+gaya|mil\s+gaya|de\s+diye|diye|minus\s+karke\s+batao|minus\s+karo)$/i, '');
  text = text.replace(/\s+(?:के\s+खाते\s+में\s+से|के\s+खाते\s+में|खाते\s+में\s+से|खाते\s+में|अकाउंट\s+में|में)$/i, '');
  text = text.replace(/\s+(?:आ\s+चुका\s+है|आ\s+गया|मिल\s+गया|दे\s+दिए|दिए|माइनस\s+करके\s+बताओ|माइनस\s+करो)$/i, '');

  // Remove numbers and punctuation
  text = text.replace(/[0-9₹,\.]+/g, '').trim();

  // Normalize Devanagari known names to Roman for clean matching & display
  const romanized = normalizeDevanagariNameToRoman(text).trim();
  const lower = romanized.toLowerCase();
  if (FORBIDDEN_CUSTOMER_PHRASES.has(lower) || FORBIDDEN_CUSTOMER_PHRASES.has(text.toLowerCase()) || romanized.length < 2) {
    return '';
  }

  const words = lower.split(/\s+/).filter(Boolean);
  const containsUiWords = words.some(w => ['tab', 'page', 'screen', 'section', 'view', 'list', 'menu', 'sidebar', 'button'].includes(w));
  if (containsUiWords) {
    return '';
  }

  // Filter out forbidden words from multi-word candidate
  const validNameTokens = romanized
    .split(/\s+/)
    .filter(w => {
      const wl = w.toLowerCase();
      return !FORBIDDEN_CUSTOMER_PHRASES.has(wl) && !['to', 'se', 'ko', 'ne', 'ka', 'ki', 'ke', 'hai', 'hain', 'tha', 'mein', 'from', 'for', 'and', 'aur'].includes(wl);
    });

  if (validNameTokens.length === 0) {
    return '';
  }

  const finalName = validNameTokens
    .map(w => (/^[a-zA-Z]+$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
    .trim();

  if (finalName.length < 2 || FORBIDDEN_CUSTOMER_PHRASES.has(finalName.toLowerCase())) {
    return '';
  }

  return finalName;
}

/**
 * Extracts a person/customer name from any Hindi, Hinglish, or English financial utterance.
 * Examples handled:
 * - "Ram se 500 lene hain" -> "Ram"
 * - "राम से 500 रुपये लेने हैं" -> "Ram"
 * - "I need to collect 500 from Ram" -> "Ram"
 * - "Ram owes me 500" -> "Ram"
 * - "Ram ke 500 lene hain" -> "Ram"
 * - "Ram ko 500 diye" -> "Ram"
 * - "I gave Ram 500" -> "Ram"
 * - "Maine Ram ko paanch sau diye" -> "Ram"
 * - "Ram ne mujhe 500 wapas diye" -> "Ram"
 */
export function extractPersonNameFromUtterance(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // Normalize Devanagari names to Roman equivalents for consistent extraction
  const normalizedInput = normalizeDevanagariNameToRoman(raw.trim());

  // 1. Self-correction check: "Rahul ka balance batao... nahi, Ramesh ka"
  const correctionMatch = normalizedInput.match(/(?:nahi|sorry|नहीं|मतलब|i\s+mean)\s*,?\s*([a-zA-Z\u0900-\u097F]+(?:\s+[a-zA-Z\u0900-\u097F]+)?)\s*(?:ka|ke|ki|ko|se|ne|का|के|की|को|से|ने)?$/i);
  if (correctionMatch && correctionMatch[1]) {
    const cleanedCorr = cleanExtractedCustomerName(correctionMatch[1]);
    if (cleanedCorr) return cleanedCorr;
  }

  // Strip leading subject pronouns like "Maine ", "Mujhe ", "Humne "
  const withoutLeadingSubject = normalizedInput.replace(/^(?:अरे|जार्विस|भाई|सुनो|hey\s+jarvis|jarvis|please)?\s*(?:maine|mujhe|humne|humein|humko|मैंने|मुझे|हमने|हमें)\s+/i, '').trim();

  // 2. Hindi/Hinglish postposition pattern: "<Name> se/ko/ke/ne/ka/ki ..."
  const postpositionMatch = withoutLeadingSubject.match(/^([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s+(?:se|ko|ke|ne|ka|ki|से|को|के|ने|का|की)\b/i);
  if (postpositionMatch && postpositionMatch[1]) {
    const cleaned = cleanExtractedCustomerName(postpositionMatch[1]);
    if (cleaned) return cleaned;
  }

  // 3. English "from <Name>" or "to <Name>" or "for <Name>"
  // e.g. "I need to collect 500 from Ram", "Add 500 credit to Suresh", "Paid 500 to Ram"
  const prepMatch = normalizedInput.match(/\b(?:from|to|for)\s+([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)(?:\s+(?:account|khata|ledger|for|as|on|today|yesterday)|\s*$)/i);
  if (prepMatch && prepMatch[1]) {
    const cleaned = cleanExtractedCustomerName(prepMatch[1]);
    if (cleaned) return cleaned;
  }

  // 4. English "<Name> owes me ...", "<Name> paid me ...", "<Name> gave me ...", "<Name> returned ..."
  const subjectVerbMatch = normalizedInput.match(/^([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s+(?:owes|owe|paid|gave|returned|sent|has|is)\b/i);
  if (subjectVerbMatch && subjectVerbMatch[1]) {
    const cleaned = cleanExtractedCustomerName(subjectVerbMatch[1]);
    if (cleaned) return cleaned;
  }

  // 5. English "I gave <Name> <Amount>" / "gave <Name> 500" / "give <Name> 500" / "pay <Name> 500"
  const gaveMatch = normalizedInput.match(/\b(?:i\s+gave|gave|give|paid|pay)\s+([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s+(?:₹|rs\.?|inr|\d|ek|do|teen|chaar|paanch|panch|one|two|three|four|five)/i);
  if (gaveMatch && gaveMatch[1]) {
    const cleaned = cleanExtractedCustomerName(gaveMatch[1]);
    if (cleaned) return cleaned;
  }

  // 6. Mid-sentence "<Name> se/ko/ke/ne" (e.g. "Aaj Ram ko 500 diye", "Kal Rahul se 1000 mile")
  const midParticleMatch = withoutLeadingSubject.match(/(?:^|\s)([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s+(?:se|ko|ke|ne|ka|ki|से|को|के|ने|का|की)\s+/i);
  if (midParticleMatch && midParticleMatch[1]) {
    const cleaned = cleanExtractedCustomerName(midParticleMatch[1]);
    if (cleaned) return cleaned;
  }

  // 7. Customer creation patterns
  const isNavigation = /\b(show|open|go to|take me|navigate|tab|page|screen|section|view|list|kholo|dikhao)\b/i.test(normalizedInput);
  if (!isNavigation) {
    const creationMatch =
      normalizedInput.match(/(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:customer|party)\s+(?:named\s+|called\s+)?([a-zA-Z\u0900-\u097F\s]+)/i) ||
      normalizedInput.match(/(?:add|create)\s+([a-zA-Z\u0900-\u097F\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
      normalizedInput.match(/(?:customer\s+banao|customer\s+banaen|customer\s+banaye|customer\s+add\s+karo)\s+([a-zA-Z\s\u0900-\u097F]+)/i) ||
      normalizedInput.match(/([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke|naam\s+ka|naam\s+se|करके|नाम\s+का|नाम\s+से)?\s*(?:naya\s+|नया\s+)?(?:customer|grahak|कस्टमर|ग्राहक)\s*(?:banao|bana\s*do|banaen|banaye|banayein|banaiye|add\s*karo|add\s*karein|add\s*kar\s*do|jodo|jodein|जोड़ो|जोड़ें|बनाओ|बनाएं|बनायें|बनाइए|बना\s*दो)/i);
    if (creationMatch && creationMatch[1]) {
      const cleaned = cleanExtractedCustomerName(creationMatch[1]);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

/**
 * High-precision customer resolver matching against the actual customer database
 */
export function resolveCustomerAgainstDatabase(
  input: string,
  customers: Customer[]
): CustomerResolutionResult {
  if (!input || !input.trim()) {
    return { status: 'NO_NAME_PROVIDED' };
  }

  const normalizedSentence = normalizeDevanagariNameToRoman(input).trim();
  const inputLower = normalizedSentence.toLowerCase();

  // 1. Direct Exact Name or ID Match
  const exactMatch = customers.find(c => 
    c.id.toLowerCase() === inputLower ||
    c.name.toLowerCase() === inputLower
  );
  if (exactMatch) {
    return { status: 'EXACT', customer: exactMatch, searchedName: exactMatch.name };
  }

  // 2. Normalized Name Match
  const normalizedInput = normalizeCustomerName(normalizedSentence);
  const normalizedMatch = customers.find(c => normalizeCustomerName(c.name) === normalizedInput);
  if (normalizedMatch) {
    return { status: 'NORMALIZED', customer: normalizedMatch, searchedName: normalizedMatch.name };
  }

  // 3. Phone Number Match
  const phoneDigits = input.replace(/[^0-9]/g, '');
  if (phoneDigits.length >= 10) {
    const phoneMatch = customers.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').includes(phoneDigits.slice(-10)));
    if (phoneMatch) {
      return { status: 'PHONE', customer: phoneMatch, searchedName: phoneMatch.name };
    }
  }

  // 4. Full Customer Name in Utterance (Longest match first)
  const sortedCustomers = [...customers].sort((a, b) => b.name.length - a.name.length);
  const fullNameMatches: Customer[] = [];
  for (const c of sortedCustomers) {
    const custFullName = c.name.toLowerCase().trim();
    const escaped = custFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9\u0900-\u097F])${escaped}(?:$|[^a-zA-Z0-9\u0900-\u097F])`, 'i');
    if (regex.test(inputLower)) {
      fullNameMatches.push(c);
    }
  }

  if (fullNameMatches.length === 1) {
    return { status: 'EXACT', customer: fullNameMatches[0], searchedName: fullNameMatches[0].name };
  } else if (fullNameMatches.length > 1) {
    return { status: 'AMBIGUOUS', candidates: fullNameMatches, searchedName: fullNameMatches[0].name };
  }

  // 5. First-Name / Token Match with Ambiguity Detection
  const firstNameMatches: Customer[] = [];
  for (const c of customers) {
    const cTokens = c.name.toLowerCase().split(/\s+/).filter(Boolean);
    const firstName = cTokens[0];
    if (firstName && firstName.length >= 3 && !FORBIDDEN_CUSTOMER_PHRASES.has(firstName)) {
      const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9\u0900-\u097F])${escapedFirst}(?:$|[^a-zA-Z0-9\u0900-\u097F])`, 'i');
      if (regex.test(inputLower)) {
        if (!firstNameMatches.some(m => m.id === c.id)) {
          firstNameMatches.push(c);
        }
      }
    }
  }

  if (firstNameMatches.length === 1) {
    return { status: 'EXACT', customer: firstNameMatches[0], searchedName: firstNameMatches[0].name };
  } else if (firstNameMatches.length > 1) {
    return { status: 'AMBIGUOUS', candidates: firstNameMatches, searchedName: firstNameMatches[0].name.split(' ')[0] };
  }

  // 6. Extract Person Name from Utterance (Even if not yet in database!)
  const extractedPerson = extractPersonNameFromUtterance(normalizedSentence);
  if (extractedPerson) {
    const custMatch = customers.find(c =>
      c.name.toLowerCase() === extractedPerson.toLowerCase() ||
      c.name.toLowerCase().startsWith(extractedPerson.toLowerCase() + ' ')
    );
    if (custMatch) {
      return { status: 'EXACT', customer: custMatch, searchedName: custMatch.name };
    }
    return { status: 'NOT_FOUND', searchedName: extractedPerson };
  }

  return { status: 'NO_NAME_PROVIDED' };
}

/**
 * Extracts numeric transaction amount from utterance using full Hindi/Hinglish/English parser.
 */
export function extractTransactionAmount(text: string): { amount?: number; hasAmount: boolean } {
  const parsed = parseSpokenIndianAmount(text);
  if (parsed === null || isNaN(parsed) || parsed <= 0) {
    return { hasAmount: false };
  }
  return { amount: parsed, hasAmount: true };
}

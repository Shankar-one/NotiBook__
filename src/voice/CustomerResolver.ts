import { Customer } from '../types';

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

// UI terms, actions, and common words that must NEVER be extracted as customer names
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
  'अकाउंट', 'खाता', 'खाते', 'कस्टमर', 'ग्राहक', 'एंट्री', 'बैलेंस', 'उधार', 'उधर', 'जमा',
  'पैसा', 'पैसे', 'रुपये', 'रुपए', 'बताओ', 'दिखाओ', 'खोलो', 'करो', 'दे दो', 'माइनस',
  'माइनस करके बताओ', 'माइनस करो', 'आ चुका है', 'आ गया', 'मिल गया', 'दे दिए', 'खाते में',
  'खाते में से', 'कम करो', 'पेमेंट कर दी', 'पेज', 'टैब', 'स्क्रीन', 'लिस्ट'
]);

/**
 * Normalizes customer name by trimming, lowercasing, and removing common Indian honorifics and suffixes
 */
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim().toLowerCase();

  cleaned = cleaned.replace(/^(?:shri|shree|mr\.?|mrs\.?|ms\.?|customer|grahak|naya|new)\s+/i, '');
  cleaned = cleaned.replace(/\s+(?:ji|bhai|bhaiya|saheb|sahab|babu|sir|madam)$/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

/**
 * Cleans extracted candidate name to remove conversational filler particles, prepositions, and UI words.
 */
export function cleanExtractedCustomerName(rawName: string): string {
  if (!rawName) return '';
  let text = rawName.trim();

  // Remove common conversational prefixes
  text = text.replace(/^(?:अरे|भाई|सुनो|जार्विस|jarvis|hey\s+jarvis|please|zara|ek|naya|new)\s+/i, '');

  // Remove trailing prepositions and markers
  text = text.replace(/(?:\s+(?:ka|ki|ke|ko|se|ne|pe|par|में|पे|पर|का|की|के|को|से|ने))+$/i, '');
  text = text.replace(/^(?:se|ko|ne|ka|ki|ke|to|in|for)\s+/i, '');

  // Remove transaction/action phrases
  text = text.replace(/\s+(?:ke\s+khate\s+mein\s+se|ke\s+khate\s+mein|to\s+khate\s+mein|khate\s+mein\s+se|khate\s+mein|account\s+mein|mein|me)$/i, '');
  text = text.replace(/\s+(?:aa\s+chuka\s+hai|aa\s+chuka|aa\s+gaya|mil\s+gaya|de\s+diye|diye|minus\s+karke\s+batao|minus\s+karo)$/i, '');
  text = text.replace(/\s+(?:के\s+खाते\s+में\s+से|के\s+खाते\s+में|खाते\s+में\s+से|खाते\s+में|अकाउंट\s+में|में)$/i, '');
  text = text.replace(/\s+(?:आ\s+चुका\s+है|आ\s+गया|मिल\s+गया|दे\s+दिए|दिए|माइनस\s+करके\s+बताओ|माइनस\s+करो)$/i, '');

  // Remove numbers and punctuation
  text = text.replace(/[0-9₹,\.]+/g, '').trim();

  const lower = text.toLowerCase();
  if (FORBIDDEN_CUSTOMER_PHRASES.has(lower) || lower.length < 2) {
    return '';
  }

  // Check if string contains any forbidden UI words
  const words = lower.split(/\s+/).filter(Boolean);
  const containsUiWords = words.some(w => ['tab', 'page', 'screen', 'section', 'view', 'list', 'menu', 'sidebar', 'button'].includes(w));
  if (containsUiWords) {
    return '';
  }

  const nonFragmentWords = words.filter(w => !FORBIDDEN_CUSTOMER_PHRASES.has(w) && !['to', 'se', 'ko', 'ne', 'ka', 'ki', 'ke', 'hai', 'tha', 'mein'].includes(w));
  if (nonFragmentWords.length === 0) {
    return '';
  }

  return text.trim();
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

  const inputLower = input.toLowerCase().trim();

  // 1. Direct Exact Name or ID Match
  const exactMatch = customers.find(c => 
    c.id.toLowerCase() === inputLower ||
    c.name.toLowerCase() === inputLower
  );
  if (exactMatch) {
    return { status: 'EXACT', customer: exactMatch, searchedName: exactMatch.name };
  }

  // 2. Normalized Name Match
  const normalizedInput = normalizeCustomerName(input);
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

  // 6. Explicit Extraction of Customer Name from creation command ONLY
  // (Never trigger on navigation like "show me the customer tab" or "open customer page")
  const isNavigation = /\b(show|open|go to|take me|navigate|tab|page|screen|section|view|list|kholo|dikhao)\b/i.test(inputLower);
  if (!isNavigation) {
    const creationMatch = 
      inputLower.match(/(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
      inputLower.match(/(?:customer\s+banao|customer\s+add\s+karo)\s+([a-zA-Z\s]+)/i) ||
      inputLower.match(/([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:customer|ग्राहक)\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|जोड़ो|बनाओ|बना\s*दो)/i) ||
      inputLower.match(/^(?:new\s+customer|naya\s+customer|नया\s+ग्राहक|नया\s+कस्टमर)\s+([a-zA-Z\s\u0900-\u097F]+)/i);

    if (creationMatch && creationMatch[1]) {
      const cleanName = cleanExtractedCustomerName(creationMatch[1]);
      if (cleanName && cleanName.length >= 2) {
        return { status: 'NOT_FOUND', searchedName: cleanName };
      }
    }

    const particleMatch = input.match(/(?:^|अरे|जार्विस|भाई|सुनो)?\s*([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s*(?:ne|ko|ka|ki|ke|se|ने|को|का|की|के|से)\s+/i);
    if (particleMatch && particleMatch[1]) {
      const candidate = cleanExtractedCustomerName(particleMatch[1]);
      if (candidate && !FORBIDDEN_CUSTOMER_PHRASES.has(candidate.toLowerCase())) {
        const custMatch = customers.find(c => c.name.toLowerCase().includes(candidate.toLowerCase()));
        if (custMatch) {
          return { status: 'EXACT', customer: custMatch, searchedName: custMatch.name };
        }
        return { status: 'NOT_FOUND', searchedName: candidate };
      }
    }
  }

  return { status: 'NO_NAME_PROVIDED' };
}

/**
 * Extracts numeric transaction amount from utterance without inventing any values.
 */
export function extractTransactionAmount(text: string): { amount?: number; hasAmount: boolean } {
  const match = text.match(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|रुपये|रुपए)?/i);
  if (!match) {
    return { hasAmount: false };
  }
  const parsed = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(parsed) || parsed <= 0) {
    return { hasAmount: false };
  }
  return { amount: parsed, hasAmount: true };
}

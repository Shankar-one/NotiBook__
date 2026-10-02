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

// Common Hindi/Hinglish/English stop words and sentence fragments that must NEVER become a customer name
const FORBIDDEN_CUSTOMER_PHRASES = new Set([
  'account', 'khata', 'khate', 'customer', 'grahak', 'entry', 'balance', 'udhar', 'jama',
  'paisa', 'paise', 'rupaye', 'rupees', 'rs', 'inr', 'batao', 'dikhao', 'kholo', 'karo', 'de do',
  'minus', 'hisab', 'payment', 'today', 'kal', 'yesterday', 'bill', 'receipt',
  'aa chuka', 'aa chuka hai', 'aa gaya', 'mil gaya', 'de diye', 'diye', 'minus karke',
  'minus karke batao', 'minus karo', 'to khate', 'to khate mein', 'khate mein se', 'khate mein',
  'account mein', 'account mein se', 'usme', 'usmein', 'unke', 'uska', 'iski', 'iske',
  'pay kar di', 'payment kar di', 'receive hua', 'receive hue', 'karke batao', 'bata do',
  'अकाउंट', 'खाता', 'खाते', 'कस्टमर', 'ग्राहक', 'एंट्री', 'बैलेंस', 'उधार', 'उधर', 'जमा',
  'पैसा', 'पैसे', 'रुपये', 'रुपए', 'बताओ', 'दिखाओ', 'खोलो', 'करो', 'दे दो', 'माइनस',
  'माइनस करके बताओ', 'माइनस करो', 'आ चुका है', 'आ गया', 'मिल गया', 'दे दिए', 'खाते में',
  'खाते में से', 'कम करो', 'पेमेंट कर दी'
]);

/**
 * Normalizes customer name by trimming, lowercasing, and removing common Indian honorifics and suffixes
 */
export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim().toLowerCase();

  // Strip prefixes
  cleaned = cleaned.replace(/^(?:shri|shree|mr\.?|mrs\.?|ms\.?|customer|grahak|naya|new)\s+/i, '');
  // Strip suffixes
  cleaned = cleaned.replace(/\s+(?:ji|bhai|bhaiya|saheb|sahab|babu|sir|madam)$/i, '');
  // Strip multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned.trim();
}

/**
 * Cleans extracted candidate name to remove conversational filler particles and prepositions.
 * Never allows sentence fragments like "aa chuka hai to khate mein" or "minus karke batao" through.
 */
export function cleanExtractedCustomerName(rawName: string): string {
  if (!rawName) return '';
  let text = rawName.trim();

  // Remove common conversation prefixes
  text = text.replace(/^(?:अरे|भाई|सुनो|जार्विस|jarvis|hey\s+jarvis|please|zara|ek|naya|new)\s+/i, '');

  // Remove trailing case markers & prepositions
  text = text.replace(/(?:\s+(?:ka|ki|ke|ko|se|ne|pe|par|में|पे|पर|का|की|के|को|से|ने))+$/i, '');
  text = text.replace(/^(?:se|ko|ne|ka|ki|ke|to|in|for)\s+/i, '');

  // Remove transaction/action phrases
  text = text.replace(/\s+(?:ke\s+khate\s+mein\s+se|ke\s+khate\s+mein|to\s+khate\s+mein|khate\s+mein\s+se|khate\s+mein|account\s+mein|mein|me)$/i, '');
  text = text.replace(/\s+(?:aa\s+chuka\s+hai|aa\s+chuka|aa\s+gaya|mil\s+gaya|de\s+diye|diye|minus\s+karke\s+batao|minus\s+karo)$/i, '');
  text = text.replace(/\s+(?:के\s+खाते\s+में\s+से|के\s+खाते\s+में|खाते\s+में\s+से|खाते\s+में|अकाउंट\s+में|में)$/i, '');
  text = text.replace(/\s+(?:आ\s+चुका\s+है|आ\s+गया|मिल\s+गया|दे\s+दिए|दिए|माइनस\s+करके\s+बताओ|माइनस\s+करो)$/i, '');

  // Remove isolated digits / currency
  text = text.replace(/[0-9₹,\.]+/g, '').trim();

  const lower = text.toLowerCase();
  if (FORBIDDEN_CUSTOMER_PHRASES.has(lower) || lower.length < 2) {
    return '';
  }

  // Check if string is composed purely of sentence fragment words
  const words = lower.split(/\s+/).filter(Boolean);
  const nonFragmentWords = words.filter(w => !FORBIDDEN_CUSTOMER_PHRASES.has(w) && !['to', 'se', 'ko', 'ne', 'ka', 'ki', 'ke', 'hai', 'tha', 'mein'].includes(w));
  if (nonFragmentWords.length === 0) {
    return '';
  }

  return text.trim();
}

/**
 * High-precision customer resolver matching against the actual customer database
 * Follows strict priority order:
 * 1. Exact name match
 * 2. Normalized name match
 * 3. Phone number match
 * 4. Full customer name present in utterance (e.g. "Rahul Sharma" in "Rahul Sharma ka 2000 aa chuka hai to khate mein se 2000 minus karke batao")
 * 5. First-name or distinct token match with ambiguity detection (e.g. "Rahul" -> Rahul Sharma, or "Ravi" -> [Ravi Kumar, Ravi Sharma])
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
  // Check if any customer's full name appears as a discrete phrase in the user's speech
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
  // Check if user spoke a customer's first name (e.g., "Rahul", "Amit", "Sunita", "Ravi")
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

  // 6. Explicit Extraction of Customer Name from creation / named command
  // e.g. "Add customer Ramesh" or "Ramesh ko customer add karo"
  const creationMatch = 
    inputLower.match(/(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
    inputLower.match(/(?:customer\s+banao|customer\s+add\s+karo)\s+([a-zA-Z\s]+)/i) ||
    inputLower.match(/([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:customer|ग्राहक)\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|जोड़ो|बनाओ)/i) ||
    inputLower.match(/^(?:new\s+customer|naya\s+customer|नया\s+ग्राहक|नया\s+कस्टमर)\s+([a-zA-Z\s\u0900-\u097F]+)/i);

  if (creationMatch && creationMatch[1]) {
    const cleanName = cleanExtractedCustomerName(creationMatch[1]);
    if (cleanName) {
      return { status: 'NOT_FOUND', searchedName: cleanName };
    }
  }

  // Extract candidate before 'ne', 'ko', 'ka', 'se' ONLY if it's a clean 1-2 word name and not a stop phrase
  const particleMatch = input.match(/(?:^|अरे|जार्विस|भाई|सुनो)?\s*([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s*(?:ne|ko|ka|ki|ke|se|ने|को|का|की|के|से)\s+/i);
  if (particleMatch && particleMatch[1]) {
    const candidate = cleanExtractedCustomerName(particleMatch[1]);
    if (candidate && !FORBIDDEN_CUSTOMER_PHRASES.has(candidate.toLowerCase())) {
      // Check if candidate matches any customer
      const custMatch = customers.find(c => c.name.toLowerCase().includes(candidate.toLowerCase()));
      if (custMatch) {
        return { status: 'EXACT', customer: custMatch, searchedName: custMatch.name };
      }
      return { status: 'NOT_FOUND', searchedName: candidate };
    }
  }

  return { status: 'NO_NAME_PROVIDED' };
}

/**
 * Distinguishes financial direction and intent semantically from natural Hindi/Hinglish/English
 */
export type FinancialIntent = 
  | 'PAYMENT_RECEIVED'       // Customer paying merchant: reduces customer outstanding (jama, received, de diye, minus from khata)
  | 'ADD_CUSTOMER_DEBT'      // Merchant giving goods/credit to customer: increases customer outstanding (udhar, debit)
  | 'GET_CUSTOMER_BALANCE'   // Balance of single customer
  | 'GET_ACCOUNT_BALANCE'    // Total market dues
  | 'CREATE_CUSTOMER'        // Explicit request to add a new customer
  | 'GET_TRANSACTIONS'       // Transaction history inquiry
  | 'UNKNOWN';

export function detectFinancialIntent(text: string): FinancialIntent {
  const lower = text.toLowerCase();

  // 1. Explicit Customer Creation
  const isExplicitAddCustomer = 
    /(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i.test(lower) ||
    /(?:customer\s+banao|customer\s+add\s+karo|naya\s+customer\s+add\s+karo|naya\s+customer\s+banao)/i.test(lower) ||
    /([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:customer|ग्राहक)\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|जोड़ो|बनाओ|बना\s*दो)/i.test(lower) ||
    /^(?:new\s+customer|naya\s+customer|नया\s+ग्राहक|नया\s+कस्टमर)\s+[a-zA-Z\u0900-\u097F]+/i.test(lower) ||
    /^(?:customer\s+banao|naya\s+customer\s+banao|add\s+customer|create\s+customer)$/i.test(lower);

  if (isExplicitAddCustomer) {
    return 'CREATE_CUSTOMER';
  }

  // 2. Account Balance (Total market dues)
  const isAccountBalance = 
    /\b(total\s+udhar|market\s+udhar|market\s+me|baki\s+paisa|sabka\s+udhar|kul\s+udhar|kul\s+bakaya|pending\s+dues|total\s+dues|lena\s+hai)\b/i.test(lower) ||
    /कुल\s*उधारी|बाकी\s*पैसा|कुल\s*बकाया|मार्केट\s*में|लेना\s*है|सबका\s*उधार/i.test(text);
  if (isAccountBalance) {
    return 'GET_ACCOUNT_BALANCE';
  }

  // 3. Customer Balance query
  const isCustomerBalance = 
    /\b(balance|baki\s*hai|kitna\s*hai|kitna\s*baki|dues|hisab\s*batao)\b/i.test(lower) ||
    /बैलेंस|कितना\s*बाकी|बकाया|हिसाब\s*बताओ/i.test(text);

  // 4. "Minus" from account / khata -> CRITICAL: ALWAYS PAYMENT_RECEIVED (reduces outstanding, NOT debit!)
  const isMinusReduction = 
    /\b(minus\s*karke\s*batao|minus\s*karo|minus\s*kar\s*do|minus|kam\s*karo|kam\s*kar\s*do|khate\s*mein\s*se\s*minus)\b/i.test(lower) ||
    /माइनस\s*करके\s*बताओ|माइनस\s*करो|माइनस\s*कर\s*दो|माइनस|कम\s*करो/i.test(text);

  if (isMinusReduction) {
    return 'PAYMENT_RECEIVED';
  }

  // 5. PAYMENT RECEIVED (Customer pays merchant, dues decrease)
  // "Rahul ne 2000 diye", "Rahul ka 2000 aa chuka hai", "Rahul ka 2000 mil gaya", "Rahul se payment receive hua", etc.
  const isCustomerGivenPayment = 
    /\b(?:ne\s+\d+|ne\s+payment|ka\s+\d+\s+aa|ka\s+\d+\s+mil|se\s+\d+\s+receive|se\s+payment)\b/i.test(lower) ||
    /\b(aa\s*chuka\s*hai|aa\s*chuka|aa\s*gaya|aa\s*gayi|aaye|aaya|mil\s*gaya|mil\s*gaye|mile|receive\s*hua|receive\s*hue|received|de\s*diye|pay\s*kar\s*diye|pay\s*kiya|pay\s*kar\s*di|payment\s*kar\s*di|payment\s*aayi|wapas\s*kar\s*diye|wapas\s*diye|jama|jama\s*karo|jama\s*likho|jama\s*kar\s*do)\b/i.test(lower) ||
    /आ\s*चुका\s*है|आ\s*चुका|आ\s*गया|आ\s*गई|आए|आया|मिल\s*गया|मिल\s*गए|मिले|प्राप्त\s*हुए|पेमेंट\s*कर\s*दी|पेमेंट\s*आई|दे\s*दिए|वापस\s*कर\s*दिए|जमा|जमा\s*करो|जमा\s*लिखो/i.test(text);

  // 6. CREDIT GIVEN (Customer owes merchant, udhaar, dues increase)
  // "Rahul ko 2000 udhar diya", "udhar likh do", "debit"
  const isCreditGiven = 
    /\b(udhar|udhari|debit|le\s*gaya|samaan\s*diya|udhar\s*likho|udhar\s*likh\s*do|udhar\s*chadha\s*do|udhar\s*diya)\b/i.test(lower) ||
    /उधार|उधर|उधारी|डेबिट|सामान\s*दिया|उधार\s*लिखो|उधार\s*लिख\s*दो|उधार\s*चढ़ा\s*दो|उधार\s*दिया/i.test(text);

  if (isCreditGiven && !isCustomerGivenPayment) {
    return 'ADD_CUSTOMER_DEBT';
  }

  if (isCustomerGivenPayment) {
    return 'PAYMENT_RECEIVED';
  }

  // Check "ne ... diye" vs "ko ... diye"
  if (/\bne\b/i.test(lower) && /\b(diye|diya|de\s*diye)\b/i.test(lower)) {
    return 'PAYMENT_RECEIVED';
  }
  if (/\bko\b/i.test(lower) && /\b(udhar|udhari|diye|diya)\b/i.test(lower)) {
    return 'ADD_CUSTOMER_DEBT';
  }

  if (isCustomerBalance && !lower.includes('add') && !lower.includes('likh')) {
    return 'GET_CUSTOMER_BALANCE';
  }

  return 'UNKNOWN';
}

/**
 * Extracts numeric transaction amount from utterance without inventing any values.
 * Returns hasAmount: false if user did not provide any amount.
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

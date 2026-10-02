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
 * Cleans extracted candidate name to remove conversational filler particles
 */
export function cleanExtractedCustomerName(rawName: string): string {
  if (!rawName) return '';
  let text = rawName.trim();

  // Remove common conversation prefixes
  text = text.replace(/^(?:अरे|भाई|सुनो|जार्विस|jarvis|hey\s+jarvis|please|zara|ek|naya|new)\s+/i, '');

  // Remove transaction/action phrases that might be erroneously attached
  text = text.replace(/(?:\s+(?:ka|ki|ke|ko|se|ne|pe|par|में|पे|पर|का|की|के|को|से|ने))+$/i, '');
  text = text.replace(/\s+(?:ke\s+khate\s+mein\s+se|ke\s+khate\s+mein|to\s+khate\s+mein|khate\s+mein\s+se|khate\s+mein|account\s+mein|mein|me)$/i, '');
  text = text.replace(/\s+(?:aa\s+chuka\s+hai|aa\s+gaya|mil\s+gaya|de\s+diye|diye|minus\s+karke\s+batao|minus\s+karo)$/i, '');

  // Remove Hindi equivalents
  text = text.replace(/\s+(?:के\s+खाते\s+में\s+से|के\s+खाते\s+में|खाते\s+में\s+से|खाते\s+में|अकाउंट\s+में|में)$/i, '');
  text = text.replace(/\s+(?:आ\s+चुका\s+है|आ\s+गया|मिल\s+गया|दे\s+दिए|दिए|माइनस\s+करके\s+बताओ|माइनस\s+करो)$/i, '');

  // Remove isolated digits / currency
  text = text.replace(/[0-9₹,\.]+/g, '').trim();

  return text.trim();
}

/**
 * High-precision customer resolver matching against the actual customer database
 * Follows strict priority order:
 * 1. Exact name match
 * 2. Normalized name match
 * 3. Phone number match
 * 4. Token-based / Full name substring in utterance
 * 5. First-name match with ambiguity detection
 */
export function resolveCustomerAgainstDatabase(
  input: string,
  customers: Customer[]
): CustomerResolutionResult {
  if (!input || !input.trim()) {
    return { status: 'NO_NAME_PROVIDED' };
  }

  const rawClean = cleanExtractedCustomerName(input);
  const inputLower = input.toLowerCase();
  const rawCleanLower = rawClean.toLowerCase();
  const normalizedInput = normalizeCustomerName(rawClean);

  // 1. Exact Name or ID Match
  const exactMatch = customers.find(c => 
    c.id.toLowerCase() === input.trim().toLowerCase() ||
    c.name.toLowerCase() === rawCleanLower ||
    c.name.toLowerCase() === input.trim().toLowerCase()
  );
  if (exactMatch) {
    return { status: 'EXACT', customer: exactMatch, searchedName: rawClean || exactMatch.name };
  }

  // 2. Normalized Name Match
  const normalizedMatch = customers.find(c => normalizeCustomerName(c.name) === normalizedInput);
  if (normalizedMatch) {
    return { status: 'NORMALIZED', customer: normalizedMatch, searchedName: rawClean || normalizedMatch.name };
  }

  // 3. Phone Number Match
  const phoneDigits = input.replace(/[^0-9]/g, '');
  if (phoneDigits.length >= 10) {
    const phoneMatch = customers.find(c => c.phone.replace(/[^0-9]/g, '').includes(phoneDigits.slice(-10)));
    if (phoneMatch) {
      return { status: 'PHONE', customer: phoneMatch, searchedName: phoneMatch.name };
    }
  }

  // 4. Full Customer Name in Utterance
  // Check if any customer's full name appears as a discrete phrase in the user's speech
  const fullNameMatches: Customer[] = [];
  for (const c of customers) {
    const custFullName = c.name.toLowerCase().trim();
    // Word boundary check for full customer name
    const escaped = custFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9\u0900-\u097F])${escaped}(?:$|[^a-zA-Z0-9\u0900-\u097F])`, 'i');
    if (regex.test(inputLower)) {
      fullNameMatches.push(c);
    }
  }

  if (fullNameMatches.length === 1) {
    return { status: 'EXACT', customer: fullNameMatches[0], searchedName: fullNameMatches[0].name };
  } else if (fullNameMatches.length > 1) {
    return { status: 'AMBIGUOUS', candidates: fullNameMatches, searchedName: rawClean };
  }

  // 5. First-name / Strong Token Match with Ambiguity Detection
  // Only check if user specified a name token (not generic command words)
  const nonCustomerWords = [
    'customer', 'grahak', 'account', 'khata', 'balance', 'entry', 'udhar', 'jama',
    'paisa', 'paise', 'rupaye', 'rupees', 'batao', 'dikhao', 'kholo', 'karo', 'de do',
    'minus', 'hisab', 'payment', 'today', 'kal', 'yesterday', 'bill', 'receipt',
    'aa chuka hai', 'to khate mein', 'khate mein se', 'minus karke batao'
  ];

  // Extract possible name tokens from rawClean
  const tokens = rawCleanLower.split(/\s+/).filter(t => t.length >= 3 && !nonCustomerWords.includes(t));

  if (tokens.length > 0) {
    const candidateMatches: Customer[] = [];
    for (const c of customers) {
      const cTokens = c.name.toLowerCase().split(/\s+/);
      const cFirstName = cTokens[0];
      // Check if primary token matches first name or last name
      if (tokens.some(t => t === cFirstName || t === cTokens[cTokens.length - 1])) {
        candidateMatches.push(c);
      }
    }

    if (candidateMatches.length === 1) {
      return { status: 'EXACT', customer: candidateMatches[0], searchedName: rawClean || candidateMatches[0].name };
    } else if (candidateMatches.length > 1) {
      return { status: 'AMBIGUOUS', candidates: candidateMatches, searchedName: rawClean };
    }
  }

  // 6. Not Found
  return { 
    status: 'NOT_FOUND', 
    searchedName: rawClean || input.trim() 
  };
}

/**
 * Distinguishes financial direction and intent semantically from natural Hindi/Hinglish/English
 */
export type FinancialIntent = 
  | 'PAYMENT_RECEIVED'       // Customer paying merchant: reduces customer outstanding
  | 'CREDIT_GIVEN'          // Merchant giving goods/credit to customer: increases customer outstanding
  | 'MONEY_SENT_TO_CUSTOMER' // Merchant sending refund/loan to customer
  | 'CUSTOMER_CREATION'      // Explicit request to add a new customer
  | 'UNKNOWN';

export function detectFinancialIntent(text: string): FinancialIntent {
  const lower = text.toLowerCase();

  // 1. Explicit Customer Creation
  const isExplicitAddCustomer = 
    /(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i.test(lower) ||
    /(?:customer\s+banao|customer\s+add\s+karo|naya\s+customer\s+add\s+karo|naya\s+customer\s+banao)/i.test(lower) ||
    /([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:customer|ग्राहक)\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|जोड़ो|बनाओ|बना\s*दो)/i.test(lower) ||
    /^(?:new\s+customer|naya\s+customer|नया\s+ग्राहक|नया\s+कस्टमर)\s+[a-zA-Z\u0900-\u097F]+/i.test(lower);

  if (isExplicitAddCustomer) {
    return 'CUSTOMER_CREATION';
  }

  // 2. PAYMENT RECEIVED (Customer pays merchant, dues decrease)
  // Expressions: "aa chuka hai", "aa gaya", "mil gaya", "de diye", "diye", "pay kar diye", 
  // "wapas kar diye", "minus karke batao", "khate mein se minus karo", "jama kiya", "payment aayi"
  const isPaymentReceived = 
    /\b(aa\s*chuka\s*hai|aa\s*gaya|aa\s*gayi|aaye|aaya|mil\s*gaya|mil\s*gaye|mile|receive\s*hua|receive\s*hue|received|de\s*diye|diye|diya|pay\s*kar\s*diye|pay\s*kiya|wapas\s*kar\s*diye|wapas\s*diye|jama|jama\s*karo|jama\s*likho|jama\s*kar\s*do)\b/i.test(lower) ||
    /\b(minus\s*karke\s*batao|minus\s*karo|minus\s*kar\s*do|kam\s*karo|kam\s*kar\s*do|khate\s*mein\s*se\s*minus)\b/i.test(lower) ||
    /आ\s*चुका\s*है|आ\s*गया|आ\s*गई|आए|आया|मिल\s*गया|मिल\s*गए|मिले|प्राप्त\s*हुए|दिए|दिया|पेमेंट\s*कर\s*दी|वापस\s*कर\s*दिए|जमा|जमा\s*करो|जमा\s*लिखो|माइनस\s*करके\s*बताओ|माइनस\s*करो|कम\s*करो/i.test(text);

  // 3. CREDIT GIVEN (Customer owes merchant, udhaar, dues increase)
  // Expressions: "udhar likh do", "udhar diya", "udhar", "debit", "samaan le gaya", "khate mein likh do udhar"
  const isCreditGiven = 
    /\b(udhar|udhari|debit|le\s*gaya|samaan\s*diya|udhar\s*likho|udhar\s*likh\s*do|udhar\s*chadha\s*do)\b/i.test(lower) ||
    /उधार|उधर|उधारी|डेबिट|सामान\s*दिया|उधार\s*लिखो|उधार\s*लिख\s*दो|उधार\s*चढ़ा\s*दो/i.test(text);

  // Distinguish "de diye" (customer gave payment) vs "udhar diya" (merchant gave credit)
  if (isCreditGiven && !isPaymentReceived) {
    return 'CREDIT_GIVEN';
  }

  if (isPaymentReceived) {
    return 'PAYMENT_RECEIVED';
  }

  // Check if sentence specifies "minus" or "hisab kam karo"
  if (lower.includes('minus') || text.includes('माइनस') || lower.includes('kam karo')) {
    return 'PAYMENT_RECEIVED';
  }

  return 'UNKNOWN';
}

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

// UI concepts, pronouns, and non-person words that must never be saved as customer names
export const FORBIDDEN_CUSTOMER_PHRASES = new Set([
  'account',
  'customer',
  'customers',
  'entry',
  'balance',
  'credit',
  'debit',
  'receivable',
  'payable',
  'money',
  'rupees',
  'rs',
  'inr',
  'payment',
  'today',
  'yesterday',
  'bill',
  'receipt',
  'invoice',
  'tab',
  'page',
  'screen',
  'section',
  'view',
  'list',
  'menu',
  'sidebar',
  'dashboard',
  'home',
  'setting',
  'settings',
  'search',
  'billing',
  'inventory',
  'stock',
  'stocks',
  'transaction',
  'transactions',
  'passbook',
  'daybook',
  'ledger',
  'parties',
  'party',
  'modal',
  'form',
  'history',
  'report',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'it',
  'this',
  'that',
  'me',
  'my',
  'i',
  'we',
  'thousand',
  'hundred',
  'another',
  'more',
  'total',
  'current',
  'latest',
  'last',
  'new',
  'named',
  'called',
]);

export function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/^(?:mr\.?|mrs\.?|ms\.?|customer|named|called)\s+/i, '')
    .replace(/(?:'s|\s+account|\s+ledger)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanExtractedCustomerName(rawName: string): string {
  if (!rawName) return '';
  let text = rawName
    .trim()
    .replace(
      /^(?:mr\.?|mrs\.?|ms\.?|a\s+customer\s+named|a\s+customer\s+called|customer\s+named|customer\s+called|customer|named|called)\s+/i,
      ''
    )
    .replace(
      /(?:'s\s+account|'s\s+ledger|'s|\s+account|\s+ledger|\s+as\s+a\s+customer|\s+as\s+customer)$/i,
      ''
    )
    .replace(/[0-9₹$,.!?]+/g, '')
    .trim();

  if (!text || text.length < 2) return '';

  const lower = text.toLowerCase();
  if (FORBIDDEN_CUSTOMER_PHRASES.has(lower)) return '';

  const tokens = text.split(/\s+/).filter(Boolean);
  const cleanTokens = tokens.filter(t => !FORBIDDEN_CUSTOMER_PHRASES.has(t.toLowerCase()));
  if (cleanTokens.length === 0) return '';
  text = cleanTokens.join(' ');

  return text
    .split(/\s+/)
    .map(w => (/^[a-zA-Z]+$/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
    .trim();
}

/**
 * Resolves a customer name or ID against the real database records.
 * Never guesses or slices random words from sentences.
 */
export function resolveCustomerAgainstDatabase(
  nameOrId: string,
  customers: Customer[]
): CustomerResolutionResult {
  if (!nameOrId || !nameOrId.trim()) {
    return { status: 'NO_NAME_PROVIDED' };
  }

  const trimmed = nameOrId.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct ID or Exact Name Match
  const exactMatch = customers.find(
    c => c.id.toLowerCase() === lower || c.name.toLowerCase() === lower
  );
  if (exactMatch) {
    return { status: 'EXACT', customer: exactMatch, searchedName: exactMatch.name };
  }

  // 2. Normalized Name Match
  const norm = normalizeCustomerName(trimmed);
  if (!norm || FORBIDDEN_CUSTOMER_PHRASES.has(norm)) {
    return { status: 'NO_NAME_PROVIDED' };
  }

  const normalizedMatch = customers.find(c => normalizeCustomerName(c.name) === norm);
  if (normalizedMatch) {
    return { status: 'NORMALIZED', customer: normalizedMatch, searchedName: normalizedMatch.name };
  }

  // 3. Phone Number Match
  const phoneDigits = trimmed.replace(/[^0-9]/g, '');
  if (phoneDigits.length >= 10) {
    const phoneMatch = customers.find(
      c => c.phone && c.phone.replace(/[^0-9]/g, '').includes(phoneDigits.slice(-10))
    );
    if (phoneMatch) {
      return { status: 'PHONE', customer: phoneMatch, searchedName: phoneMatch.name };
    }
  }

  // 4. Unambiguous First-Name or Partial Name Match in Database
  const partialMatches = customers.filter(c => {
    const cLower = c.name.toLowerCase();
    const firstToken = cLower.split(/\s+/)[0];
    return cLower === norm || firstToken === norm || cLower.startsWith(norm + ' ');
  });

  if (partialMatches.length === 1) {
    return { status: 'EXACT', customer: partialMatches[0], searchedName: partialMatches[0].name };
  }
  if (partialMatches.length > 1) {
    return { status: 'AMBIGUOUS', candidates: partialMatches, searchedName: trimmed };
  }

  const cleaned = cleanExtractedCustomerName(trimmed);
  if (cleaned) {
    return { status: 'NOT_FOUND', searchedName: cleaned };
  }

  return { status: 'NO_NAME_PROVIDED' };
}

export function extractTransactionAmount(text: string): { amount?: number; hasAmount: boolean } {
  const parsed = parseSpokenIndianAmount(text);
  if (parsed === null || isNaN(parsed) || parsed <= 0) {
    return { hasAmount: false };
  }
  return { amount: parsed, hasAmount: true };
}

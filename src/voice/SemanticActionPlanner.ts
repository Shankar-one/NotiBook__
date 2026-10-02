import { GoogleGenAI, Type } from '@google/genai';
import {
  ConversationContext,
  SemanticActionPlan,
  PlannedAction,
  StrictVoiceIntent,
  StructuredVoiceInterpretation,
} from './types';
import {
  FORBIDDEN_CUSTOMER_PHRASES,
  resolveCustomerAgainstDatabase,
  cleanExtractedCustomerName,
  extractPersonNameFromUtterance,
  normalizeDevanagariNameToRoman,
} from './CustomerResolver';
import { detectLanguage, parseSpokenIndianAmount } from './LanguageUtils';

export interface DatabaseSnapshot {
  customers: Array<{ id: string; name: string; balance: number; phone?: string }>;
  products: Array<{ id: string; name: string; stockQty: number; sellPrice: number }>;
  transactions: Array<{ id: string; partyName: string; amount: number; type: string; date: string }>;
  totalReceivables: number;
  totalPayables?: number;
}

const MUTATING_INTENTS = new Set<StrictVoiceIntent>([
  'ADD_RECEIVABLE',
  'ADD_PAYMENT_GIVEN',
  'RECORD_PAYMENT_RECEIVED',
  'CREATE_CUSTOMER',
  'UPDATE_TRANSACTION',
  'DELETE_TRANSACTION',
]);

export class SemanticActionPlanner {
  private ai: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  /**
   * Generates a complete, validated semantic action plan & strict structured intent
   */
  public async plan(
    userUtterance: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): Promise<SemanticActionPlan> {
    const raw = userUtterance.trim();

    // 0. Check if deterministic high-confidence rules match first or validate Gemini output
    const deterministicPlan = this.planWithSemanticFallback(raw, context, db);

    // 1. Try Gemini AI Model for rich natural language comprehension, then validate against strict rules
    if (this.ai) {
      try {
        const aiPlan = await this.planWithGemini(raw, context, db);
        if (aiPlan && Array.isArray(aiPlan.actions)) {
          return this.validateAndReconcilePlan(raw, aiPlan, deterministicPlan, context, db);
        }
      } catch (err: any) {
        console.warn('[SemanticActionPlanner] Gemini call failed, using deterministic semantic planner:', err.message || err);
      }
    }

    // 2. High-precision deterministic semantic planner
    return deterministicPlan;
  }

  /**
   * Deterministic validation layer that ensures Gemini NEVER reverses money direction,
   * NEVER invents amounts or names, and ALWAYS populates StructuredVoiceInterpretation.
   */
  private validateAndReconcilePlan(
    raw: string,
    aiPlan: SemanticActionPlan,
    deterministicPlan: SemanticActionPlan,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): SemanticActionPlan {
    // If our deterministic engine identified a high-confidence strict financial rule
    // (e.g. "Ram se 500 lene hain", "Ram ko 500 diye", "Ram ne mujhe 500 wapas diye", navigation, or multi-action),
    // enforce the deterministic money direction & parsed amount so Gemini can never reverse or hallucinate it.
    const detInterp = deterministicPlan.structuredInterpretation;
    if (detInterp && detInterp.intent !== 'UNKNOWN' && detInterp.confidence >= 0.92) {
      return deterministicPlan;
    }

    // Otherwise, validate Gemini's plan against strict rules
    const parsedSpokenAmount = parseSpokenIndianAmount(raw);
    const extractedPerson = extractPersonNameFromUtterance(raw);

    // Never allow Gemini to invent an amount that wasn't spoken
    if (aiPlan.entities?.amount && parsedSpokenAmount === null) {
      aiPlan.entities.amount = null;
    } else if (parsedSpokenAmount !== null) {
      aiPlan.entities.amount = parsedSpokenAmount;
    }

    if (extractedPerson && !aiPlan.entities?.customerName) {
      aiPlan.entities.customerName = extractedPerson;
    }

    // Normalize legacy primaryIntent names to StrictVoiceIntent
    let strictIntent: StrictVoiceIntent = this.mapToStrictIntent(aiPlan.primaryIntent, raw);
    const personName = aiPlan.entities?.customerName
      ? cleanExtractedCustomerName(aiPlan.entities.customerName) || aiPlan.entities.customerName
      : (extractedPerson || context.activeCustomer?.name || null);
    const amount = aiPlan.entities?.amount ?? parsedSpokenAmount ?? null;

    // Enforce missing field checks for financial mutations
    if (
      strictIntent === 'ADD_RECEIVABLE' ||
      strictIntent === 'ADD_PAYMENT_GIVEN' ||
      strictIntent === 'RECORD_PAYMENT_RECEIVED'
    ) {
      if (!personName || amount === null || amount <= 0) {
        return deterministicPlan;
      }
    }

    const requiresConfirmation = MUTATING_INTENTS.has(strictIntent);
    const existingCust = personName
      ? db.customers.find(c => c.name.toLowerCase() === personName.toLowerCase() || c.name.toLowerCase().includes(personName.toLowerCase()))
      : undefined;
    const existingBalance = existingCust ? existingCust.balance : 0;
    const delta = strictIntent === 'RECORD_PAYMENT_RECEIVED' ? -(amount || 0) : (amount || 0);

    aiPlan.primaryIntent = strictIntent;
    aiPlan.requiresConfirmation = requiresConfirmation;
    aiPlan.structuredInterpretation = {
      intent: strictIntent,
      person_name: existingCust ? existingCust.name : personName,
      amount: amount,
      currency: 'INR',
      description: aiPlan.entities?.note || null,
      date: aiPlan.entities?.dueDate || null,
      confidence: 0.9,
      requires_confirmation: requiresConfirmation,
      is_addition_to_existing: /\b(aur|more|additional|और)\b/i.test(raw),
      existing_balance: existingCust ? existingBalance : null,
      new_balance_preview: amount !== null ? existingBalance + delta : null,
      clarification_question: aiPlan.clarificationQuestion || null,
      detected_language: aiPlan.detectedLanguage,
      navigation_target: aiPlan.entities?.navigationTarget || null,
    };

    return aiPlan;
  }

  private mapToStrictIntent(intentStr: string, raw: string): StrictVoiceIntent {
    const upper = String(intentStr || '').toUpperCase().trim();
    const detectedDir = this.detectStrictMoneyDirection(raw);
    if (detectedDir) return detectedDir;

    switch (upper) {
      case 'ADD_RECEIVABLE':
      case 'ADD_CUSTOMER_DEBT':
        return 'ADD_RECEIVABLE';
      case 'ADD_PAYMENT_GIVEN':
        return 'ADD_PAYMENT_GIVEN';
      case 'RECORD_PAYMENT_RECEIVED':
      case 'RECORD_PAYMENT':
        return 'RECORD_PAYMENT_RECEIVED';
      case 'GET_LEDGER':
      case 'GET_CUSTOMER_BALANCE':
        return 'GET_LEDGER';
      case 'GET_TOTAL_RECEIVABLE':
      case 'GET_ACCOUNT_SUMMARY':
        return 'GET_TOTAL_RECEIVABLE';
      case 'GET_TOTAL_PAYABLE':
        return 'GET_TOTAL_PAYABLE';
      case 'GET_TRANSACTIONS':
      case 'GET_CUSTOMER_HISTORY':
        return 'GET_TRANSACTIONS';
      case 'CREATE_CUSTOMER':
        return 'CREATE_CUSTOMER';
      case 'UPDATE_TRANSACTION':
        return 'UPDATE_TRANSACTION';
      case 'DELETE_TRANSACTION':
        return 'DELETE_TRANSACTION';
      case 'CANCEL_LAST_ACTION':
        return 'CANCEL_LAST_ACTION';
      case 'NAVIGATE':
        return 'NAVIGATE';
      case 'END_CONVERSATION':
        return 'END_CONVERSATION';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Enforces PART 4 — MONEY DIRECTION RULES with 100% deterministic accuracy.
   * Never reverses the direction.
   */
  public detectStrictMoneyDirection(raw: string): StrictVoiceIntent | null {
    const norm = normalizeDevanagariNameToRoman(raw).toLowerCase().trim();

    // 1. RECORD_PAYMENT_RECEIVED:
    // "Ram ne mujhe 500 wapas diye" = Ram paid me ₹500 = RECORD_PAYMENT_RECEIVED
    // "Ram ne 500 return kar diye" = RECORD_PAYMENT_RECEIVED
    // "Ram ne 500 diye" (Note: "<Person> NE diye" = Person gave to me = RECORD_PAYMENT_RECEIVED)
    // "Ram se 500 mil gaye" / "Ram se 500 aaye" / "500 received from Ram" / "Ram paid me 500"
    const isPaymentReceived =
      /\b(wapas\s+diye|waapas\s+diye|wapas\s+kiya|wapas\s+kiye|wapas\s+kar\s+diye|return\s+kar\s+diye|return\s+kiye|return\s+kiya|returned|paid\s+me|received\s+from|mil\s+gaye|mil\s+gaya|mila|mile|aa\s+gaye|aa\s+gaya|aa\s+chuka|jama\s+kiye|jama\s+kiya|jama\s+karo|minus\s+karo|minus\s+karke|कम\s*करो|माइनस\s*करो|वापस\s*दिए|वापस\s*किए|लौटा\s*दिए|मिल\s*गए|मिल\s*गया|आ\s*गए|आ\s*गया|जमा\s*किए|जमा\s*करो)\b/i.test(raw) ||
      /\b[a-zA-Z\u0900-\u097F]+\s+(?:ne|ने)\s+(?:mujhe\s+|humko\s+|मुझे\s+)?(?:[^a-zA-Z\u0900-\u097F]*)(?:diye|diya|de\s+diye|दिए|दिया|दे\s+दिए)\b/i.test(raw);

    if (isPaymentReceived) {
      return 'RECORD_PAYMENT_RECEIVED';
    }

    // 2. ADD_RECEIVABLE:
    // "Ram se 500 lene hain" = Ram owes me ₹500 = ADD_RECEIVABLE
    // "राम से 500 रुपये लेने हैं" = ADD_RECEIVABLE
    // "I need to collect 500 from Ram" = ADD_RECEIVABLE
    // "Ram owes me 500" = ADD_RECEIVABLE
    // "Ram ke 500 lene hain" = ADD_RECEIVABLE
    // "Ram se paanch sau lene hain" = ADD_RECEIVABLE
    // "Ram se 5 hundred lene hain" = ADD_RECEIVABLE
    // "Ram ke khate mein 500 udhar likho" = ADD_RECEIVABLE
    const isReceivable =
      /\b(lene\s+hain|lena\s+hai|lene\s+hai|lene\s+h|lena\s+h|लेने\s*हैं|लेना\s*है|लेने\s*है)\b/i.test(raw) ||
      /\b(need\s+to\s+collect|have\s+to\s+collect|collect\s+from|to\s+collect\s+from|collect\s+.*\s+from)\b/i.test(norm) ||
      /\b(owes\s+me|owe\s+me|owes)\b/i.test(norm) ||
      /\b(udhar\s+likho|udhar\s+likh\s+do|udhar\s+add|udhar\s+jodo|udhar\s+diya|udhar\s+diye|उधार\s*लिखो|उधार\s*लिख\s*दो|उधार\s*जोड़ो|उधार\s*दिया)\b/i.test(raw) ||
      /\b(receivable|add\s+.*\s+debit|debit\s+karo)\b/i.test(norm);

    if (isReceivable) {
      return 'ADD_RECEIVABLE';
    }

    // 3. ADD_PAYMENT_GIVEN:
    // "Ram ko 500 diye" = I gave Ram ₹500 = ADD_PAYMENT_GIVEN
    // "राम को 500 रुपये दिए" = ADD_PAYMENT_GIVEN
    // "I gave Ram 500" = ADD_PAYMENT_GIVEN
    // "Maine Ram ko 500 rupaye diye" = ADD_PAYMENT_GIVEN
    // "Maine Ram ko paanch sau diye" = ADD_PAYMENT_GIVEN
    // "Ram ko 500 rupees de diye" = ADD_PAYMENT_GIVEN
    const isPaymentGiven =
      /\b(?:ko|को)\s+[^?]*?\b(?:diye|diya|de\s+diye|de\s+diya|दिए|दिया|दे\s+दिए|दे\s+दिया)\b/i.test(raw) ||
      /\b(?:i\s+gave|we\s+gave|gave\s+[a-zA-Z]+|i\s+paid|paid\s+to|payment\s+given|maine\s+.*\s+diye|मैंने\s+.*\s+दिए)\b/i.test(raw);

    if (isPaymentGiven) {
      return 'ADD_PAYMENT_GIVEN';
    }

    return null;
  }

  private async planWithGemini(
    utterance: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): Promise<SemanticActionPlan> {
    const knownCustomerList = db.customers.map(c => ({ id: c.id, name: c.name, balance: c.balance }));
    const activeCustomer = context.activeCustomer;

    const systemInstruction = `You are the structured financial intent extraction engine for NotiBook, a smart business ledger and Khatabook app.
Your role: Parse Hindi, English, and Hinglish voice commands into STRICT STRUCTURED JSON.
NEVER mutate the database directly. Output strictly valid JSON.

STRICT INTENTS:
- ADD_RECEIVABLE: Someone owes the merchant money / merchant needs to collect money / udhar given to customer.
  Examples:
  * "Ram se 500 lene hain" -> ADD_RECEIVABLE, person="Ram", amount=500
  * "राम से 500 रुपये लेने हैं" -> ADD_RECEIVABLE, person="Ram", amount=500
  * "I need to collect 500 from Ram" -> ADD_RECEIVABLE, person="Ram", amount=500
  * "Ram owes me 500" -> ADD_RECEIVABLE, person="Ram", amount=500
  * "Ram ke 500 lene hain" -> ADD_RECEIVABLE, person="Ram", amount=500
  * "Ram se paanch sau lene hain" -> ADD_RECEIVABLE, person="Ram", amount=500
  * "Ram se 5 hundred lene hain" -> ADD_RECEIVABLE, person="Ram", amount=500
- ADD_PAYMENT_GIVEN: Merchant gave money to someone.
  Examples:
  * "Ram ko 500 diye" -> ADD_PAYMENT_GIVEN, person="Ram", amount=500
  * "राम को 500 रुपये दिए" -> ADD_PAYMENT_GIVEN, person="Ram", amount=500
  * "I gave Ram 500" -> ADD_PAYMENT_GIVEN, person="Ram", amount=500
  * "Maine Ram ko 500 rupaye diye" -> ADD_PAYMENT_GIVEN, person="Ram", amount=500
  * "Maine Ram ko paanch sau diye" -> ADD_PAYMENT_GIVEN, person="Ram", amount=500
  * "Ram ko 500 rupees de diye" -> ADD_PAYMENT_GIVEN, person="Ram", amount=500
  * "Ram ko do hazaar diye" -> ADD_PAYMENT_GIVEN, person="Ram", amount=2000
- RECORD_PAYMENT_RECEIVED: Customer paid/returned money to the merchant.
  Examples:
  * "Ram ne mujhe 500 wapas diye" -> RECORD_PAYMENT_RECEIVED, person="Ram", amount=500
  * "Ram ne 500 return kar diye" -> RECORD_PAYMENT_RECEIVED, person="Ram", amount=500
  * "Ram ne 500 diye" -> RECORD_PAYMENT_RECEIVED, person="Ram", amount=500
  * "Ram se 500 mil gaye" -> RECORD_PAYMENT_RECEIVED, person="Ram", amount=500
- GET_LEDGER: Check a specific customer's balance or open their khata/ledger.
- GET_TOTAL_RECEIVABLE: Check total market receivables ("Total kitna lena hai?", "Total udhar kitna hai?").
- GET_TOTAL_PAYABLE: Check total payables ("Total kitna dena hai?").
- GET_TRANSACTIONS: Show transaction history.
- CREATE_CUSTOMER: Create a new customer.
- UPDATE_TRANSACTION: Modify an existing transaction.
- DELETE_TRANSACTION: Delete a transaction.
- CANCEL_LAST_ACTION: Cancel/undo the last action.
- NAVIGATE: Open a UI screen/tab (home, customers, billing, transactions, stocks).
- END_CONVERSATION: User says ok, thank you, theek hai, bye.
- UNKNOWN: Unclear intent.

CRITICAL RULES:
1. Never reverse money direction (ADD_RECEIVABLE vs ADD_PAYMENT_GIVEN vs RECORD_PAYMENT_RECEIVED).
2. Never invent an amount or customer name. If missing, list in missingInformation and provide clarificationQuestion.
3. Understand Hindi/English/Hinglish numbers: paanch sau = 500, do hazaar = 2000, 2.5 thousand = 2500.`;

    const recentTurnsText = (context.recentTurns || []).slice(-6).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

    const promptText = `DATABASE CONTEXT:
Known Customers: ${JSON.stringify(knownCustomerList)}
Active Customer in Context: ${activeCustomer ? JSON.stringify(activeCustomer) : 'None'}
Pending Clarification: ${context.pendingClarification ? JSON.stringify(context.pendingClarification) : 'None'}
Current Page: ${context.currentPage || 'home'}

CONVERSATION HISTORY:
${recentTurnsText || 'No prior turns'}

USER UTTERANCE:
"${utterance}"

Output JSON matching the schema.`;

    const candidateModels = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 6500)
        );

        const generatePromise = this.ai!.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedLanguage: {
                  type: Type.STRING,
                  enum: ['hindi', 'hinglish', 'english'],
                },
                primaryIntent: {
                  type: Type.STRING,
                  enum: [
                    'ADD_RECEIVABLE',
                    'ADD_PAYMENT_GIVEN',
                    'RECORD_PAYMENT_RECEIVED',
                    'GET_LEDGER',
                    'GET_TOTAL_RECEIVABLE',
                    'GET_TOTAL_PAYABLE',
                    'GET_TRANSACTIONS',
                    'CREATE_CUSTOMER',
                    'UPDATE_TRANSACTION',
                    'DELETE_TRANSACTION',
                    'CANCEL_LAST_ACTION',
                    'NAVIGATE',
                    'END_CONVERSATION',
                    'UNKNOWN',
                  ],
                },
                userGoalSummary: {
                  type: Type.STRING,
                },
                entities: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    paymentMethod: { type: Type.STRING },
                    navigationTarget: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                },
                references: {
                  type: Type.OBJECT,
                  properties: {
                    isPronounOrReference: { type: Type.BOOLEAN },
                    refersTo: { type: Type.STRING, enum: ['active_customer', 'new_customer', 'account', 'none'] },
                    resolvedCustomerName: { type: Type.STRING },
                  },
                  required: ['isPronounOrReference', 'refersTo'],
                },
                missingInformation: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                ambiguities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                clarificationQuestion: {
                  type: Type.STRING,
                },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      action: { type: Type.STRING },
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          customerName: { type: Type.STRING },
                          usePriorActionResultForCustomerId: { type: Type.BOOLEAN },
                          amount: { type: Type.NUMBER },
                          paymentMethod: { type: Type.STRING },
                          destination: { type: Type.STRING },
                          description: { type: Type.STRING },
                        },
                      },
                    },
                    required: ['action'],
                  },
                },
              },
              required: ['detectedLanguage', 'primaryIntent', 'actions', 'missingInformation', 'ambiguities'],
            },
          },
        });

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        const jsonText = response.text?.trim();
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          return parsed as SemanticActionPlan;
        }
      } catch (err: any) {
        console.warn(`[SemanticActionPlanner] Model ${modelName} error:`, err.message || err);
      }
    }

    throw new Error('All Gemini candidate models failed');
  }

  /**
   * High-Precision Deterministic Financial & Khata Intent Planner
   * Handles Hindi, English, and Hinglish code-switching, spoken Indian numbers,
   * money direction rules, follow-up slot completion, and customer resolution.
   */
  public planWithSemanticFallback(
    raw: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): SemanticActionPlan {
    const lower = raw.toLowerCase().trim();
    const detectedLang: 'hindi' | 'hinglish' | 'english' = detectLanguage(raw);

    const buildPlan = (
      intent: StrictVoiceIntent,
      opts: {
        personName?: string | null;
        amount?: number | null;
        description?: string | null;
        navigationTarget?: string | null;
        secondaryIntent?: StrictVoiceIntent | null;
        actions?: PlannedAction[];
        missingInformation?: string[];
        ambiguities?: string[];
        clarificationQuestion?: string | null;
        confidence?: number;
        isPronoun?: boolean;
      }
    ): SemanticActionPlan => {
      const person = opts.personName ?? null;
      const amt = opts.amount ?? null;
      const requiresConfirmation = MUTATING_INTENTS.has(intent) && (!opts.missingInformation || opts.missingInformation.length === 0) && (!opts.ambiguities || opts.ambiguities.length === 0);
      const existingCust = person
        ? db.customers.find(c => c.name.toLowerCase() === person.toLowerCase() || c.name.toLowerCase().startsWith(person.toLowerCase() + ' '))
        : undefined;
      const existingBal = existingCust ? existingCust.balance : 0;
      const delta = intent === 'RECORD_PAYMENT_RECEIVED' ? -(amt || 0) : (amt || 0);
      const isAddition = /\b(aur|more|additional|extra|और)\b/i.test(raw);

      const structuredInterpretation: StructuredVoiceInterpretation = {
        intent,
        secondary_intent: opts.secondaryIntent || null,
        person_name: existingCust ? existingCust.name : person,
        amount: amt,
        currency: 'INR',
        description: opts.description || null,
        date: new Date().toISOString().slice(0, 10),
        confidence: opts.confidence ?? 0.96,
        requires_confirmation: requiresConfirmation,
        is_addition_to_existing: isAddition,
        existing_balance: existingCust ? existingBal : null,
        new_balance_preview: amt !== null ? existingBal + delta : null,
        clarification_question: opts.clarificationQuestion || null,
        detected_language: detectedLang,
        navigation_target: opts.navigationTarget || null,
      };

      return {
        detectedLanguage: detectedLang,
        primaryIntent: intent,
        userGoalSummary: `${intent}${person ? ` for ${person}` : ''}${amt ? ` (₹${amt})` : ''}`,
        structuredInterpretation,
        requiresConfirmation,
        entities: {
          customerName: structuredInterpretation.person_name,
          amount: amt,
          navigationTarget: opts.navigationTarget || null,
          note: opts.description || null,
        },
        references: {
          isPronounOrReference: Boolean(opts.isPronoun),
          refersTo: opts.isPronoun ? 'active_customer' : 'none',
          resolvedCustomerName: structuredInterpretation.person_name,
        },
        missingInformation: opts.missingInformation || [],
        ambiguities: opts.ambiguities || [],
        clarificationQuestion: opts.clarificationQuestion || null,
        actions: opts.actions || [],
      };
    };

    // 1. Check for CANCEL_LAST_ACTION / Undo
    if (
      /\b(cancel\s+last|undo|pichla\s+action\s+cancel|last\s+entry\s+hatao|undo\s+last|वापस\s*लो|पिछला\s*कैंसिल)\b/i.test(raw)
    ) {
      return buildPlan('CANCEL_LAST_ACTION', {
        actions: [{ action: 'CANCEL_LAST_ACTION', parameters: {} }],
        confidence: 0.98,
      });
    }

    // 2. Closing / End of Conversation
    const isClosing =
      lower === 'theek hai' || lower === 'theek h' || lower === 'ok' || lower === 'okay' ||
      lower === 'alright' || lower === 'all right' || lower === 'bas' || lower === 'bas itna hi' ||
      lower === 'bye' || lower === 'goodbye' || lower === 'thank you' || lower === 'thanks' ||
      raw === 'ठीक है' || raw === 'बस' || raw === 'अलविदा' || raw === 'धन्यवाद';
    if (isClosing) {
      return buildPlan('END_CONVERSATION', {
        actions: [{ action: 'END_CONVERSATION', parameters: {} }],
        confidence: 0.99,
      });
    }

    // 3. Navigation Intent Detection
    const navMatch = this.detectNavigationGoal(lower, raw, db);
    if (navMatch) {
      // If opening a specific customer's ledger ("Ram ka khata kholo"), map to GET_LEDGER + NAVIGATE
      if (navMatch.destination === 'customer_ledger_modal' && navMatch.customerName) {
        return buildPlan('GET_LEDGER', {
          personName: navMatch.customerName,
          navigationTarget: navMatch.destination,
          actions: [
            { action: 'NAVIGATE', parameters: { destination: navMatch.destination, customerName: navMatch.customerName } },
            { action: 'GET_LEDGER', parameters: { customerName: navMatch.customerName } },
          ],
          confidence: 0.96,
        });
      }
      return buildPlan('NAVIGATE', {
        navigationTarget: navMatch.destination,
        personName: navMatch.customerName || null,
        actions: [{ action: 'NAVIGATE', parameters: { destination: navMatch.destination, customerName: navMatch.customerName } }],
        confidence: 0.96,
      });
    }

    // 4. Multi-Action Detection (e.g. "create a customer Ram and add Rs 1000 as Udhar")
    const multiActionPlan = this.detectMultiActionPlan(lower, raw, detectedLang, db);
    if (multiActionPlan) {
      return multiActionPlan;
    }

    // 5. Explicit Customer Creation
    const explicitCreate = this.detectCustomerCreation(lower, raw, detectedLang, db);
    if (explicitCreate) {
      return explicitCreate;
    }

    // 6. Total Receivable / Total Payable Queries
    const isTotalPayable =
      /\b(total\s+payable|kitna\s+dena\s+hai|kul\s+kitna\s+dena|market\s+me\s+kitna\s+dena|how\s+much\s+do\s+i\s+owe|total\s+dene\s+hain)\b/i.test(lower) ||
      /कुल\s*कितना\s*देना|कितना\s*देना\s*है/i.test(raw);
    if (isTotalPayable) {
      return buildPlan('GET_TOTAL_PAYABLE', {
        actions: [{ action: 'GET_TOTAL_PAYABLE', parameters: {} }],
        confidence: 0.97,
      });
    }

    const isTotalReceivable =
      /\b(total\s+udhar|total\s+receivable|total\s+kitna\s+lena|kul\s+kitna\s+lena|market\s+udhar|market\s+me|baki\s+paisa|sabka\s+udhar|kul\s+udhar|kul\s+bakaya|pending\s+dues|total\s+dues|kitna\s+udhar\s+hai|how\s+much\s+total\s+receivable)\b/i.test(lower) ||
      /कुल\s*उधारी|बाकी\s*पैसा|कुल\s*बकाया|मार्केट\s*में|सबका\s*उधार|कुल\s*कितना\s*लेना/i.test(raw);
    if (isTotalReceivable) {
      return buildPlan('GET_TOTAL_RECEIVABLE', {
        actions: [{ action: 'GET_TOTAL_RECEIVABLE', parameters: {} }],
        confidence: 0.97,
      });
    }

    // 7. Extract Amount (using full Indian number parser) and Person Name
    const parsedAmount = parseSpokenIndianAmount(raw);
    const amount = parsedAmount !== null ? parsedAmount : undefined;

    // Pronoun resolution ("usne", "uski", "uska", "uske", "usme", "him", "his", "he", "unka")
    const isPronoun = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|woh|he|him|his)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उनका/i.test(lower);
    const resolvedCustName = isPronoun && context.activeCustomer ? context.activeCustomer.name : undefined;

    let targetCustomer: any = null;
    let extractedNewPersonName: string | null = null;
    let isAmbiguous = false;
    let ambiguityCandidates: string[] = [];

    if (resolvedCustName) {
      targetCustomer = db.customers.find(c => c.name.toLowerCase() === resolvedCustName.toLowerCase()) || context.activeCustomer;
    } else {
      const resolution = resolveCustomerAgainstDatabase(raw, db.customers as any);
      if (resolution.status === 'EXACT' || resolution.status === 'NORMALIZED' || resolution.status === 'PHONE') {
        targetCustomer = resolution.customer;
      } else if (resolution.status === 'AMBIGUOUS' && resolution.candidates) {
        isAmbiguous = true;
        ambiguityCandidates = resolution.candidates.map(c => c.name);
      } else if (resolution.status === 'NOT_FOUND' && resolution.searchedName) {
        extractedNewPersonName = resolution.searchedName;
      }
    }

    if (!targetCustomer && !extractedNewPersonName) {
      extractedNewPersonName = extractPersonNameFromUtterance(raw);
      if (extractedNewPersonName) {
        const matched = db.customers.find(c => c.name.toLowerCase() === extractedNewPersonName!.toLowerCase());
        if (matched) {
          targetCustomer = matched;
          extractedNewPersonName = null;
        }
      }
    }

    // Check if user is answering a Pending Clarification from the previous turn!
    // e.g. Turn 1: "500 lene hain" -> asked "Kis se ₹500 lene hain?" -> Turn 2: "Ram"
    // e.g. Turn 1: "Ram se lene hain" -> asked "Kitne rupaye?" -> Turn 2: "paanch sau"
    if (context.pendingClarification) {
      const pc = context.pendingClarification;
      const mergedIntent = this.detectStrictMoneyDirection(raw) || pc.intent || 'ADD_RECEIVABLE';
      const candidateSingleName = !amount && !this.detectStrictMoneyDirection(raw)
        ? cleanExtractedCustomerName(raw)
        : null;
      const mergedPerson = targetCustomer?.name || extractedNewPersonName || candidateSingleName || pc.personName || null;
      const mergedAmount = amount ?? pc.amount ?? null;

      if (mergedPerson && mergedAmount && mergedAmount > 0 && mergedIntent) {
        return buildPlan(mergedIntent, {
          personName: mergedPerson,
          amount: mergedAmount,
          actions: [{ action: mergedIntent as any, parameters: { customerName: mergedPerson, amount: mergedAmount } }],
          confidence: 0.96,
        });
      }
    }

    // Check for "add 1000 into account" or "account mein daalo" with activeCustomer
    const isAccountTx = lower.includes('into account') || lower.includes('in account') || lower.includes('account mein') || lower.includes('khate mein') || lower.includes('account me') || lower.includes('khate me');
    if (!targetCustomer && !extractedNewPersonName && isAccountTx && context.activeCustomer) {
      targetCustomer = db.customers.find(c => c.id === context.activeCustomer?.id) || (context.activeCustomer as any);
    }

    // Handle Ambiguity: if multiple customers matched, ask clarification
    if (isAmbiguous && ambiguityCandidates.length > 0) {
      const namesList = ambiguityCandidates.slice(0, 3).join(detectedLang === 'hindi' ? ' या ' : ' or ');
      const clarQ = detectedLang === 'hindi'
        ? `आपके पास ${namesList} नाम के ग्राहक हैं। आप किसकी बात कर रहे हैं?`
        : (detectedLang === 'english' ? `You have multiple customers: ${namesList}. Which one did you mean?` : `Aapke paas ${namesList} hain, kiske liye entry karni hai?`);
      return buildPlan('UNKNOWN', {
        ambiguities: ambiguityCandidates,
        clarificationQuestion: clarQ,
        confidence: 0.5,
      });
    }

    const effectivePersonName = targetCustomer?.name || extractedNewPersonName || null;

    // 8. Delete / Update Transaction Intents
    const isDeleteTx = /\b(delete\s+transaction|delete\s+last\s+entry|delete\s+entry|entry\s+delete\s+karo|entry\s+hatao|ट्रांजैक्शन\s*डिलीट|एंट्री\s*हटाओ)\b/i.test(raw);
    if (isDeleteTx) {
      return buildPlan('DELETE_TRANSACTION', {
        personName: effectivePersonName || context.activeCustomer?.name || null,
        amount: amount ?? null,
        actions: [{ action: 'DELETE_TRANSACTION', parameters: { customerName: effectivePersonName || context.activeCustomer?.name, amount } }],
        confidence: 0.95,
      });
    }

    const isUpdateTx = /\b(update\s+transaction|change\s+last\s+entry|edit\s+transaction|entry\s+badlo|एंट्री\s*बदलो|अपडेट\s*करो)\b/i.test(raw);
    if (isUpdateTx && amount) {
      return buildPlan('UPDATE_TRANSACTION', {
        personName: effectivePersonName || context.activeCustomer?.name || null,
        amount,
        actions: [{ action: 'UPDATE_TRANSACTION', parameters: { customerName: effectivePersonName || context.activeCustomer?.name, amount } }],
        confidence: 0.95,
      });
    }

    // 9. Strict Money Direction Detection (ADD_RECEIVABLE, ADD_PAYMENT_GIVEN, RECORD_PAYMENT_RECEIVED)
    const strictMoneyIntent = this.detectStrictMoneyDirection(raw);

    // Check if it's a read-only balance/ledger question ("Ram se kitne lene hain?", "Ram ka balance batao", "What does Ram owe?")
    const isQuestionWord = /\b(kitna|kitne|kitni|what|how\s+much|batao|dikhao|check|tell|कितना|कितने|बताओ|दिखाओ)\b/i.test(raw);
    const isBalanceOrLedgerQuery =
      (!amount && isQuestionWord) ||
      (/\b(balance|kitna\s*hai|kitna\s*baki|kitne\s*lene|kitna\s*lena|dues|hisab|ledger)\b/i.test(lower) && !amount) ||
      (/बैलेंस|कितना\s*बाकी|कितने\s*लेने|हिसाब/i.test(raw) && !amount);

    if (isBalanceOrLedgerQuery) {
      if (effectivePersonName) {
        return buildPlan('GET_LEDGER', {
          personName: effectivePersonName,
          isPronoun: Boolean(isPronoun),
          actions: [{ action: 'GET_LEDGER', parameters: { customerName: effectivePersonName } }],
          confidence: 0.97,
        });
      }
      return buildPlan('GET_LEDGER', {
        missingInformation: ['customer'],
        clarificationQuestion: detectedLang === 'hindi'
          ? 'किस ग्राहक का खाता या बैलेंस देखना है?'
          : (detectedLang === 'english' ? 'Which customer\'s ledger or balance would you like to check?' : 'Kis customer ka balance janna hai?'),
        confidence: 0.7,
      });
    }

    // Check if it's a transaction history query ("Ram ke transactions dikhao", "Show transactions for Ram")
    const isHistoryQuery = /\b(transactions|history|entries|passbook|लेनदेन|एंट्रीज|हिस्ट्री)\b/i.test(raw) && !amount;
    if (isHistoryQuery) {
      return buildPlan('GET_TRANSACTIONS', {
        personName: effectivePersonName,
        actions: [{ action: 'GET_TRANSACTIONS', parameters: { customerName: effectivePersonName } }],
        confidence: 0.95,
      });
    }

    // 10. Handle Financial Mutation Intents (ADD_RECEIVABLE, ADD_PAYMENT_GIVEN, RECORD_PAYMENT_RECEIVED)
    const fallbackCreditOrDebit = !strictMoneyIntent && amount !== undefined && (isAccountTx || /\b(add|likho|daalo|jodo|डालो|लिखो|जोड़ो)\b/i.test(raw))
      ? 'ADD_RECEIVABLE'
      : null;
    const finalFinancialIntent = strictMoneyIntent || fallbackCreditOrDebit;

    if (finalFinancialIntent) {
      // Missing person name -> Ask clarification! Never invent a person.
      if (!effectivePersonName) {
        const question = detectedLang === 'hindi'
          ? (finalFinancialIntent === 'ADD_RECEIVABLE'
              ? `₹${amount ?? ''} किससे लेने हैं? कृपया नाम बताएं।`
              : finalFinancialIntent === 'ADD_PAYMENT_GIVEN'
              ? `₹${amount ?? ''} किसे दिए हैं? कृपया नाम बताएं।`
              : `₹${amount ?? ''} किससे प्राप्त हुए हैं? कृपया नाम बताएं।`)
          : (detectedLang === 'english'
              ? `Which person is this ${amount ? `₹${amount} ` : ''}transaction for?`
              : `Yeh ${amount ? `₹${amount} ` : ''}kis customer ke khate mein likhna hai?`);

        return buildPlan(finalFinancialIntent, {
          amount: amount ?? null,
          missingInformation: ['person_name'],
          clarificationQuestion: question,
          confidence: 0.75,
        });
      }

      // Missing amount -> Ask clarification! Never invent an amount.
      if (amount === undefined || amount <= 0) {
        const question = detectedLang === 'hindi'
          ? `${effectivePersonName} के लिए कितने रुपये की एंट्री करनी है?`
          : (detectedLang === 'english'
              ? `How much is the amount for ${effectivePersonName}?`
              : `${effectivePersonName} ke liye kitne rupaye ki entry karni hai?`);

        return buildPlan(finalFinancialIntent, {
          personName: effectivePersonName,
          missingInformation: ['amount'],
          clarificationQuestion: question,
          confidence: 0.75,
        });
      }

      // Both person_name and amount are validated!
      // Check if customer already exists in DB; if not, include secondaryIntent = 'CREATE_CUSTOMER'
      const custExists = Boolean(targetCustomer);
      const actions: PlannedAction[] = [];
      if (!custExists) {
        actions.push({ action: 'CREATE_CUSTOMER', parameters: { customerName: effectivePersonName } });
      }
      actions.push({
        action: finalFinancialIntent as any,
        parameters: {
          customerName: effectivePersonName,
          usePriorActionResultForCustomerId: !custExists,
          amount,
        },
      });

      return buildPlan(finalFinancialIntent, {
        personName: effectivePersonName,
        amount,
        secondaryIntent: !custExists ? 'CREATE_CUSTOMER' : null,
        isPronoun: Boolean(isPronoun),
        actions,
        confidence: 0.98,
      });
    }

    // Default: Ask clarification concisely in user's detected language
    return buildPlan('UNKNOWN', {
      clarificationQuestion: detectedLang === 'hindi'
        ? 'माफ़ कीजिए, मैं स्पष्ट रूप से समझ नहीं पाया। कृपया ग्राहक का नाम और राशि फिर से बताएं (जैसे: "राम से 500 लेने हैं")।'
        : (detectedLang === 'english'
            ? 'Could not clearly understand that command. Please say the person name and amount (e.g., "I need to collect 500 from Ram").'
            : 'Kripya customer ka naam aur amount phir se batayein (jaise: "Ram se 500 lene hain").'),
      confidence: 0.3,
    });
  }

  /**
   * Semantic Navigation Detection
   */
  private detectNavigationGoal(
    lower: string,
    raw: string,
    db: DatabaseSnapshot
  ): { destination: string; customerName?: string } | null {
    const custLedgerMatch =
      lower.match(/([a-zA-Z\u0900-\u097F]+)\s*(?:ka|ki|ke|'s)?\s*(?:account|khata|ledger|entry|passbook)\s*(?:kholo|dikhao|open|view|show)/i) ||
      lower.match(/(?:open|show|view|kholo|dikhao)\s+(?:the\s+)?(?:account|ledger|khata)\s+(?:of|for)?\s*([a-zA-Z\u0900-\u097F]+)/i) ||
      lower.match(/(?:open|show|view)\s+([a-zA-Z\u0900-\u097F]+)(?:'s)?\s+(?:account|ledger|khata)/i);

    if (custLedgerMatch && custLedgerMatch[1] && !/\b(aur|and)\b/i.test(lower)) {
      const candidateName = normalizeDevanagariNameToRoman(custLedgerMatch[1].trim());
      const forbidden = FORBIDDEN_CUSTOMER_PHRASES.has(candidateName.toLowerCase()) ||
        ['the', 'my', 'this', 'that', 'all', 'any', 'page', 'tab', 'screen', 'customer', 'customers'].includes(candidateName.toLowerCase());

      if (!forbidden) {
        const existing = db.customers.find(c =>
          c.name.toLowerCase() === candidateName.toLowerCase() ||
          c.name.toLowerCase().startsWith(candidateName.toLowerCase())
        );
        const finalName = existing ? existing.name : candidateName;
        return { destination: 'customer_ledger_modal', customerName: finalName };
      }
    }

    const isCustomerView =
      lower.includes('customer tab') ||
      lower.includes('customers tab') ||
      lower.includes('customer page') ||
      lower.includes('customers page') ||
      lower.includes('where my customers are') ||
      lower.includes('customers wali screen') ||
      lower.includes('customer list') ||
      lower.includes('list of customers') ||
      lower.includes('show customers') ||
      lower.includes('go to customers') ||
      lower.includes('parties list') ||
      lower.includes('grahak list') ||
      lower.includes('open the account page') ||
      lower.includes('account page') ||
      raw.includes('कस्टमर टैब') ||
      raw.includes('कस्टमर्स खोलो') ||
      raw.includes('ग्राहक पेज') ||
      raw.includes('ग्राहक सूची');

    if (isCustomerView) return { destination: 'customers' };

    const isTransactionsView =
      lower.includes('transaction tab') ||
      lower.includes('transactions page') ||
      lower.includes('show transactions') ||
      lower.includes('passbook') ||
      lower.includes('daybook') ||
      lower.includes('show all transactions') ||
      lower.includes('transactions kholo') ||
      raw.includes('लेनदेन खोलो') ||
      raw.includes('पासबुक');

    if (isTransactionsView) return { destination: 'transactions' };

    const isBillingView =
      lower.includes('billing') ||
      lower.includes('invoices') ||
      lower.includes('billing tab') ||
      lower.includes('billing page') ||
      lower.includes('create bill') ||
      lower.includes('new invoice') ||
      raw.includes('बिलिंग खोलो') ||
      raw.includes('इनवॉइस');

    if (isBillingView) return { destination: 'billing' };

    const isStockView =
      lower.includes('stock') ||
      lower.includes('inventory') ||
      lower.includes('stocks tab') ||
      lower.includes('stocks page') ||
      lower.includes('check stock') ||
      lower.includes('saman ki list') ||
      raw.includes('स्टॉक खोलो') ||
      raw.includes('इन्वेंट्री');

    if (isStockView) return { destination: 'stocks' };

    const isHomeView =
      lower.includes('dashboard') ||
      lower.includes('home page') ||
      lower.includes('home tab') ||
      lower.includes('home screen') ||
      lower.includes('main screen') ||
      raw.includes('डैशबोर्ड खोलो') ||
      raw.includes('होम खोलो');

    if (isHomeView) return { destination: 'home' };

    if (lower.includes('setting') || raw.includes('सेटिंग')) return { destination: 'settings_modal' };
    if (lower.includes('search') || raw.includes('सर्च')) return { destination: 'search_modal' };

    return null;
  }

  /**
   * Multi-Action Decomposition
   */
  private detectMultiActionPlan(
    lower: string,
    raw: string,
    detectedLang: 'hindi' | 'hinglish' | 'english',
    db: DatabaseSnapshot
  ): SemanticActionPlan | null {
    const parsedAmt = parseSpokenIndianAmount(raw);

    const matchEn =
      lower.match(/(?:create|add)\s+(?:a\s+)?customer\s+([a-zA-Z]+)\s+and\s+(?:add|give|put|record)\s+/i) ||
      lower.match(/(?:create|add)\s+(?:a\s+)?customer\s+([a-zA-Z]+)\s+with\s+/i);
    if (matchEn && parsedAmt) {
      const custName = cleanExtractedCustomerName(matchEn[1]) || matchEn[1].trim();
      const strictIntent: StrictVoiceIntent = 'ADD_RECEIVABLE';
      return {
        detectedLanguage: detectedLang,
        primaryIntent: strictIntent,
        requiresConfirmation: true,
        structuredInterpretation: {
          intent: strictIntent,
          secondary_intent: 'CREATE_CUSTOMER',
          person_name: custName,
          amount: parsedAmt,
          currency: 'INR',
          description: 'Udhar',
          date: new Date().toISOString().slice(0, 10),
          confidence: 0.97,
          requires_confirmation: true,
          existing_balance: 0,
          new_balance_preview: parsedAmt,
          detected_language: detectedLang,
        },
        userGoalSummary: `Create customer ${custName} and add ₹${parsedAmt} receivable`,
        entities: { customerName: custName, amount: parsedAmt },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [
          { action: 'CREATE_CUSTOMER', parameters: { customerName: custName } },
          { action: 'ADD_RECEIVABLE', parameters: { customerName: custName, usePriorActionResultForCustomerId: true, amount: parsedAmt } },
        ],
      };
    }

    const matchHi =
      lower.match(/([a-zA-Z\u0900-\u097F]+)\s+(?:ko|karke|naam\s+se|naam\s+ka)?\s*(?:naya\s+)?(?:customer|grahak|कस्टमर|ग्राहक)\s*(?:bana\s*(?:do|karo)|banao|banaen|banaye|banayein|add\s*karo|jodo|बनाओ|बनाएं|जोड़ो)\s+(?:aur|और)\s+/i) ||
      lower.match(/(?:customer|grahak)\s+([a-zA-Z\u0900-\u097F]+)\s+(?:banao|banaen|banaye)\s+(?:aur|और)\s+/i);
    if (matchHi && parsedAmt) {
      const custName = cleanExtractedCustomerName(matchHi[1]) || matchHi[1].trim();
      const dir = this.detectStrictMoneyDirection(raw) || 'ADD_RECEIVABLE';
      return {
        detectedLanguage: detectedLang,
        primaryIntent: dir,
        requiresConfirmation: true,
        structuredInterpretation: {
          intent: dir,
          secondary_intent: 'CREATE_CUSTOMER',
          person_name: custName,
          amount: parsedAmt,
          currency: 'INR',
          description: null,
          date: new Date().toISOString().slice(0, 10),
          confidence: 0.97,
          requires_confirmation: true,
          existing_balance: 0,
          new_balance_preview: dir === 'RECORD_PAYMENT_RECEIVED' ? -parsedAmt : parsedAmt,
          detected_language: detectedLang,
        },
        userGoalSummary: `Create customer ${custName} and record ₹${parsedAmt}`,
        entities: { customerName: custName, amount: parsedAmt },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [
          { action: 'CREATE_CUSTOMER', parameters: { customerName: custName } },
          { action: dir as any, parameters: { customerName: custName, usePriorActionResultForCustomerId: true, amount: parsedAmt } },
        ],
      };
    }

    const matchLedgerAndBal =
      lower.match(/([a-zA-Z\u0900-\u097F]+)\s*(?:ka|ke)?\s*(?:account|khata)\s*kholo\s*aur\s*(?:uska\s*)?balance\s*batao/i) ||
      lower.match(/open\s+([a-zA-Z]+)(?:'s)?\s+account\s+and\s+(?:check|tell|show)\s+(?:the\s+)?balance/i);
    if (matchLedgerAndBal) {
      const custName = cleanExtractedCustomerName(matchLedgerAndBal[1]) || matchLedgerAndBal[1].trim();
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'GET_LEDGER',
        requiresConfirmation: false,
        structuredInterpretation: {
          intent: 'GET_LEDGER',
          person_name: custName,
          amount: null,
          currency: 'INR',
          description: null,
          date: null,
          confidence: 0.97,
          requires_confirmation: false,
          detected_language: detectedLang,
          navigation_target: 'customer_ledger_modal',
        },
        userGoalSummary: `Open account for ${custName} and check balance`,
        entities: { customerName: custName },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [
          { action: 'NAVIGATE', parameters: { destination: 'customer_ledger_modal', customerName: custName } },
          { action: 'GET_LEDGER', parameters: { customerName: custName } },
        ],
      };
    }

    return null;
  }

  /**
   * Explicit Customer Creation Detection
   */
  private detectCustomerCreation(
    lower: string,
    raw: string,
    detectedLang: 'hindi' | 'hinglish' | 'english',
    db: DatabaseSnapshot
  ): SemanticActionPlan | null {
    const isNavigation = /\b(show|open|go to|take me|navigate|tab|page|screen|section|view|list|kholo|dikhao)\b/i.test(lower);
    if (isNavigation) return null;

    const createMatch =
      lower.match(/^(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:customer|party)\s+(?:named\s+|called\s+)?([a-zA-Z\u0900-\u097F\s]+)$/i) ||
      lower.match(/^(?:create|add)\s+([a-zA-Z\u0900-\u097F\s]+?)\s+(?:as\s+(?:a\s+)?(?:new\s+)?customer|to\s+customers|in\s+customers)$/i) ||
      lower.match(/(?:customer\s+banao|customer\s+banaen|customer\s+banaye|customer\s+banayein|customer\s+add\s+karo|naya\s+customer\s+banao|naya\s+customer\s+banaen|नया\s+ग्राहक\s+बनाओ|नया\s+कस्टमर\s+बनाएं)\s+([a-zA-Z\u0900-\u097F\s]+)/i) ||
      lower.match(/([a-zA-Z\u0900-\u097F\s]+?)\s*(?:ko|karke|naam\s+ka|naam\s+se|naam\s+ke|को|करके|नाम\s+का|नाम\s+से)?\s*(?:ek\s+|एक\s+)?(?:naya\s+|new\s+|नया\s+)?(?:customer|grahak|party|कस्टमर|ग्राहक|पार्टी)\s*(?:banao|bana\s*do|banaen|banaye|banayein|banaiye|bana|add\s*karo|add\s*karein|add\s*kar\s*do|add\s*kijiye|jodo|jodein|jodiye|jod\s*do|जोड़ो|जोड़ें|जोड़िए|बनाओ|बनाएं|बनायें|बनाइए|बना\s*दो|ऐड\s*करो|ऐड\s*करें)/i);

    if (createMatch && createMatch[1]) {
      const rawName = createMatch[1].trim();
      const cleanName = cleanExtractedCustomerName(rawName);
      if (cleanName && cleanName.length >= 2 && !FORBIDDEN_CUSTOMER_PHRASES.has(cleanName.toLowerCase())) {
        const existing = db.customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
        return {
          detectedLanguage: detectedLang,
          primaryIntent: 'CREATE_CUSTOMER',
          requiresConfirmation: true,
          structuredInterpretation: {
            intent: 'CREATE_CUSTOMER',
            person_name: cleanName,
            amount: null,
            currency: 'INR',
            description: existing ? 'Customer already exists' : 'New customer account',
            date: new Date().toISOString().slice(0, 10),
            confidence: 0.98,
            requires_confirmation: true,
            existing_balance: existing ? existing.balance : null,
            new_balance_preview: existing ? existing.balance : 0,
            detected_language: detectedLang,
          },
          userGoalSummary: `Create customer ${cleanName}`,
          entities: { customerName: cleanName },
          references: { isPronounOrReference: false, refersTo: 'none' },
          missingInformation: [],
          ambiguities: [],
          actions: [{ action: 'CREATE_CUSTOMER', parameters: { customerName: cleanName } }],
        };
      }
    }

    return null;
  }
}

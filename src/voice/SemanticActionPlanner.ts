import { GoogleGenAI, Type } from '@google/genai';
import { ConversationContext, SemanticActionPlan, PlannedAction } from './types';
import { FORBIDDEN_CUSTOMER_PHRASES, normalizeCustomerName, resolveCustomerAgainstDatabase, cleanExtractedCustomerName } from './CustomerResolver';
import { detectLanguage } from './LanguageUtils';

export interface DatabaseSnapshot {
  customers: Array<{ id: string; name: string; balance: number; phone?: string }>;
  products: Array<{ id: string; name: string; stockQty: number; sellPrice: number }>;
  transactions: Array<{ id: string; partyName: string; amount: number; type: string; date: string }>;
  totalReceivables: number;
}

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
   * Generates a complete semantic action plan using Gemini 3.8 Flash
   */
  public async plan(
    userUtterance: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): Promise<SemanticActionPlan> {
    const raw = userUtterance.trim();

    // 1. Try Gemini AI Model first with deep semantic comprehension
    if (this.ai) {
      try {
        const aiPlan = await this.planWithGemini(raw, context, db);
        if (aiPlan && Array.isArray(aiPlan.actions)) {
          return aiPlan;
        }
      } catch (err: any) {
        console.warn('[SemanticActionPlanner] Gemini call failed, using semantic fallback:', err.message || err);
      }
    }

    // 2. High-precision semantic reasoning fallback
    return this.planWithSemanticFallback(raw, context, db);
  }

  private async planWithGemini(
    utterance: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): Promise<SemanticActionPlan> {
    const knownCustomerList = db.customers.map(c => ({ id: c.id, name: c.name, balance: c.balance }));
    const activeCustomer = context.activeCustomer;

    const systemInstruction = `You are the core semantic intelligence for NotiBook, a voice-enabled business ledger and Khatabook for merchants.
Your role: Comprehend the true MEANING and GOAL of the merchant's speech, resolve context and pronouns, and output a structured executable multi-action plan.

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. INTENT PRECEDES ENTITY EXTRACTION:
   - First determine: "What is the user trying to accomplish?"
   - Words like "tab", "page", "screen", "section", "view", "list", "sidebar", "menu", "account page" are UI concepts.
   - "show me the customer tab", "take me to where my customers are listed", "open customer page", "mujhe customers wali screen dikhao", "open customers":
     -> Intent: NAVIGATE
     -> Destination: "customers"
     -> customerName: null
     -> NEVER create any customer! "tab" is a UI word, NOT a customer.
   - "show transactions", "passbook dikhao", "take me to daybook":
     -> Intent: NAVIGATE -> destination: "transactions"
   - "open the account page", "account page kholo":
     -> Intent: NAVIGATE -> destination: "customers"
   - "open Ram's account", "Ram ka khata kholo", "Ram ka ledger kholo":
     -> Intent: NAVIGATE -> destination: "customer_ledger_modal", customerName: "Ram"
   - "show Ram's transactions":
     -> Intent: GET_CUSTOMER_HISTORY, customerName: "Ram"

2. CONTEXTUAL & PRONOUN RESOLUTION:
   - When user uses pronouns ("usne", "uski", "uska", "uske", "usme", "unka", "woh", "he", "him", "his", "that customer", "this account"):
     -> Must resolve to activeCustomer from context if available (${activeCustomer ? activeCustomer.name : 'None currently'}).
   - Follow-up requests without repeating the name:
     -> "add 1000 into account" or "1000 account mein daalo":
        If activeCustomer is present, resolve to that customer!
        If NO active customer is present in context, mark missingInformation: ["customer"] and ask clarification in detected language: "Kis customer ke account mein add karna hai?"
     -> "ab kitna baaki hai?" / "what does he owe now?":
        Resolve to activeCustomer balance.

3. MULTI-ACTION DECOMPOSITION & ACTION CHAINS:
   - Sentences can contain multiple actions that must execute in sequence:
     Example: "create a customer Ram and add Rs 1000 as Udhar"
     -> Action 1: CREATE_CUSTOMER (name: "Ram")
     -> Action 2: ADD_CUSTOMER_DEBT (customerName: "Ram", usePriorActionResultForCustomerId: true, amount: 1000, description: "Udhar")
     Example: "Ram ko customer bana do aur uske account mein 1000 likh do"
     -> Action 1: CREATE_CUSTOMER (name: "Ram")
     -> Action 2: ADD_CUSTOMER_DEBT (customerName: "Ram", usePriorActionResultForCustomerId: true, amount: 1000)
     Example: "Ram ka account kholo aur uska balance batao"
     -> Action 1: NAVIGATE (destination: "customer_ledger_modal", customerName: "Ram")
     -> Action 2: GET_CUSTOMER_BALANCE (customerName: "Ram")
     Example: "Ram ka khata kholo aur 500 jama karo"
     -> Action 1: NAVIGATE (destination: "customer_ledger_modal", customerName: "Ram")
     -> Action 2: RECORD_PAYMENT (customerName: "Ram", amount: 500)

4. FINANCIAL INTENT DISTINCTION:
   - RECORD_PAYMENT (Customer pays merchant -> customer balance DECREASES):
     "Ram ne 500 diye", "Ram se 500 mil gaye", "500 received from Ram", "Ram ka 500 payment aa gaya", "khate mein se 500 minus karo", "500 minus karke batao", "jama karo".
     CRITICAL: "MINUS" from khata / account ALWAYS means PAYMENT_RECEIVED (reduces debt)!
   - ADD_CUSTOMER_DEBT (Merchant gives goods or credit -> customer balance INCREASES):
     "Ram ko 1000 udhar diya", "Ram ke khate mein 1000 likh do", "Ram se 1000 lena hai", "1000 udhar likho", "1000 debit karo", "add 1000 into account".
   - GET_CUSTOMER_BALANCE:
     "Ram ka balance batao", "Ram ka kitna baaki hai?", "Ram se kitna lena hai?", "what does Ram owe?".
   - GET_ACCOUNT_SUMMARY:
     "Total udhar kitna hai", "Market me kitna baaki hai", "Sabka udhar batao", "Aaj kitna collection hua?".

5. CORRECTIONS & SELF-REPAIRS:
   - "Ram ko 500 add karo... sorry 1000" -> final amount: 1000.
   - "Rahul ka balance batao... nahi, Ramesh ka" -> final customer: Ramesh.

6. SAFETY & AMBIGUITY:
   - Never invent customer names, amounts, balances, or phone numbers.
   - If user says "Rahul ka balance batao" and multiple Rahuls exist in known customers (${JSON.stringify(knownCustomerList)}) without context, set ambiguities and ask: "Rahul Sharma ya Rahul Verma?".
   - If required info is missing (e.g. "Ramesh ne payment ki" without amount), ask: "Kitne rupaye receive hue?".

7. LANGUAGE:
   - Detect user language automatically: "hindi" | "english".
   - If the user speaks in Hindi (whether in Devanagari script OR Hindi words in Roman script like "Amit Verma ka balance batao" or "Prince karke customer banaen"), set detectedLanguage to "hindi" and write any clarificationQuestion in Hindi (Devanagari script).
   - If the user speaks in English (e.g. "What is Amit Verma's balance?", "Create customer Prince"), set detectedLanguage to "english" and write any clarificationQuestion in English.

Output strictly valid JSON matching the requested schema.`;

    const recentTurnsText = (context.recentTurns || []).slice(-6).map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n');

    const promptText = `DATABASE CONTEXT:
Known Customers: ${JSON.stringify(knownCustomerList)}
Active Customer in Context: ${activeCustomer ? JSON.stringify(activeCustomer) : 'None'}
Current Page: ${context.currentPage || 'home'}
Last Action: ${context.lastAction || 'None'}

CONVERSATION HISTORY:
${recentTurnsText || 'No prior turns'}

USER UTTERANCE:
"${utterance}"

Analyze semantic meaning, resolve references, plan sequential actions, and output JSON.`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 7500)
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
                  description: 'Language of user speech',
                },
                primaryIntent: {
                  type: Type.STRING,
                  description: 'High-level user goal (NAVIGATE, CREATE_CUSTOMER, ADD_CUSTOMER_DEBT, RECORD_PAYMENT, GET_CUSTOMER_BALANCE, GET_ACCOUNT_SUMMARY, GET_CUSTOMER_HISTORY, MULTI_ACTION, END_CONVERSATION, UNKNOWN)',
                },
                userGoalSummary: {
                  type: Type.STRING,
                  description: 'Short 1-sentence description of what user wants to achieve',
                },
                entities: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING, description: 'Clean customer name entity only, or null if none' },
                    amount: { type: Type.NUMBER, description: 'Financial amount provided by user' },
                    paymentMethod: { type: Type.STRING, description: 'Cash, UPI, Bank, Credit' },
                    navigationTarget: { type: Type.STRING, description: 'Target destination: home, customers, billing, transactions, stocks, settings_modal, search_modal, customer_ledger_modal, invoice_modal' },
                    productName: { type: Type.STRING, description: 'Item or product name if mentioned' },
                    quantity: { type: Type.NUMBER, description: 'Product quantity' },
                  },
                },
                references: {
                  type: Type.OBJECT,
                  properties: {
                    isPronounOrReference: { type: Type.BOOLEAN, description: 'True if user used pronoun or elliptical reference' },
                    refersTo: { type: Type.STRING, enum: ['active_customer', 'new_customer', 'account', 'none'] },
                    resolvedCustomerName: { type: Type.STRING, description: 'Name of customer resolved from context' },
                  },
                  required: ['isPronounOrReference', 'refersTo'],
                },
                missingInformation: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of missing required fields (e.g. amount, customer)',
                },
                ambiguities: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'List of ambiguous possibilities',
                },
                clarificationQuestion: {
                  type: Type.STRING,
                  description: 'Question to ask user if info is missing or ambiguous',
                },
                actions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: 'NAVIGATE, CREATE_CUSTOMER, ADD_CUSTOMER_DEBT, RECORD_PAYMENT, GET_CUSTOMER_BALANCE, GET_CUSTOMER_HISTORY, GET_ACCOUNT_SUMMARY, CREATE_SALE, MANAGE_STOCK, ADD_REMINDER, DELETE_CUSTOMER, DELETE_TRANSACTION, END_CONVERSATION, ASK_CLARIFICATION',
                      },
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          customerName: { type: Type.STRING },
                          usePriorActionResultForCustomerId: { type: Type.BOOLEAN, description: 'True if action should use customer ID from earlier action in this plan' },
                          amount: { type: Type.NUMBER },
                          paymentMethod: { type: Type.STRING },
                          destination: { type: Type.STRING },
                          description: { type: Type.STRING },
                          limit: { type: Type.NUMBER },
                          period: { type: Type.STRING },
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
   * Semantic Fallback Planner for when model calls fail or offline.
   * Strictly adheres to the core principles (Never treat UI words as customers, handles multi-actions, context).
   */
  private planWithSemanticFallback(
    raw: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): SemanticActionPlan {
    const lower = raw.toLowerCase().trim();

    // 1. Automatic Language Detection (Hindi vs English)
    const detectedLang: 'hindi' | 'hinglish' | 'english' = detectLanguage(raw);

    // 2. Closing / End of Conversation
    const isClosing = 
      lower === 'theek hai' || lower === 'theek h' || lower === 'ok' || lower === 'okay' ||
      lower === 'alright' || lower === 'all right' || lower === 'bas' || lower === 'bas itna hi' ||
      lower === 'bye' || lower === 'goodbye' || lower === 'thank you' || lower === 'thanks' ||
      raw === 'ठीक है' || raw === 'बस' || raw === 'अलविदा' || raw === 'धन्यवाद';
    if (isClosing) {
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'END_CONVERSATION',
        userGoalSummary: 'User acknowledges or wants to end conversation',
        entities: {},
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [{ action: 'END_CONVERSATION', parameters: {} }],
      };
    }

    // 3. Navigation Intent Detection (First-class citizen! "tab" / "page" / "screen")
    const navMatch = this.detectNavigationGoal(lower, raw, db);
    if (navMatch) {
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'NAVIGATE',
        userGoalSummary: `User wants to navigate to ${navMatch.destination}${navMatch.customerName ? ` for ${navMatch.customerName}` : ''}`,
        entities: { navigationTarget: navMatch.destination, customerName: navMatch.customerName },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [{ action: 'NAVIGATE', parameters: { destination: navMatch.destination, customerName: navMatch.customerName } }],
      };
    }

    // 4. Multi-Action Detection
    // e.g. "create a customer Ram and add Rs 1000 as Udhar"
    // e.g. "Ram ko customer banao aur 1000 rupaye udhar likho"
    // e.g. "Ram ka account kholo aur balance batao"
    const multiActionPlan = this.detectMultiActionPlan(lower, raw, detectedLang, db);
    if (multiActionPlan) {
      return multiActionPlan;
    }

    // 5. Explicit Customer Creation (Only when explicitly asked to create/add a person)
    const explicitCreate = this.detectCustomerCreation(lower, raw, detectedLang);
    if (explicitCreate) {
      return explicitCreate;
    }

    // 6. Total Market Dues / Account Summary
    const isAccountSummary = 
      /\b(total\s+udhar|market\s+udhar|market\s+me|baki\s+paisa|sabka\s+udhar|kul\s+udhar|kul\s+bakaya|pending\s+dues|total\s+dues|kitna\s+udhar\s+hai)\b/i.test(lower) ||
      /कुल\s*उधारी|बाकी\s*पैसा|कुल\s*बकाया|मार्केट\s*में|सबका\s*उधार/i.test(raw);
    if (isAccountSummary) {
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'GET_ACCOUNT_SUMMARY',
        userGoalSummary: 'Get total market dues across all customers',
        entities: {},
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [{ action: 'GET_ACCOUNT_SUMMARY', parameters: {} }],
      };
    }

    // 7. Amount extraction
    const amtMatch = raw.match(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|रुपये|रुपए)?/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : undefined;

    // 8. Pronoun check ("usne", "uski", "uska", "uske", "usme", "him", "his", "he", "unka", "unke", "unse")
    const isPronoun = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|woh|he|him|his)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उनका/i.test(lower);
    const resolvedCustName = isPronoun && context.activeCustomer ? context.activeCustomer.name : undefined;

    // 9. Match customer in database using high-precision resolver
    let targetCustomer: any = null;
    let isAmbiguous = false;
    let ambiguityCandidates: string[] = [];

    if (resolvedCustName) {
      targetCustomer = db.customers.find(c => c.name.toLowerCase() === resolvedCustName.toLowerCase());
    } else {
      const resolution = resolveCustomerAgainstDatabase(raw, db.customers as any);
      if (resolution.status === 'EXACT' || resolution.status === 'NORMALIZED' || resolution.status === 'PHONE') {
        targetCustomer = resolution.customer;
      } else if (resolution.status === 'AMBIGUOUS' && resolution.candidates) {
        isAmbiguous = true;
        ambiguityCandidates = resolution.candidates.map(c => c.name);
      }
    }

    // Check for "add 1000 into account" or "account mein daalo"
    const isAccountTx = lower.includes('into account') || lower.includes('in account') || lower.includes('account mein') || lower.includes('khate mein') || lower.includes('account me') || lower.includes('khate me');
    if (!targetCustomer && isAccountTx && context.activeCustomer) {
      targetCustomer = db.customers.find(c => c.id === context.activeCustomer?.id) || (context.activeCustomer as any);
    }

    // Handle Ambiguity: if multiple customers matched, ask clarification
    if (isAmbiguous && ambiguityCandidates.length > 0) {
      const namesList = ambiguityCandidates.slice(0, 3).join(detectedLang === 'hindi' ? ' या ' : ' or ');
      const clarQ = detectedLang === 'hindi' 
        ? `आपके पास ${namesList} नाम के ग्राहक हैं। आप किसकी बात कर रहे हैं?`
        : (detectedLang === 'english' ? `You have multiple customers: ${namesList}. Which one did you mean?` : `Aapke paas ${namesList} hain, kiske liye entry karni hai?`);
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'UNKNOWN',
        userGoalSummary: 'Ambiguous customer match',
        entities: {},
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: ambiguityCandidates,
        clarificationQuestion: clarQ,
        actions: [],
      };
    }

    // 10. Financial Action Intent
    const isMinus = /\b(minus|kam\s*karo|minus\s*karke|minus\s*karo)\b/i.test(lower) || /माइनस/i.test(raw);
    const isPayment = isMinus || /\b(aa\s*chuka|aa\s*gaya|mil\s*gaya|receive|jama|paid|de\s*diye|payment\s*kar\s*di)\b/i.test(lower) || /आ\s*गया|मिल\s*गया|जमा/i.test(raw);
    const isDebt = /\b(udhar|udhari|debit|le\s*gaya|samaan\s*diya|credit|add)\b/i.test(lower) || /उधार|डेबिट/i.test(raw);
    const isBalance = /\b(balance|kitna\s*hai|kitna\s*baki|dues|hisab)\b/i.test(lower) || /बैलेंस|कितना\s*बाकी/i.test(raw);

    // If Balance query
    if (isBalance && !amount) {
      if (targetCustomer) {
        return {
          detectedLanguage: detectedLang,
          primaryIntent: 'GET_CUSTOMER_BALANCE',
          userGoalSummary: `Get balance for ${targetCustomer.name}`,
          entities: { customerName: targetCustomer.name },
          references: { isPronounOrReference: Boolean(isPronoun), refersTo: isPronoun ? 'active_customer' : 'none', resolvedCustomerName: targetCustomer.name },
          missingInformation: [],
          ambiguities: [],
          actions: [{ action: 'GET_CUSTOMER_BALANCE', parameters: { customerName: targetCustomer.name } }],
        };
      }
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'GET_CUSTOMER_BALANCE',
        userGoalSummary: 'Balance query missing customer name',
        entities: {},
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: ['customer'],
        ambiguities: [],
        clarificationQuestion: detectedLang === 'hindi' ? 'किस कस्टमर का बैलेंस जानना है?' : (detectedLang === 'english' ? 'Which customer balance would you like to check?' : 'Kis customer ka balance janna hai?'),
        actions: [],
      };
    }

    // If Payment or Debt
    if (isPayment || isDebt || (amount !== undefined && isAccountTx)) {
      const actionType = isPayment ? 'RECORD_PAYMENT' : 'ADD_CUSTOMER_DEBT';

      // CRITICAL REQUIREMENT 7: If context does not have active_customer and user didn't name one,
      // ASK CLARIFICATION! DO NOT guess or invent or default to generic 'Customer'!
      if (!targetCustomer) {
        const question = detectedLang === 'hindi'
          ? 'किस कस्टमर के खाते में जोड़ना है?'
          : (detectedLang === 'english' ? 'Which customer\'s account should I add this to?' : 'Kis customer ke account mein add karna hai?');
        return {
          detectedLanguage: detectedLang,
          primaryIntent: actionType,
          userGoalSummary: 'Transaction missing customer context',
          entities: { amount },
          references: { isPronounOrReference: false, refersTo: 'none' },
          missingInformation: ['customer'],
          ambiguities: [],
          clarificationQuestion: question,
          actions: [],
        };
      }

      if (!amount) {
        return {
          detectedLanguage: detectedLang,
          primaryIntent: actionType,
          userGoalSummary: 'Transaction missing amount',
          entities: { customerName: targetCustomer?.name },
          references: { isPronounOrReference: Boolean(isPronoun), refersTo: isPronoun ? 'active_customer' : 'none' },
          missingInformation: ['amount'],
          ambiguities: [],
          clarificationQuestion: detectedLang === 'hindi' ? 'कितने रुपये की एंट्री करनी है?' : (detectedLang === 'english' ? 'What is the transaction amount?' : 'Kitne rupaye ki entry karni hai?'),
          actions: [],
        };
      }

      const custName = targetCustomer.name;
      return {
        detectedLanguage: detectedLang,
        primaryIntent: actionType,
        userGoalSummary: `${actionType === 'RECORD_PAYMENT' ? 'Record payment' : 'Record credit'} of ₹${amount} for ${custName}`,
        entities: { customerName: custName, amount },
        references: { isPronounOrReference: Boolean(isPronoun), refersTo: isPronoun ? 'active_customer' : 'none', resolvedCustomerName: custName },
        missingInformation: [],
        ambiguities: [],
        actions: [{ action: actionType, parameters: { customerName: custName, amount } }],
      };
    }

    // Default: Ask clarification concisely in user's detected language
    return {
      detectedLanguage: detectedLang,
      primaryIntent: 'UNKNOWN',
      userGoalSummary: 'Could not determine intent',
      entities: {},
      references: { isPronounOrReference: false, refersTo: 'none' },
      missingInformation: [],
      ambiguities: [],
      clarificationQuestion: detectedLang === 'hindi' ? 'जी बताइए, क्या सहायता करूँ?' : (detectedLang === 'english' ? 'How can I assist you with your ledger?' : 'Batayein, kya update karna hai?'),
      actions: [],
    };
  }

  /**
   * Semantic Navigation Detection
   * Understands arbitrary human phrases directing to UI views or specific customer ledgers.
   */
  private detectNavigationGoal(
    lower: string,
    raw: string,
    db: DatabaseSnapshot
  ): { destination: string; customerName?: string } | null {
    // 1. Specific customer ledger opening
    // e.g. "Ram ka account kholo", "Open Ram's account", "Open Ram's ledger", "Ram ka khata dikhao"
    const custLedgerMatch = 
      lower.match(/([a-zA-Z\u0900-\u097F]+)\s*(?:ka|ki|ke|'s)?\s*(?:account|khata|ledger|entry|passbook)\s*(?:kholo|dikhao|open|view|show)/i) ||
      lower.match(/(?:open|show|view|kholo|dikhao)\s+(?:the\s+)?(?:account|ledger|khata)\s+(?:of|for)?\s*([a-zA-Z\u0900-\u097F]+)/i) ||
      lower.match(/(?:open|show|view)\s+([a-zA-Z\u0900-\u097F]+)(?:'s)?\s+(?:account|ledger|khata)/i);

    if (custLedgerMatch && custLedgerMatch[1]) {
      const candidateName = custLedgerMatch[1].trim();
      const forbidden = FORBIDDEN_CUSTOMER_PHRASES.has(candidateName.toLowerCase()) || 
        ['the', 'my', 'this', 'that', 'all', 'any', 'page', 'tab', 'screen', 'customer', 'customers'].includes(candidateName.toLowerCase());
      
      if (!forbidden) {
        // Match against existing database if possible
        const existing = db.customers.find(c => 
          c.name.toLowerCase() === candidateName.toLowerCase() || 
          c.name.toLowerCase().startsWith(candidateName.toLowerCase())
        );
        const finalName = existing ? existing.name : candidateName;
        return { destination: 'customer_ledger_modal', customerName: finalName };
      }
    }

    // 2. Customers / Parties / Khata List View
    // "show me the customer tab", "take me to where my customers are listed", "open customer page", "mujhe customers wali screen dikhao", "open the account page"
    const isCustomerView = 
      lower.includes('customer tab') || 
      lower.includes('customers tab') || 
      lower.includes('customer page') || 
      lower.includes('customers page') || 
      lower.includes('where my customers are') ||
      lower.includes('where customers are') ||
      lower.includes('customers wali screen') ||
      lower.includes('customer list') ||
      lower.includes('list of customers') ||
      lower.includes('show customers') || 
      lower.includes('go to customers') || 
      lower.includes('see my customers') ||
      lower.includes('parties list') ||
      lower.includes('grahak list') ||
      lower.includes('open the account page') ||
      lower.includes('open account page') ||
      lower.includes('account page') ||
      lower.includes('accounts page') ||
      raw.includes('कस्टमर टैब') || 
      raw.includes('कस्टमर्स खोलो') ||
      raw.includes('ग्राहक पेज') ||
      raw.includes('ग्राहक सूची') ||
      raw.includes('खाता पेज');

    if (isCustomerView) {
      return { destination: 'customers' };
    }

    // 3. Transactions / Passbook View
    const isTransactionsView = 
      lower.includes('transaction tab') || 
      lower.includes('transactions page') || 
      lower.includes('show transactions') || 
      lower.includes('passbook') || 
      lower.includes('daybook') || 
      lower.includes('transaction history') ||
      lower.includes('show all transactions') ||
      lower.includes('transactions kholo') || 
      raw.includes('लेनदेन खोलो') ||
      raw.includes('पासबुक');

    if (isTransactionsView) {
      return { destination: 'transactions' };
    }

    // 4. Billing / Invoice View
    const isBillingView = 
      lower.includes('billing') || 
      lower.includes('invoices') || 
      lower.includes('billing tab') || 
      lower.includes('billing page') || 
      lower.includes('create bill') ||
      lower.includes('new invoice') ||
      raw.includes('बिलिंग खोलो') ||
      raw.includes('इनवॉइस');

    if (isBillingView) {
      return { destination: 'billing' };
    }

    // 5. Stocks / Inventory View
    const isStockView = 
      lower.includes('stock') || 
      lower.includes('inventory') || 
      lower.includes('stocks tab') || 
      lower.includes('stocks page') || 
      lower.includes('check stock') ||
      lower.includes('saman ki list') ||
      raw.includes('स्टॉक खोलो') ||
      raw.includes('इन्वेंट्री');

    if (isStockView) {
      return { destination: 'stocks' };
    }

    // 6. Home / Dashboard View
    const isHomeView = 
      lower.includes('dashboard') || 
      lower.includes('home page') || 
      lower.includes('home tab') || 
      lower.includes('home screen') || 
      lower.includes('main screen') ||
      raw.includes('डैशबोर्ड खोलो') || 
      raw.includes('होम खोलो');

    if (isHomeView) {
      return { destination: 'home' };
    }

    // 7. Settings / Search / Modals
    if (lower.includes('setting') || raw.includes('सेटिंग')) return { destination: 'settings_modal' };
    if (lower.includes('search') || raw.includes('सर्च')) return { destination: 'search_modal' };
    if (lower.includes('add customer modal') || lower.includes('customer form')) return { destination: 'add_customer_modal' };
    if (lower.includes('add transaction modal') || lower.includes('entry form')) return { destination: 'add_transaction_modal' };

    return null;
  }

  /**
   * Multi-Action Decomposition
   * e.g. "create a customer Ram and add Rs 1000 as Udhar"
   */
  private detectMultiActionPlan(
    lower: string,
    raw: string,
    detectedLang: 'hindi' | 'hinglish' | 'english',
    db: DatabaseSnapshot
  ): SemanticActionPlan | null {
    // English multi-action: "create [a] customer [Name] and add [Amount] as [udhar/credit/debt]"
    const matchEn = lower.match(/(?:create|add)\s+(?:a\s+)?customer\s+([a-zA-Z]+)\s+and\s+(?:add|give|put)\s+(?:rs\.?|inr|₹)?\s*(\d+)\s+as\s+(udhar|credit|debt)/i) ||
                    lower.match(/(?:create|add)\s+(?:a\s+)?customer\s+([a-zA-Z]+)\s+with\s+(?:rs\.?|inr|₹)?\s*(\d+)\s+(udhar|credit|debt|balance)/i);
    if (matchEn) {
      const custName = matchEn[1].trim();
      const amount = Number(matchEn[2]);
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'MULTI_ACTION',
        userGoalSummary: `Create customer ${custName} and record ₹${amount} debt`,
        entities: { customerName: custName, amount },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [
          { action: 'CREATE_CUSTOMER', parameters: { customerName: custName } },
          { action: 'ADD_CUSTOMER_DEBT', parameters: { customerName: custName, usePriorActionResultForCustomerId: true, amount } },
        ],
      };
    }

    // Hindi/Hinglish multi-action: "[Name] ko customer banao aur [Amount] udhar likho"
    const matchHi = lower.match(/([a-zA-Z\u0900-\u097F]+)\s+(?:ko|karke|naam\s+se|naam\s+ka)?\s*(?:naya\s+)?(?:customer|grahak|कस्टमर|ग्राहक)\s*(?:bana\s*(?:do|karo)|banao|banaen|banaye|banayein|add\s*karo|jodo|बनाओ|बनाएं|जोड़ो)\s+aur\s+(?:uske|usme)?\s*(?:account\s+mein\s+|khate\s+mein\s+)?(\d+)\s*(?:rupaye|rs)?\s*(?:udhar|likh|add|jod)/i) ||
                    lower.match(/(?:customer|grahak)\s+([a-zA-Z\u0900-\u097F]+)\s+(?:banao|banaen|banaye)\s+aur\s+(\d+)\s*(?:udhar|likh|add)/i);
    if (matchHi) {
      const custName = cleanExtractedCustomerName(matchHi[1]) || matchHi[1].trim();
      const amount = Number(matchHi[2]);
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'MULTI_ACTION',
        userGoalSummary: `Create customer ${custName} and record ₹${amount} debt`,
        entities: { customerName: custName, amount },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [
          { action: 'CREATE_CUSTOMER', parameters: { customerName: custName } },
          { action: 'ADD_CUSTOMER_DEBT', parameters: { customerName: custName, usePriorActionResultForCustomerId: true, amount } },
        ],
      };
    }

    // Ledger open + Balance check: "Ram ka account kholo aur balance batao"
    const matchLedgerAndBal = lower.match(/([a-zA-Z\u0900-\u097F]+)\s*(?:ka|ke)?\s*(?:account|khata)\s*kholo\s*aur\s*(?:uska\s*)?balance\s*batao/i) ||
                             lower.match(/open\s+([a-zA-Z]+)(?:'s)?\s+account\s+and\s+(?:check|tell|show)\s+(?:the\s+)?balance/i);
    if (matchLedgerAndBal) {
      const custName = matchLedgerAndBal[1].trim();
      return {
        detectedLanguage: detectedLang,
        primaryIntent: 'MULTI_ACTION',
        userGoalSummary: `Open account for ${custName} and check balance`,
        entities: { customerName: custName },
        references: { isPronounOrReference: false, refersTo: 'none' },
        missingInformation: [],
        ambiguities: [],
        actions: [
          { action: 'NAVIGATE', parameters: { destination: 'customer_ledger_modal', customerName: custName } },
          { action: 'GET_CUSTOMER_BALANCE', parameters: { customerName: custName } },
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
    detectedLang: 'hindi' | 'hinglish' | 'english'
  ): SemanticActionPlan | null {
    // Only triggers on explicit creation phrases, NEVER on navigation or general mention
    const isNavigation = /\b(show|open|go to|take me|navigate|tab|page|screen|section|view|list|kholo|dikhao)\b/i.test(lower);
    if (isNavigation) return null;

    const createMatch = 
      lower.match(/^(?:create|add|make)\s+(?:a\s+)?(?:new\s+)?(?:customer|party)\s+(?:named\s+|called\s+)?([a-zA-Z\u0900-\u097F\s]+)$/i) ||
      lower.match(/^(?:create|add)\s+([a-zA-Z\u0900-\u097F\s]+?)\s+(?:as\s+(?:a\s+)?(?:new\s+)?customer|to\s+customers|in\s+customers)$/i) ||
      lower.match(/(?:customer\s+banao|customer\s+banaen|customer\s+banaye|customer\s+banayein|customer\s+add\s+karo|naya\s+customer\s+banao|naya\s+customer\s+banaen|नया\s+ग्राहक\s+बनाओ|नया\s+कस्टमर\s+बनाएं)\s+([a-zA-Z\u0900-\u097F\s]+)/i) ||
      lower.match(/([a-zA-Z\u0900-\u097F\s]+?)\s*(?:ko|karke|naam\s+ka|naam\s+se|naam\s+ke|को|करके|नाम\s+का|नाम\s+से)?\s*(?:ek\s+|एक\s+)?(?:naya\s+|new\s+|नया\s+)?(?:customer|grahak|party|कस्टमर|ग्राहक|पार्टी)\s*(?:banao|bana\s*do|banaen|banaye|banayein|banaiye|bana|add\s*karo|add\s*karein|add\s*kar\s*do|add\s*kijiye|jodo|jodein|jodiye|jod\s*do|जोड़ो|जोड़ें|जोड़िए|बनाओ|बनाएं|बनायें|बनाइए|बना\s*दो|ऐड\s*करो|ऐड\s*करें)/i);

    if (createMatch && createMatch[1]) {
      const rawName = createMatch[1].trim();
      const cleanName = cleanExtractedCustomerName(rawName) || rawName.replace(/[^a-zA-Z\u0900-\u097F\s]/g, '').replace(/\s+(?:karke|ko|naam\s+ka|naam\s+se|naam|naya|new|करके|को|नाम)$/i, '').trim();
      if (cleanName && cleanName.length >= 2 && !FORBIDDEN_CUSTOMER_PHRASES.has(cleanName.toLowerCase())) {
        // Capitalize first letter of English names nicely
        const formattedName = /^[a-zA-Z\s]+$/.test(cleanName)
          ? cleanName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          : cleanName;
        return {
          detectedLanguage: detectedLang,
          primaryIntent: 'CREATE_CUSTOMER',
          userGoalSummary: `Create customer ${formattedName}`,
          entities: { customerName: formattedName },
          references: { isPronounOrReference: false, refersTo: 'none' },
          missingInformation: [],
          ambiguities: [],
          actions: [{ action: 'CREATE_CUSTOMER', parameters: { customerName: formattedName } }],
        };
      }
    }

    return null;
  }
}

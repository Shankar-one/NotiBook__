import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  ConversationContext,
  SemanticActionPlan,
  PlannedActionType,
  StrictVoiceIntent,
  PendingConfirmation,
} from './types';
import {
  resolveCustomerAgainstDatabase,
  cleanExtractedCustomerName,
} from './CustomerResolver';
import {
  parseSpokenIndianAmount,
  isConfirmationUtterance,
  isCancellationUtterance,
} from './LanguageUtils';

export interface DatabaseSnapshot {
  customers: Array<{ id: string; name: string; balance: number; phone?: string }>;
  products: Array<{ id: string; name: string; stockQty: number; sellPrice: number }>;
  transactions: Array<{
    id: string;
    partyName: string;
    amount: number;
    type: string;
    date: string;
    customerId?: string;
    description?: string;
  }>;
  totalReceivables: number;
  totalPayables?: number;
}

const FINANCIAL_CONFIRMATION_INTENTS = new Set<StrictVoiceIntent>([
  'ADD_RECEIVABLE',
  'ADD_PAYABLE',
  'ADD_PAYMENT_GIVEN',
  'RECORD_PAYMENT_RECEIVED',
  'UPDATE_TRANSACTION',
  'DELETE_TRANSACTION',
  'DELETE_CUSTOMER',
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
   * Phase 1 English-Only Semantic Understanding Pipeline:
   * 1. Gemini interprets the COMPLETE English utterance with full conversation & database context.
   * 2. Resolves pronouns ("his", "him", "he", "her", "their", "this customer") against context.activeCustomer.
   * 3. Validates entities against real database records without regex word-slicing.
   */
  public async plan(
    userUtterance: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): Promise<SemanticActionPlan> {
    const raw = userUtterance.trim();

    if (this.ai) {
      try {
        const aiPlan = await this.planWithGemini(raw, context, db);
        if (aiPlan) {
          return this.enrichAndValidateSemanticPlan(raw, aiPlan, context, db);
        }
      } catch (err: any) {
        console.warn('[SemanticActionPlanner] Gemini semantic planner error:', err.message || err);
      }
    }

    return this.planWhenOffline(raw, context);
  }

  /**
   * Generates a natural, truthful spoken English response grounded strictly in real database results
   * or the active pending confirmation state.
   */
  public async generateNaturalResponse(params: {
    userUtterance: string;
    plan: SemanticActionPlan;
    executionResults: any[];
    activeCustomer?: any;
    pendingConfirmation?: PendingConfirmation;
    userLang?: 'english' | 'hindi' | 'hinglish';
  }): Promise<string | null> {
    if (!this.ai) return null;

    const { userUtterance, plan, executionResults, activeCustomer, pendingConfirmation } = params;

    const prompt = `You are Jarvis, the conversational English voice assistant for NotiBook (a smart business ledger application).
Generate a concise, natural, conversational English spoken response (1 to 2 short sentences maximum).

STRICT RULES:
1. Ground your response ONLY in the ACTUAL DATABASE EXECUTION RESULTS or PENDING CONFIRMATION provided below.
2. NEVER invent balances, amounts, customer IDs, or claim an entry is saved if it is still awaiting confirmation.
3. If PENDING CONFIRMATION is present, clearly state the customer name, amount (in ₹), and whether it is a receivable or payable, and ask the user to confirm ("Confirm & Save" or say "Yes").
4. Output plain spoken English text only (no markdown, no asterisks, no bullet points).

USER UTTERANCE: "${userUtterance}"
INTENT: ${plan.primaryIntent}
ACTUAL DATABASE EXECUTION RESULTS: ${JSON.stringify(executionResults)}
ACTIVE CUSTOMER IN CONTEXT: ${activeCustomer ? JSON.stringify(activeCustomer) : 'None'}
PENDING CONFIRMATION (AWAITING USER APPROVAL): ${
      pendingConfirmation
        ? JSON.stringify({
            intent: pendingConfirmation.intent,
            personName: pendingConfirmation.personName,
            amount: pendingConfirmation.amount,
            existingBalance: pendingConfirmation.existingBalance,
            newBalancePreview: pendingConfirmation.newBalancePreview,
          })
        : 'None'
    }`;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Natural response timeout')), 4000)
      );
      const genPromise = this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const res: any = await Promise.race([genPromise, timeoutPromise]);
      const text = res.text?.trim().replace(/[*#`_]/g, '');
      if (text && text.length > 2) {
        return text;
      }
    } catch (e: any) {
      console.warn('[SemanticActionPlanner] Natural response generation warning:', e.message || e);
    }
    return null;
  }

  private async planWithGemini(
    utterance: string,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): Promise<SemanticActionPlan> {
    const knownCustomerList = db.customers.map(c => ({
      id: c.id,
      name: c.name,
      balance: c.balance,
    }));
    const activeCustomer = context.activeCustomer || null;
    const pendingConfirmation = context.pendingConfirmation || null;
    const pendingClarification = context.pendingClarification || null;

    const systemInstruction = `You are the core English semantic understanding engine for NotiBook, a voice-enabled business ledger application.
Your job is to understand the COMPLETE semantic meaning of arbitrary natural English sentences, resolve pronouns and conversation context, determine the structured intent, extract structured entities, and produce an ordered action plan.

SUPPORTED INTENTS:
- CREATE_CUSTOMER: Create a new customer record (e.g., "Create a customer called Ramesh", "Create a customer named Ramesh").
- GET_CUSTOMER: Retrieve profile/details of a customer.
- SEARCH_CUSTOMERS: Search or filter customers.
- UPDATE_CUSTOMER: Update customer details.
- DELETE_CUSTOMER: Delete a customer.
- ADD_RECEIVABLE: Record money that a customer owes the user / merchant needs to collect from the customer (e.g., "Add 1000 to Ramesh's account", "Add a thousand to his account", "I need to collect another 500 from Ramesh", "Ramesh owes me 750", "Put 1000 against Ramesh's account as money he owes me", "Record that Ramesh has to pay me another 1000").
- ADD_PAYABLE: Record money that the user owes to a customer (e.g., "I owe Ramesh 1000", "Add 1000 payable to Ramesh").
- ADD_PAYMENT_GIVEN: Record cash/payment the user gave to a customer ("I gave Ramesh 500").
- RECORD_PAYMENT_RECEIVED: Record payment received from a customer settling their balance ("Ramesh paid me 500", "Received 500 from Ramesh").
- GET_BALANCE: Check a customer's current balance or how much they owe (e.g., "Show me how much Ramesh still owes", "What's my current balance with Ramesh?").
- GET_TOTAL_RECEIVABLE: Total receivables across all customers.
- GET_TOTAL_PAYABLE: Total payables across all customers.
- GET_TRANSACTIONS: View transaction history for a customer or overall passbook.
- GET_LAST_TRANSACTION: View the latest/most recent transaction for a customer (e.g., "Show me Ramesh's latest transaction", "Show me his last transaction").
- UPDATE_TRANSACTION: Update an existing transaction.
- DELETE_TRANSACTION: Delete a transaction.
- NAVIGATE: Navigate to a section/page of the application (e.g., "Show me the customer tab", "Open the customer section", "Take me to customers", "Open customers", "I want to see my customers", "Go to the customers section" -> page="customers"; "Open billing" -> page="billing"; "Show transactions" -> page="transactions"; "Open stocks" -> page="stocks"; "Go home" -> page="home").
- MODIFY_PENDING: Modify the amount or customer of an active pending confirmation (e.g., "Actually make that 1500", "Change the amount to 1500").
- CONFIRM: Confirm and save the pending confirmation (e.g., "Yes, save it", "Confirm", "Yes please").
- CANCEL: Cancel or discard the pending confirmation (e.g., "Cancel that", "No, don't save").
- CANCEL_LAST_ACTION: Undo the last saved transaction.
- END_CONVERSATION: End the voice session (e.g., "Thank you, goodbye", "Stop listening").
- UNKNOWN: Utterance is unintelligible or unrelated.

CRITICAL SEMANTIC RULES:
1. UNDERSTAND COMPLETE MEANING, NEVER SLICE UI WORDS AS CUSTOMERS:
   - Never extract UI or grammar words like "tab", "section", "page", "screen", "account", "customer", "customers" as a customerName.
   - If the user says "Show me the customer tab", "Open the customer section", or "Take me to customers", set primaryIntent = "NAVIGATE", entities.page = "customers", entities.customerName = null, entities.amount = null.
   - Never interpret indefinite articles like "a" or "one" in "Create a customer" as amount = 1. Only extract amount when the user specifies an actual monetary value.
   - Spoken English quantities like "a thousand" or "another thousand" mean amount = 1000.

2. PRONOUN & MULTI-TURN CONTEXT RESOLUTION:
   - If the user uses a pronoun or reference ("his", "him", "he", "her", "their", "this customer", "that account") or omits the customer name in a follow-up command (e.g., "Add a thousand to his account", "Add 1000 to his account", "Show me his latest transaction"):
     Resolve it to Active Customer in Context (${activeCustomer ? JSON.stringify(activeCustomer) : 'None'}).
     Set entities.customerName = "${activeCustomer?.name || ''}" and entities.customerId = "${activeCustomer?.id || ''}".
   - Never ask "Which customer?" if Active Customer in Context resolves the reference.

3. MULTI-ACTION SENTENCES:
   - When a single sentence contains two actions, such as creating a customer and adding a receivable:
     e.g., "Create Ramesh as a customer and add 1000 to his account" or "Create Ramesh and record that he owes me 1000":
     Set primaryIntent = "ADD_RECEIVABLE", entities.customerName = "Ramesh", entities.amount = 1000,
     and output TWO sequential actions in the actions array:
     Action 1: { "action": "CREATE_CUSTOMER", "parameters": { "customerName": "Ramesh" } }
     Action 2: { "action": "ADD_RECEIVABLE", "parameters": { "customerName": "Ramesh", "usePriorActionResultForCustomerId": true, "amount": 1000 } }

4. PENDING CONFIRMATION UPDATES:
   - When Pending Confirmation is active (${
     pendingConfirmation
       ? JSON.stringify({
           intent: pendingConfirmation.intent,
           personName: pendingConfirmation.personName,
           amount: pendingConfirmation.amount,
         })
       : 'None'
   }):
     * If the user says "Actually make that 1500" or "Change it to 1500":
       Set primaryIntent = "MODIFY_PENDING", entities.amount = 1500, entities.customerName = "${pendingConfirmation?.personName || ''}",
       actions = [{ "action": "MODIFY_PENDING", "parameters": { "amount": 1500, "customerName": "${pendingConfirmation?.personName || ''}" } }]
     * If the user says "Yes, save it" or "Confirm":
       Set primaryIntent = "CONFIRM", actions = [{ "action": "CONFIRM", "parameters": {} }]
     * If the user says "Cancel that" or "No, don't save":
       Set primaryIntent = "CANCEL", actions = [{ "action": "CANCEL", "parameters": {} }]`;

    const recentTurnsText = (context.recentTurns || [])
      .slice(-8)
      .map(t => `${t.role.toUpperCase()}: ${t.text}`)
      .join('\n');

    const promptText = `DATABASE CONTEXT:
Known Customers: ${JSON.stringify(knownCustomerList)}
Total Market Receivables: ₹${db.totalReceivables}
Total Market Payables: ₹${db.totalPayables || 0}

CONVERSATION STATE:
Active Customer: ${activeCustomer ? JSON.stringify(activeCustomer) : 'None'}
Last Entity: ${context.lastEntity ? JSON.stringify(context.lastEntity) : 'None'}
Last Action: ${context.lastAction || 'None'}
Pending Confirmation: ${
      pendingConfirmation
        ? JSON.stringify({
            intent: pendingConfirmation.intent,
            personName: pendingConfirmation.personName,
            customerId: pendingConfirmation.customerId,
            amount: pendingConfirmation.amount,
          })
        : 'None'
    }
Pending Clarification: ${pendingClarification ? JSON.stringify(pendingClarification) : 'None'}
Current UI Page: ${context.currentPage || 'home'}

RECENT CONVERSATION TURNS:
${recentTurnsText || 'None'}

USER UTTERANCE:
"${utterance}"

Interpret the complete English utterance semantically and return strictly valid JSON.`;

    const candidateModels = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 8000)
        );

        const generatePromise = this.ai!.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedLanguage: {
                  type: Type.STRING,
                  enum: ['english'],
                },
                primaryIntent: {
                  type: Type.STRING,
                  enum: [
                    'CREATE_CUSTOMER',
                    'GET_CUSTOMER',
                    'SEARCH_CUSTOMERS',
                    'UPDATE_CUSTOMER',
                    'DELETE_CUSTOMER',
                    'ADD_RECEIVABLE',
                    'ADD_PAYABLE',
                    'ADD_PAYMENT_GIVEN',
                    'RECORD_PAYMENT_RECEIVED',
                    'GET_BALANCE',
                    'GET_TOTAL_RECEIVABLE',
                    'GET_TOTAL_PAYABLE',
                    'GET_TRANSACTIONS',
                    'GET_LAST_TRANSACTION',
                    'UPDATE_TRANSACTION',
                    'DELETE_TRANSACTION',
                    'NAVIGATE',
                    'MODIFY_PENDING',
                    'CONFIRM',
                    'CANCEL',
                    'CANCEL_LAST_ACTION',
                    'END_CONVERSATION',
                    'UNKNOWN',
                  ],
                },
                userGoalSummary: {
                  type: Type.STRING,
                },
                naturalResponseSuggestion: {
                  type: Type.STRING,
                },
                entities: {
                  type: Type.OBJECT,
                  properties: {
                    customerName: { type: Type.STRING, nullable: true },
                    customerId: { type: Type.STRING, nullable: true },
                    amount: { type: Type.NUMBER, nullable: true },
                    transactionType: { type: Type.STRING, nullable: true },
                    paymentMethod: { type: Type.STRING, nullable: true },
                    page: { type: Type.STRING, nullable: true },
                    navigationTarget: { type: Type.STRING, nullable: true },
                    description: { type: Type.STRING, nullable: true },
                    date: { type: Type.STRING, nullable: true },
                    time: { type: Type.STRING, nullable: true },
                    transactionId: { type: Type.STRING, nullable: true },
                  },
                },
                references: {
                  type: Type.OBJECT,
                  properties: {
                    isPronounOrReference: { type: Type.BOOLEAN },
                    refersTo: {
                      type: Type.STRING,
                      enum: ['active_customer', 'new_customer', 'account', 'pending_confirmation', 'none'],
                    },
                    resolvedCustomerName: { type: Type.STRING, nullable: true },
                    resolvedCustomerId: { type: Type.STRING, nullable: true },
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
                  nullable: true,
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
                          customerName: { type: Type.STRING, nullable: true },
                          customerId: { type: Type.STRING, nullable: true },
                          usePriorActionResultForCustomerId: { type: Type.BOOLEAN, nullable: true },
                          amount: { type: Type.NUMBER, nullable: true },
                          transactionType: { type: Type.STRING, nullable: true },
                          paymentMethod: { type: Type.STRING, nullable: true },
                          destination: { type: Type.STRING, nullable: true },
                          page: { type: Type.STRING, nullable: true },
                          description: { type: Type.STRING, nullable: true },
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
          parsed.detectedLanguage = 'english';
          return parsed as SemanticActionPlan;
        }
      } catch (err: any) {
        console.warn(`[SemanticActionPlanner] Model ${modelName} error:`, err.message || err);
      }
    }

    throw new Error('All Gemini candidate models failed');
  }

  /**
   * Validates Gemini's semantic plan against real database IDs and activeCustomer context.
   * Never uses regex sentence slicing to override Gemini.
   */
  private enrichAndValidateSemanticPlan(
    raw: string,
    aiPlan: SemanticActionPlan,
    context: ConversationContext,
    db: DatabaseSnapshot
  ): SemanticActionPlan {
    aiPlan.detectedLanguage = 'english';
    const intent = (aiPlan.primaryIntent || 'UNKNOWN') as StrictVoiceIntent;

    // 1. Validate NAVIGATE: never allow navigation to carry a customerName or amount
    if (intent === 'NAVIGATE') {
      const targetPage =
        aiPlan.entities?.page ||
        aiPlan.entities?.navigationTarget ||
        aiPlan.actions?.[0]?.parameters?.destination ||
        aiPlan.actions?.[0]?.parameters?.page ||
        'customers';
      aiPlan.entities = {
        ...aiPlan.entities,
        page: targetPage,
        navigationTarget: targetPage,
        customerName: null,
        amount: null,
      };
      aiPlan.requiresConfirmation = false;
      aiPlan.actions = [
        {
          action: 'NAVIGATE',
          parameters: { destination: targetPage, page: targetPage },
        },
      ];
      aiPlan.structuredInterpretation = {
        intent: 'NAVIGATE',
        customer_name: null,
        person_name: null,
        amount: null,
        currency: 'INR',
        description: null,
        date: null,
        page: targetPage,
        confidence: 0.98,
        requires_confirmation: false,
        detected_language: 'english',
        navigation_target: targetPage,
      };
      return aiPlan;
    }

    // 2. Validate amount: ensure non-financial intents never carry a stray amount
    const spokenAmount = parseSpokenIndianAmount(raw);
    let validatedAmount: number | null = aiPlan.entities?.amount ?? spokenAmount ?? null;
    const hasFinancialSubAction = aiPlan.actions?.some(a =>
      ['ADD_RECEIVABLE', 'ADD_PAYABLE', 'ADD_PAYMENT_GIVEN', 'RECORD_PAYMENT_RECEIVED'].includes(a.action)
    );
    if (
      (intent === 'CREATE_CUSTOMER' && !hasFinancialSubAction) ||
      ['GET_BALANCE', 'GET_LEDGER', 'GET_TRANSACTIONS', 'GET_LAST_TRANSACTION', 'GET_CUSTOMER', 'SEARCH_CUSTOMERS'].includes(intent)
    ) {
      validatedAmount = null;
    }

    // 3. Resolve customer against Active Customer context and real Database records
    let candidateName =
      aiPlan.entities?.customerName ||
      aiPlan.references?.resolvedCustomerName ||
      aiPlan.actions?.find(a => a.parameters?.customerName)?.parameters?.customerName ||
      null;

    if (candidateName) {
      candidateName = cleanExtractedCustomerName(candidateName) || null;
    }

    let resolvedCustomer: { id: string; name: string; balance: number; phone?: string } | undefined;
    if (candidateName) {
      const dbRes = resolveCustomerAgainstDatabase(candidateName, db.customers as any);
      if (dbRes.customer) {
        resolvedCustomer = dbRes.customer;
        candidateName = dbRes.customer.name;
      } else if (
        context.activeCustomer &&
        context.activeCustomer.name.toLowerCase() === candidateName.toLowerCase()
      ) {
        resolvedCustomer = {
          id: context.activeCustomer.id,
          name: context.activeCustomer.name,
          balance: context.activeCustomer.balance ?? 0,
          phone: context.activeCustomer.phone,
        };
        candidateName = context.activeCustomer.name;
      }
    } else if (
      context.activeCustomer &&
      (aiPlan.references?.isPronounOrReference ||
        /\b(his|him|he|her|their|that\s+customer|this\s+customer|his\s+account|their\s+account)\b/i.test(raw) ||
        [
          'ADD_RECEIVABLE',
          'ADD_PAYABLE',
          'ADD_PAYMENT_GIVEN',
          'RECORD_PAYMENT_RECEIVED',
          'GET_BALANCE',
          'GET_LEDGER',
          'GET_TRANSACTIONS',
          'GET_LAST_TRANSACTION',
        ].includes(intent))
    ) {
      const fromDb = db.customers.find(
        c =>
          c.id === context.activeCustomer!.id ||
          c.name.toLowerCase() === context.activeCustomer!.name.toLowerCase()
      );
      resolvedCustomer = fromDb || {
        id: context.activeCustomer.id,
        name: context.activeCustomer.name,
        balance: context.activeCustomer.balance ?? 0,
        phone: context.activeCustomer.phone,
      };
      candidateName = resolvedCustomer.name;
    }

    // 4. Validate required fields for CREATE_CUSTOMER
    if (intent === 'CREATE_CUSTOMER' && !candidateName) {
      aiPlan.missingInformation = ['customer'];
      aiPlan.requiresConfirmation = false;
      aiPlan.actions = [];
      if (!aiPlan.clarificationQuestion) {
        aiPlan.clarificationQuestion = 'What is the name of the customer you would like to create?';
      }
      return aiPlan;
    }

    // 5. Validate required fields for financial write intents
    if (FINANCIAL_CONFIRMATION_INTENTS.has(intent)) {
      const missing: string[] = [];
      if (!candidateName) missing.push('customer');
      if (
        ['ADD_RECEIVABLE', 'ADD_PAYABLE', 'ADD_PAYMENT_GIVEN', 'RECORD_PAYMENT_RECEIVED'].includes(intent) &&
        (validatedAmount === null || validatedAmount <= 0)
      ) {
        missing.push('amount');
      }

      if (missing.length > 0) {
        aiPlan.missingInformation = missing;
        aiPlan.requiresConfirmation = false;
        aiPlan.actions = [];
        if (!aiPlan.clarificationQuestion) {
          aiPlan.clarificationQuestion = missing.includes('customer')
            ? `Which customer's account should I record this ${validatedAmount ? `₹${validatedAmount} ` : ''}entry for?`
            : `What is the amount to record for ${candidateName}?`;
        }
        return aiPlan;
      }
    }

    const hasCreateAndTransaction =
      aiPlan.actions?.some(a => a.action === 'CREATE_CUSTOMER') &&
      aiPlan.actions?.some(a =>
        ['ADD_RECEIVABLE', 'ADD_PAYABLE', 'ADD_PAYMENT_GIVEN', 'RECORD_PAYMENT_RECEIVED'].includes(a.action)
      );

    const requiresConfirmation = FINANCIAL_CONFIRMATION_INTENTS.has(intent) || hasCreateAndTransaction;
    const existingBal = resolvedCustomer ? resolvedCustomer.balance : 0;
    const delta =
      intent === 'RECORD_PAYMENT_RECEIVED' || intent === 'ADD_PAYABLE'
        ? -(validatedAmount || 0)
        : validatedAmount || 0;

    aiPlan.requiresConfirmation = requiresConfirmation;
    aiPlan.entities = {
      ...aiPlan.entities,
      customerName: candidateName,
      customerId: resolvedCustomer?.id || aiPlan.entities?.customerId || null,
      amount: validatedAmount,
    };

    if (!aiPlan.actions || aiPlan.actions.length === 0) {
      if (intent !== 'UNKNOWN') {
        aiPlan.actions = [
          {
            action: intent as PlannedActionType,
            parameters: {
              customerName: candidateName,
              customerId: resolvedCustomer?.id || null,
              amount: validatedAmount,
              description: aiPlan.entities?.description || null,
              page: aiPlan.entities?.page || aiPlan.entities?.navigationTarget || null,
            },
          },
        ];
      }
    } else {
      aiPlan.actions = aiPlan.actions.map(act => ({
        ...act,
        parameters: {
          ...act.parameters,
          customerName: act.parameters?.customerName
            ? cleanExtractedCustomerName(act.parameters.customerName) || candidateName
            : candidateName,
          customerId: act.parameters?.customerId || resolvedCustomer?.id || null,
          amount:
            act.action === 'CREATE_CUSTOMER'
              ? null
              : act.parameters?.amount ?? validatedAmount,
        },
      }));
    }

    aiPlan.structuredInterpretation = {
      intent: hasCreateAndTransaction
        ? (aiPlan.actions.find(a => a.action !== 'CREATE_CUSTOMER')?.action as StrictVoiceIntent) || 'ADD_RECEIVABLE'
        : intent,
      secondary_intent: hasCreateAndTransaction ? 'CREATE_CUSTOMER' : null,
      customer_name: candidateName,
      person_name: candidateName,
      customer_id: resolvedCustomer?.id || null,
      amount: validatedAmount,
      currency: 'INR',
      transaction_type:
        intent === 'ADD_RECEIVABLE'
          ? 'receivable'
          : intent === 'ADD_PAYABLE'
          ? 'payable'
          : intent === 'RECORD_PAYMENT_RECEIVED'
          ? 'payment_received'
          : intent === 'ADD_PAYMENT_GIVEN'
          ? 'payment_given'
          : null,
      description: aiPlan.entities?.description || null,
      date: aiPlan.entities?.date || new Date().toISOString().slice(0, 10),
      time: aiPlan.entities?.time || null,
      transaction_id: aiPlan.entities?.transactionId || null,
      page: aiPlan.entities?.page || aiPlan.entities?.navigationTarget || null,
      confidence: 0.96,
      requires_confirmation: requiresConfirmation,
      is_addition_to_existing: /\b(another|more|additional)\b/i.test(raw),
      existing_balance: resolvedCustomer ? existingBal : null,
      new_balance_preview: validatedAmount !== null ? existingBal + delta : null,
      clarification_question: aiPlan.clarificationQuestion || null,
      detected_language: 'english',
      navigation_target: aiPlan.entities?.page || aiPlan.entities?.navigationTarget || null,
    };

    return aiPlan;
  }

  /**
   * Minimal offline safety handler when Gemini API is unreachable.
   */
  private planWhenOffline(raw: string, context: ConversationContext): SemanticActionPlan {
    if (context.pendingConfirmation) {
      if (isConfirmationUtterance(raw)) {
        return {
          detectedLanguage: 'english',
          primaryIntent: 'CONFIRM',
          userGoalSummary: 'Confirm pending action',
          requiresConfirmation: false,
          entities: {},
          references: { isPronounOrReference: false, refersTo: 'pending_confirmation' },
          missingInformation: [],
          ambiguities: [],
          actions: [{ action: 'CONFIRM', parameters: {} }],
        };
      }
      if (isCancellationUtterance(raw)) {
        return {
          detectedLanguage: 'english',
          primaryIntent: 'CANCEL',
          userGoalSummary: 'Cancel pending action',
          requiresConfirmation: false,
          entities: {},
          references: { isPronounOrReference: false, refersTo: 'pending_confirmation' },
          missingInformation: [],
          ambiguities: [],
          actions: [{ action: 'CANCEL', parameters: {} }],
        };
      }
    }

    return {
      detectedLanguage: 'english',
      primaryIntent: 'UNKNOWN',
      userGoalSummary: 'Unclear request',
      requiresConfirmation: false,
      entities: {},
      references: { isPronounOrReference: false, refersTo: 'none' },
      missingInformation: [],
      ambiguities: [],
      clarificationQuestion:
        'Could you please clarify the customer name and what action you would like to perform?',
      actions: [],
    };
  }
}

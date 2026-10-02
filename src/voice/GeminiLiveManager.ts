import { ActionRouter } from './ActionRouter';
import { ContextManager } from './ContextManager';
import { ConfirmationManager } from './ConfirmationManager';
import { Customer } from '../types';
import { fetchCustomers } from '../api/customers';
import { detectLanguage, UserLanguage, formatLocalizedResponse } from './LanguageUtils';
import { VoiceState, VoiceServerResponse } from './types';
import { SemanticActionPlanner, DatabaseSnapshot } from './SemanticActionPlanner';

export interface GeminiLiveCallbacks {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, lang?: UserLanguage) => void;
  onAudioOutput?: (base64Audio: string) => void;
  onError?: (errMessage: string) => void;
  onEndSession?: (farewellText: string, lang?: UserLanguage) => void;
}

export class GeminiLiveManager {
  private contextManager: ContextManager;
  private actionRouter: ActionRouter;
  private callbacks: GeminiLiveCallbacks;
  private isConnected: boolean = false;
  private currentDetectedLanguage: UserLanguage = 'hinglish';

  constructor(contextManager: ContextManager, actionRouter: ActionRouter, callbacks: GeminiLiveCallbacks = {}) {
    this.contextManager = contextManager;
    this.actionRouter = actionRouter;
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: GeminiLiveCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async connect(): Promise<void> {
    this.isConnected = true;
    this.callbacks.onStateChange?.('LISTENING');
  }

  public disconnect(): void {
    this.isConnected = false;
    this.callbacks.onStateChange?.('IDLE');
  }

  /**
   * Process user utterance through authoritative semantic interpretation pipeline.
   * Understands meaning, resolves references and pronouns, executes backend actions,
   * updates context, and speaks natural response in user's detected language.
   */
  public async sendUserInput(userInput: string): Promise<string> {
    const text = userInput.trim();
    if (!text) return '';

    // Continuous language detection on every turn
    const userLang = detectLanguage(text);
    this.currentDetectedLanguage = userLang;
    console.log(`[GeminiLive] Continuous Language Detection: "${text}" => [${userLang.toUpperCase()}]`);

    this.callbacks.onTranscript?.('user', text, userLang);
    this.contextManager.addTurn('user', text, userLang);
    this.callbacks.onStateChange?.('THINKING');

    // 1. Check for Pending Confirmation (e.g. destructive actions like deletion)
    const pendingConfirmation = this.contextManager.getPendingConfirmation();
    if (pendingConfirmation) {
      if (ConfirmationManager.isAffirmative(text)) {
        this.contextManager.clearPendingConfirmation();
        if (pendingConfirmation.action === 'delete_transaction') {
          const res = await this.actionRouter.deleteTransaction(pendingConfirmation.payload.transactionId, userLang);
          this.respond(res.responseText, userLang);
          return res.responseText;
        } else if (pendingConfirmation.action === 'delete_customer') {
          const res = await this.actionRouter.deleteCustomer(pendingConfirmation.payload.customerId, userLang);
          this.respond(res.responseText, userLang);
          return res.responseText;
        } else if (pendingConfirmation.action === 'delete_reminder') {
          const res = await this.actionRouter.deleteReminder(pendingConfirmation.payload.reminderId, userLang);
          this.respond(res.responseText, userLang);
          return res.responseText;
        }
      } else if (ConfirmationManager.isNegative(text)) {
        this.contextManager.clearPendingConfirmation();
        const cancelMsg = formatLocalizedResponse(userLang, {
          hindi: 'ठीक है, एक्शन कैंसिल कर दिया गया है।',
          hinglish: 'Theek hai, action cancel kar diya.',
          english: 'Action cancelled.',
        });
        this.respond(cancelMsg, userLang);
        return cancelMsg;
      }
    }

    // 2. Authoritative Server Call (Gemini 3.8 Flash Semantic Planner + Real Database Execution)
    try {
      const response = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userLanguage: userLang,
          context: this.contextManager.getContext(),
        }),
      });

      if (response.ok) {
        const data: VoiceServerResponse = await response.json();

        // Synchronize customer and transaction states from real database execution
        if (data.updatedCustomer) {
          this.contextManager.setActiveCustomer(data.updatedCustomer);
          this.actionRouter.notifyCustomerUpdated(data.updatedCustomer);
        }
        if (data.newTransaction) {
          this.contextManager.setActiveTransaction(data.newTransaction);
          this.actionRouter.notifyTransactionAdded(data.newTransaction);
        }
        if (data.updatedContext) {
          this.contextManager.updateFromContext(data.updatedContext);
        }

        // Execute frontend-specific effects (such as navigation or ending session)
        const toolCalls = data.toolCalls || (data.toolCall ? [data.toolCall] : []);
        for (const tc of toolCalls) {
          if (tc.name === 'navigate') {
            const target = tc.args.target || tc.args.destination || 'home';
            this.actionRouter.navigate(target, {
              customerName: tc.args.customerName,
            }, userLang);
          } else if (tc.name === 'end_conversation') {
            this.callbacks.onStateChange?.('ENDING');
            this.callbacks.onEndSession?.(data.reply, userLang);
          }
        }

        const replyText = data.reply && data.reply.trim() ? data.reply.trim() : 'Understood.';
        this.contextManager.addTurn('assistant', replyText, userLang);
        this.respond(replyText, userLang);
        return replyText;
      }
    } catch (err: any) {
      console.warn('[GeminiLive] Server endpoint fetch error, executing local semantic planner:', err.message || err);
    }

    // 3. Robust Local Semantic Planner Fallback (Zero fake data, strictly adheres to meaning)
    const knownCustomers: Customer[] = await fetchCustomers();
    const dbSnapshot: DatabaseSnapshot = {
      customers: knownCustomers.map(c => ({ id: c.id, name: c.name, balance: c.balance, phone: c.phone })),
      products: [],
      transactions: [],
      totalReceivables: knownCustomers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0),
    };

    const planner = new SemanticActionPlanner();
    const plan = await planner.plan(text, this.contextManager.getContext(), dbSnapshot);

    // If information is genuinely missing or ambiguous, ask concise question
    if (plan.clarificationQuestion) {
      this.contextManager.addTurn('assistant', plan.clarificationQuestion, userLang);
      this.respond(plan.clarificationQuestion, userLang);
      return plan.clarificationQuestion;
    }

    // Execute plan actions via actionRouter
    let lastReply = '';
    for (const item of plan.actions) {
      if (item.action === 'NAVIGATE') {
        const dest = item.parameters.destination || 'home';
        const res = this.actionRouter.navigate(dest, { customerName: item.parameters.customerName }, userLang);
        lastReply = res.responseText;
      } else if (item.action === 'CREATE_CUSTOMER') {
        const res = await this.actionRouter.addCustomer({ name: item.parameters.customerName, lang: userLang });
        this.contextManager.setActiveCustomer(res.customer);
        lastReply = res.responseText;
      } else if (item.action === 'ADD_CUSTOMER_DEBT') {
        const res = await this.actionRouter.addTransaction({
          customerNameOrId: item.parameters.customerName,
          amount: item.parameters.amount,
          transactionType: 'debit',
          lang: userLang,
        });
        if (res.customer) this.contextManager.setActiveCustomer(res.customer);
        lastReply = res.responseText;
      } else if (item.action === 'RECORD_PAYMENT') {
        const res = await this.actionRouter.addTransaction({
          customerNameOrId: item.parameters.customerName,
          amount: item.parameters.amount,
          transactionType: 'credit',
          lang: userLang,
        });
        if (res.customer) this.contextManager.setActiveCustomer(res.customer);
        lastReply = res.responseText;
      } else if (item.action === 'GET_CUSTOMER_BALANCE') {
        const res = await this.actionRouter.getBalance(item.parameters.customerName, userLang);
        this.contextManager.setActiveCustomer(res.customer);
        lastReply = res.statusText;
      } else if (item.action === 'GET_ACCOUNT_SUMMARY') {
        const res = await this.actionRouter.getAccountBalance(userLang);
        lastReply = res.responseText;
      } else if (item.action === 'END_CONVERSATION') {
        const res = this.actionRouter.endConversation(undefined, userLang);
        this.callbacks.onStateChange?.('ENDING');
        this.callbacks.onEndSession?.(res.responseText, userLang);
        lastReply = res.responseText;
      }
    }

    const finalReply = lastReply || formatLocalizedResponse(userLang, {
      hindi: 'जी समझ गया।',
      hinglish: 'Samajh gaya.',
      english: 'Understood.',
    });

    this.contextManager.addTurn('assistant', finalReply, userLang);
    this.respond(finalReply, userLang);
    return finalReply;
  }

  private respond(text: string, lang: UserLanguage = this.currentDetectedLanguage) {
    this.callbacks.onTranscript?.('assistant', text, lang);
    this.callbacks.onStateChange?.('SPEAKING');
  }
}

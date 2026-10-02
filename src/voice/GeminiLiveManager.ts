import { ActionRouter } from './ActionRouter';
import { ContextManager } from './ContextManager';
import { Customer } from '../types';
import { fetchCustomers } from '../api/customers';
import { detectLanguage, UserLanguage, formatLocalizedResponse, isConfirmationUtterance, isCancellationUtterance } from './LanguageUtils';
import { VoiceState, VoiceServerResponse, PendingConfirmation, StrictVoiceIntent } from './types';
import { SemanticActionPlanner, DatabaseSnapshot } from './SemanticActionPlanner';

export interface GeminiLiveCallbacks {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, lang?: UserLanguage) => void;
  onPendingConfirmationChange?: (pending: PendingConfirmation | null) => void;
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
   * Authoritatively confirms and saves the current pending confirmation to the backend/database.
   * Supports edited fields from the UI (✏️ Edit).
   */
  public async confirmPendingAction(
    editedFields?: Partial<PendingConfirmation>
  ): Promise<{ success: boolean; reply: string }> {
    const currentPending = this.contextManager.getPendingConfirmation();
    const confirmationToExecute: PendingConfirmation | undefined = currentPending
      ? { ...currentPending, ...editedFields }
      : (editedFields as PendingConfirmation | undefined);

    if (!confirmationToExecute || !confirmationToExecute.intent) {
      return { success: false, reply: 'No pending transaction to confirm.' };
    }

    const userLang: UserLanguage = confirmationToExecute.lang || this.currentDetectedLanguage;
    this.callbacks.onStateChange?.('THINKING');

    try {
      const response = await fetch('/api/voice/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: confirmationToExecute,
          context: this.contextManager.getContext(),
        }),
      });

      if (response.ok) {
        const data: VoiceServerResponse & { success?: boolean } = await response.json();

        this.contextManager.clearPendingConfirmation();
        this.callbacks.onPendingConfirmationChange?.(null);

        // Notify transaction first, then authoritative customer record so balance is never double-incremented
        if (data.newTransaction) {
          this.contextManager.setActiveTransaction(data.newTransaction);
          this.actionRouter.notifyTransactionAdded(data.newTransaction);
        }
        if (data.updatedCustomer) {
          this.contextManager.setActiveCustomer(data.updatedCustomer);
          this.actionRouter.notifyCustomerUpdated(data.updatedCustomer);
        }
        if (data.updatedContext) {
          this.contextManager.updateFromContext(data.updatedContext);
        }

        const toolCalls = data.toolCalls || (data.toolCall ? [data.toolCall] : []);
        for (const tc of toolCalls) {
          if (tc.name === 'delete_transaction' && tc.args?.id) {
            this.actionRouter. deleteTransaction(tc.args.id, userLang).catch(() => {});
          }
        }

        const replyText = data.reply && data.reply.trim() ? data.reply.trim() : 'Saved successfully.';
        const responseLang: UserLanguage =
          (data.updatedContext?.detectedLanguage as UserLanguage) ||
          detectLanguage(replyText) ||
          userLang;
        this.currentDetectedLanguage = responseLang;
        this.contextManager.addTurn('assistant', replyText, responseLang);
        this.respond(replyText, responseLang, false);
        return { success: true, reply: replyText };
      }
    } catch (err: any) {
      console.warn('[GeminiLive] /api/voice/confirm error, executing local fallback save:', err.message || err);
    }

    // Local fallback execution if server unreachable
    this.contextManager.clearPendingConfirmation();
    this.callbacks.onPendingConfirmationChange?.(null);

    const intent = confirmationToExecute.intent;
    const personName = confirmationToExecute.personName || 'Customer';
    const amount = Number(confirmationToExecute.amount) || 0;
    let replyText = '';

    if (intent === 'CREATE_CUSTOMER') {
      const res = await this.actionRouter.addCustomer({ name: personName, lang: userLang });
      if (res.customer) this.contextManager.setActiveCustomer(res.customer);
      replyText = res.responseText;
    } else if (intent === 'ADD_RECEIVABLE' || intent === 'ADD_PAYMENT_GIVEN') {
      const res = await this.actionRouter.addTransaction({
        customerNameOrId: personName,
        amount,
        transactionType: 'debit',
        description: confirmationToExecute.description || undefined,
        lang: userLang,
      });
      if (res.customer) this.contextManager.setActiveCustomer(res.customer);
      replyText = res.responseText;
    } else if (intent === 'RECORD_PAYMENT_RECEIVED') {
      const res = await this.actionRouter.addTransaction({
        customerNameOrId: personName,
        amount,
        transactionType: 'credit',
        description: confirmationToExecute.description || undefined,
        lang: userLang,
      });
      if (res.customer) this.contextManager.setActiveCustomer(res.customer);
      replyText = res.responseText;
    } else {
      replyText = userLang === 'english' ? 'Saved successfully.' : 'एंट्री सेव कर दी गई है।';
    }

    this.contextManager.addTurn('assistant', replyText, userLang);
    this.respond(replyText, userLang, false);
    return { success: true, reply: replyText };
  }

  /**
   * Cancels the current pending confirmation without modifying the database.
   */
  public async cancelPendingAction(): Promise<string> {
    const pending = this.contextManager.getPendingConfirmation();
    const lang: UserLanguage = pending?.lang || this.currentDetectedLanguage;
    this.contextManager.clearPendingConfirmation();
    this.callbacks.onPendingConfirmationChange?.(null);

    const cancelMsg = formatLocalizedResponse(lang, {
      hindi: 'ठीक है, यह एंट्री रद्द कर दी गई है। कोई बदलाव सेव नहीं हुआ।',
      hinglish: 'Theek hai, entry cancel kar di gayi hai.',
      english: 'Cancelled. No changes were saved.',
    });
    this.contextManager.addTurn('assistant', cancelMsg, lang);
    this.respond(cancelMsg, lang, false);
    return cancelMsg;
  }

  /**
   * Process user utterance through authoritative semantic interpretation pipeline.
   * Mutating intents return a PendingConfirmation and wait for human confirmation before saving.
   */
  public async sendUserInput(userInput: string): Promise<string> {
    const text = userInput.trim();
    if (!text) return '';

    const userLang = detectLanguage(text);
    this.currentDetectedLanguage = userLang;
    console.log(`[GeminiLive] Continuous Language Detection: "${text}" => [${userLang.toUpperCase()}]`);

    this.callbacks.onTranscript?.('user', text, userLang);
    this.contextManager.addTurn('user', text, userLang);
    this.callbacks.onStateChange?.('THINKING');

    // 1. Check if there is an active PendingConfirmation and user spoke a confirmation/cancellation phrase
    const pendingConfirmation = this.contextManager.getPendingConfirmation();
    if (pendingConfirmation) {
      if (isConfirmationUtterance(text)) {
        const result = await this.confirmPendingAction();
        return result.reply;
      }
      if (isCancellationUtterance(text)) {
        return await this.cancelPendingAction();
      }
    }

    // 2. Authoritative Server Call (Structured Intent Extraction + Validation)
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

        // Check if human confirmation is required before database mutation
        if (data.requiresConfirmation && data.pendingConfirmation) {
          if (data.updatedCustomer) {
            this.contextManager.setActiveCustomer(data.updatedCustomer);
            this.actionRouter.notifyCustomerUpdated(data.updatedCustomer);
          }
          this.contextManager.setPendingConfirmation(data.pendingConfirmation);
          if (data.updatedContext) {
            this.contextManager.updateFromContext(data.updatedContext);
          }
          this.callbacks.onPendingConfirmationChange?.(data.pendingConfirmation);

          const replyText = data.reply && data.reply.trim()
            ? data.reply.trim()
            : 'Please confirm to save this entry.';
          const responseLang: UserLanguage =
            data.pendingConfirmation.lang ||
            (data.updatedContext?.detectedLanguage as UserLanguage) ||
            userLang;
          this.currentDetectedLanguage = responseLang;
          this.contextManager.addTurn('assistant', replyText, responseLang);
          this.respond(replyText, responseLang, true);
          return replyText;
        }

        // If no confirmation required (or confirmation was just completed via voice):
        if (!data.requiresConfirmation) {
          this.contextManager.clearPendingConfirmation();
          this.callbacks.onPendingConfirmationChange?.(null);
        }

        // Notify transaction first, then customer record so balance is authoritative
        if (data.newTransaction) {
          this.contextManager.setActiveTransaction(data.newTransaction);
          this.actionRouter.notifyTransactionAdded(data.newTransaction);
        }
        if (data.updatedCustomer) {
          this.contextManager.setActiveCustomer(data.updatedCustomer);
          this.actionRouter.notifyCustomerUpdated(data.updatedCustomer);
        }
        if (data.updatedContext) {
          this.contextManager.updateFromContext(data.updatedContext);
        }

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
        const responseLang: UserLanguage =
          (data.updatedContext?.detectedLanguage as UserLanguage) ||
          (data.plan?.detectedLanguage as UserLanguage) ||
          detectLanguage(replyText) ||
          userLang;
        this.currentDetectedLanguage = responseLang;
        this.contextManager.addTurn('assistant', replyText, responseLang);
        this.respond(replyText, responseLang, false);
        return replyText;
      }
    } catch (err: any) {
      console.warn('[GeminiLive] Server endpoint fetch error, executing local semantic planner:', err.message || err);
    }

    // 3. Local Semantic Planner Fallback (Also enforces confirmation before mutating!)
    const knownCustomers: Customer[] = await fetchCustomers();
    const dbSnapshot: DatabaseSnapshot = {
      customers: knownCustomers.map(c => ({ id: c.id, name: c.name, balance: c.balance, phone: c.phone })),
      products: [],
      transactions: [],
      totalReceivables: knownCustomers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0),
    };

    const planner = new SemanticActionPlanner();
    const plan = await planner.plan(text, this.contextManager.getContext(), dbSnapshot);

    if (plan.clarificationQuestion) {
      this.contextManager.addTurn('assistant', plan.clarificationQuestion, userLang);
      this.respond(plan.clarificationQuestion, userLang, false);
      return plan.clarificationQuestion;
    }

    if (plan.requiresConfirmation && plan.structuredInterpretation) {
      const interp = plan.structuredInterpretation;
      const pending: PendingConfirmation = {
        id: `confirm-${Date.now()}`,
        action: 'execute_intent',
        intent: interp.intent as StrictVoiceIntent,
        secondaryIntent: interp.secondary_intent,
        personName: interp.person_name || 'Customer',
        amount: interp.amount,
        currency: 'INR',
        description: interp.description,
        paymentMode: 'Cash',
        existingBalance: interp.existing_balance ?? 0,
        newBalancePreview: interp.new_balance_preview ?? (interp.amount || 0),
        customerExists: interp.existing_balance !== null && interp.existing_balance !== undefined,
        payload: { plan, structuredInterpretation: interp },
        summaryTitle: interp.intent.replace(/_/g, ' '),
        message: userLang === 'english'
          ? `Confirm ${interp.intent.replace(/_/g, ' ')} for ${interp.person_name}${interp.amount ? ` (₹${interp.amount})` : ''}?`
          : `क्या आप ${interp.person_name} के लिए ${interp.amount ? `₹${interp.amount} ` : ''}सेव करना चाहते हैं?`,
        lang: userLang,
      };
      this.contextManager.setPendingConfirmation(pending);
      this.callbacks.onPendingConfirmationChange?.(pending);
      this.contextManager.addTurn('assistant', pending.message, userLang);
      this.respond(pending.message, userLang, true);
      return pending.message;
    }

    let lastReply = '';
    for (const item of plan.actions) {
      if (item.action === 'NAVIGATE') {
        const dest = item.parameters.destination || 'home';
        const res = this.actionRouter.navigate(dest, { customerName: item.parameters.customerName }, userLang);
        lastReply = res.responseText;
      } else if (item.action === 'GET_CUSTOMER_BALANCE' || item.action === 'GET_LEDGER') {
        const res = await this.actionRouter.getBalance(item.parameters.customerName, userLang);
        this.contextManager.setActiveCustomer(res.customer);
        lastReply = res.statusText;
      } else if (item.action === 'GET_ACCOUNT_SUMMARY' || item.action === 'GET_TOTAL_RECEIVABLE') {
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
    this.respond(finalReply, userLang, false);
    return finalReply;
  }

  private respond(
    text: string,
    lang: UserLanguage = this.currentDetectedLanguage,
    isWaitingForConfirmation: boolean = false
  ) {
    this.callbacks.onTranscript?.('assistant', text, lang);
    if (isWaitingForConfirmation) {
      this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');
    } else {
      this.callbacks.onStateChange?.('SPEAKING');
    }
  }
}

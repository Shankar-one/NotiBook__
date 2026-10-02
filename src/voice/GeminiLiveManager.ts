import { ActionRouter } from './ActionRouter';
import { ContextManager } from './ContextManager';
import { ConfirmationManager } from './ConfirmationManager';
import { Customer, Transaction } from '../types';
import { fetchCustomers } from '../api/customers';
import { fetchTransactions } from '../api/transactions';
import { detectLanguage, UserLanguage, formatLocalizedResponse } from './LanguageUtils';
import { 
  resolveCustomerAgainstDatabase, 
  detectFinancialIntent, 
  cleanExtractedCustomerName 
} from './CustomerResolver';
import { VoiceState } from './types';

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
  private ws: WebSocket | null = null;
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
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.callbacks.onStateChange?.('IDLE');
  }

  /**
   * Process user utterance with continuous language detection (Hindi / Hinglish / English).
   * Switches response language whenever the user switches language.
   */
  public async sendUserInput(userInput: string): Promise<string> {
    const text = userInput.trim();
    if (!text) return '';

    // Continuous language detection on every turn
    const userLang = detectLanguage(text);
    this.currentDetectedLanguage = userLang;
    console.log(`[GeminiLive] Continuous Language Detection: "${text}" => [${userLang.toUpperCase()}]`);

    this.callbacks.onTranscript?.('user', text, userLang);
    this.contextManager.addTurn('user', text);
    this.callbacks.onStateChange?.('THINKING');

    const knownCustomers: Customer[] = await fetchCustomers();

    // 1. Check for Pending Confirmation (e.g., delete confirmation)
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

    // 2. Check for Pending Slot-Filling
    const pendingSlot = this.contextManager.getPendingSlotFilling();
    if (pendingSlot) {
      if (pendingSlot.action === 'add_customer') {
        const rawName = text.replace(/^(naam|name|hai|is)\s*/i, '').trim();
        if (rawName) {
          this.contextManager.clearPendingSlotFilling();
          const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          const res = await this.actionRouter.addCustomer({ name: cleanName, lang: userLang });
          this.contextManager.setActiveCustomer(res.customer);
          this.respond(res.responseText, userLang);
          return res.responseText;
        }
      }

      if (pendingSlot.action === 'add_transaction') {
        const numMatch = text.match(/\d+/);
        if (pendingSlot.missingFields.includes('amount') && numMatch) {
          pendingSlot.gathered.amount = parseFloat(numMatch[0]);
          pendingSlot.missingFields = pendingSlot.missingFields.filter(f => f !== 'amount');

          if (pendingSlot.missingFields.includes('transaction_type')) {
            const askType = formatLocalizedResponse(userLang, {
              hindi: 'पैसे जमा (क्रेडिट) हुए हैं या उधार (डेबिट) दिए हैं?',
              hinglish: 'Paisa jama (credit) hua hai ya udhar (debit) diya hai?',
              english: 'Is this payment received (credit) or given on credit (debit)?',
            });
            this.contextManager.setPendingSlotFilling(pendingSlot);
            this.respond(askType, userLang);
            return askType;
          }
        }

        if (pendingSlot.missingFields.includes('transaction_type')) {
          if (text.toLowerCase().includes('credit') || text.includes('क्रेडिट') || text.toLowerCase().includes('jama') || text.includes('जमा')) {
            pendingSlot.gathered.transactionType = 'credit';
          } else if (text.toLowerCase().includes('debit') || text.includes('डेबिट') || text.toLowerCase().includes('udhar') || text.includes('उधार') || text.toLowerCase().includes('diya')) {
            pendingSlot.gathered.transactionType = 'debit';
          }

          if (pendingSlot.gathered.transactionType && pendingSlot.gathered.amount) {
            this.contextManager.clearPendingSlotFilling();
            const res = await this.actionRouter.addTransaction({
              customerNameOrId: pendingSlot.gathered.customerName,
              amount: pendingSlot.gathered.amount,
              transactionType: pendingSlot.gathered.transactionType,
              lang: userLang,
            });
            this.respond(res.responseText, userLang);
            return res.responseText;
          }
        }
      }
    }

    // 3. Ambiguous Customer Resolution
    const customerResolution = this.contextManager.resolveCustomer(text, knownCustomers);
    if (customerResolution.isAmbiguous && customerResolution.candidates && customerResolution.candidates.length > 1) {
      const names = customerResolution.candidates.map(c => c.name).join(userLang === 'hindi' ? ' या ' : (userLang === 'english' ? ' or ' : ' ya '));
      const disambiguationMsg = formatLocalizedResponse(userLang, {
        hindi: `क्या आप ${names} की बात कर रहे हैं?`,
        hinglish: `Kya aap ${names} ki baat kar rahe hain?`,
        english: `Did you mean ${names}?`,
      });
      this.respond(disambiguationMsg, userLang);
      return disambiguationMsg;
    }

    // 4. Call server-side conversational endpoint
    try {
      const response = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userLanguage: userLang,
          context: this.contextManager.getContext(),
          activeCustomer: customerResolution.customer ? {
            id: customerResolution.customer.id,
            name: customerResolution.customer.name,
            balance: customerResolution.customer.balance,
          } : this.contextManager.getActiveCustomer(),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Handle tool calls from Gemini
        if (data.toolCall) {
          const toolResult = await this.executeToolCall(data.toolCall, customerResolution.customer, userLang);
          this.respond(toolResult, userLang);
          return toolResult;
        }

        if (data.reply && data.reply.trim()) {
          if (customerResolution.customer) {
            this.contextManager.setActiveCustomer(customerResolution.customer);
          }
          this.respond(data.reply.trim(), userLang);
          return data.reply.trim();
        }
      }
    } catch (err) {
      console.warn('[GeminiLive] Server endpoint fetch error, using local fallback parser:', err);
    }

    // High-speed fallback natural language processing
    const localResult = await this.executeLocalFallback(text, customerResolution.customer, knownCustomers, userLang);
    this.respond(localResult, userLang);
    return localResult;
  }

  private async executeToolCall(
    toolCall: { name: string; args: any },
    resolvedCustomer?: Customer,
    userLang: UserLanguage = 'hinglish'
  ): Promise<string> {
    console.log('[GeminiLive] Executing tool call:', toolCall.name, toolCall.args, 'Language:', userLang);
    const { name, args } = toolCall;

    try {
      // 1. CUSTOMERS
      if (name === 'add_customer') {
        const custName = args.name || args.customer_name;
        const res = await this.actionRouter.addCustomer({
          name: custName,
          phone: args.phone,
          openingBalance: args.opening_balance,
          address: args.address,
          lang: userLang,
        });
        this.contextManager.setActiveCustomer(res.customer);
        return args.speech_response || res.responseText;
      }

      if (name === 'get_customer') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.getCustomer(custName, userLang);
        this.contextManager.setActiveCustomer(res.customer);
        return args.speech_response || res.responseText;
      }

      if (name === 'update_customer') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.updateCustomer({
          customerNameOrId: custName,
          phone: args.phone,
          address: args.address,
          lang: userLang,
        });
        this.contextManager.setActiveCustomer(res.customer);
        return args.speech_response || res.responseText;
      }

      if (name === 'delete_customer') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name || 'Customer';
        const all = await fetchCustomers();
        const cust = all.find(c => c.name.toLowerCase() === custName.toLowerCase()) || resolvedCustomer;
        this.contextManager.setPendingConfirmation({
          action: 'delete_customer',
          payload: { customerId: cust?.id || custName },
          message: custName,
          description: custName,
        });
        this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');
        return args.speech_response || ConfirmationManager.formatConfirmationPrompt(this.contextManager.getPendingConfirmation()!, userLang);
      }

      // 2. BALANCES
      if (name === 'get_balance') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        if (!custName) {
          return formatLocalizedResponse(userLang, {
            hindi: 'किस कस्टमर का बैलेंस जानना है?',
            hinglish: 'Kis customer ka balance janna hai?',
            english: 'Which customer would you like to check the balance for?',
          });
        }
        const res = await this.actionRouter.getBalance(custName, userLang);
        this.contextManager.setActiveCustomer(res.customer);
        return args.speech_response || res.statusText;
      }

      if (name === 'get_account_balance') {
        const res = await this.actionRouter.getAccountBalance(userLang);
        return args.speech_response || res.responseText;
      }

      // 3. TRANSACTIONS
      if (name === 'add_transaction') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        if (!args.amount) {
          this.contextManager.setPendingSlotFilling({
            action: 'add_transaction',
            missingFields: ['amount', !args.transaction_type ? 'transaction_type' : ''].filter(Boolean),
            gathered: { customerName: custName, transactionType: args.transaction_type },
            promptQuestion: 'Kitne rupaye?',
          });
          return formatLocalizedResponse(userLang, {
            hindi: 'कितने रुपये जोड़ना है?',
            hinglish: 'Kitne rupaye?',
            english: 'How much is the amount?',
          });
        }

        const res = await this.actionRouter.addTransaction({
          customerNameOrId: custName,
          amount: args.amount,
          transactionType: args.transaction_type || 'credit',
          paymentMode: args.payment_mode || 'Cash',
          description: args.description,
          lang: userLang,
        });

        if (res.customer) {
          this.contextManager.setActiveCustomer(res.customer);
        }
        if (res.transaction) {
          this.contextManager.setActiveTransaction({
            id: res.transaction.id,
            amount: res.transaction.amount,
            description: res.transaction.description,
            type: res.transaction.type === 'in' ? 'credit' : 'debit',
          });
        }
        return res.responseText || args.speech_response;
      }

      if (name === 'get_transactions') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.getTransactions({
          customerNameOrId: custName,
          limit: args.limit || 3,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'update_transaction') {
        const res = await this.actionRouter.updateTransaction({
          transactionId: args.transaction_id || this.contextManager.getActiveTransaction()?.id || 'last-tx',
          amount: args.amount,
          description: args.description,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'delete_transaction') {
        const targetCustomerName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const allCust = await fetchCustomers();
        const cust = targetCustomerName
          ? allCust.find(c => c.name.toLowerCase().includes(targetCustomerName.toLowerCase().trim()))
          : (this.contextManager.getActiveCustomer() ? allCust.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);

        const allTx = await fetchTransactions();
        let targetTx: Transaction | undefined;

        if (args.transaction_id && args.transaction_id !== 'last-tx') {
          targetTx = allTx.find(t => t.id === args.transaction_id);
        }

        if (!targetTx && cust) {
          targetTx = allTx.find(t => (t.customerId && t.customerId === cust.id) || (t.partyName && t.partyName.toLowerCase() === cust.name.toLowerCase()));
        }

        if (!targetTx && targetCustomerName) {
          const lowerName = targetCustomerName.toLowerCase().trim();
          targetTx = allTx.find(t => t.partyName && t.partyName.toLowerCase().includes(lowerName));
        }

        if (!targetTx && this.contextManager.getActiveTransaction()?.id) {
          targetTx = allTx.find(t => t.id === this.contextManager.getActiveTransaction()!.id);
        }

        if (!targetTx && allTx.length > 0) {
          targetTx = allTx[0];
        }

        if (!targetTx) {
          return formatLocalizedResponse(userLang, {
            hindi: targetCustomerName ? `${targetCustomerName} के लिए डिलीट करने हेतु कोई लेनदेन नहीं मिला।` : 'डिलीट करने के लिए कोई लेनदेन नहीं मिला।',
            hinglish: targetCustomerName ? `${targetCustomerName} ke liye delete karne ke liye koi transaction nahi mila.` : 'Delete karne ke liye koi transaction nahi mila.',
            english: targetCustomerName ? `No transaction found to delete for ${targetCustomerName}.` : 'No transaction found to delete.',
          });
        }

        const party = targetTx.partyName || cust?.name || 'Customer';
        const typeStr = targetTx.type === 'in' ? 'जमा/क्रेडिट' : 'उधार/डेबिट';

        const promptDesc = formatLocalizedResponse(userLang, {
          hindi: `${party} का ₹${targetTx.amount.toLocaleString('en-IN')} का लेनदेन (${typeStr})`,
          hinglish: `${party} ka ₹${targetTx.amount.toLocaleString('en-IN')} ka transaction (${typeStr})`,
          english: `Transaction of ₹${targetTx.amount.toLocaleString('en-IN')} for ${party}`,
        });

        this.contextManager.setPendingConfirmation({
          action: 'delete_transaction',
          payload: { 
            transactionId: targetTx.id,
            customerId: targetTx.customerId || cust?.id,
            partyName: party,
            amount: targetTx.amount,
            type: targetTx.type,
          },
          message: promptDesc,
          description: promptDesc,
        });
        this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');

        return formatLocalizedResponse(userLang, {
          hindi: `${promptDesc} मिला है। क्या मैं इसे हटा दूँ? (हाँ / डिलीट कर दो)`,
          hinglish: `${promptDesc} mila hai. Kya main ise delete karun? (Haan / Delete kar do)`,
          english: `Found ${promptDesc}. Would you like me to delete it? (Yes / Delete)`,
        });
      }

      if (name === 'get_due_customers') {
        const res = await this.actionRouter.getDueCustomers({
          filter: args.filter || 'due',
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'get_payment_method_summary') {
        const res = await this.actionRouter.getPaymentSummary({
          paymentMethod: args.payment_method || 'All',
          period: args.period || 'today',
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      // 4. REPORTS
      if (name === 'get_report') {
        const res = await this.actionRouter.getReport(args.period || 'today', userLang);
        return args.speech_response || res.responseText;
      }

      // 5. REMINDERS
      if (name === 'add_reminder') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.addReminder({
          customerNameOrId: custName,
          amount: args.amount,
          dueDate: args.due_date,
          message: args.message,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'get_reminders') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.getReminders(custName, userLang);
        return args.speech_response || res.responseText;
      }

      if (name === 'update_reminder') {
        const res = await this.actionRouter.updateReminder({
          reminderId: args.reminder_id,
          status: args.status,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'delete_reminder') {
        this.contextManager.setPendingConfirmation({
          action: 'delete_reminder',
          payload: { reminderId: args.reminder_id || 'rem-1' },
          message: args.customer_name || 'Reminder',
          description: args.customer_name ? `${args.customer_name} का रिमाइंडर` : 'रिमाइंडर',
        });
        this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');
        return args.speech_response || ConfirmationManager.formatConfirmationPrompt(this.contextManager.getPendingConfirmation()!, userLang);
      }

      // 6. END CONVERSATION
      if (name === 'end_conversation') {
        const res = this.actionRouter.endConversation(args.speech_response, userLang);
        this.callbacks.onStateChange?.('ENDING');
        this.callbacks.onEndSession?.(res.responseText, userLang);
        return res.responseText;
      }

      // 7. NAVIGATION (Tabs, subtabs, and smaller things)
      if (name === 'navigate') {
        const target = args.target || args.page || 'home';
        const res = this.actionRouter.navigate(
          target,
          { customerName: args.customer_name, transactionType: args.transaction_type },
          userLang,
          args.speech_response
        );
        return res.responseText;
      }

      // 8. BILLING & SALE CREATION
      if (name === 'create_sale') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name || 'Walk-In Customer';
        const res = await this.actionRouter.createSale({
          customerName: custName,
          productName: args.product_name || args.item_name || 'Item',
          quantity: args.quantity ? Number(args.quantity) : 1,
          unitPrice: args.unit_price ? Number(args.unit_price) : undefined,
          totalAmount: args.total_amount ? Number(args.total_amount) : undefined,
          paidAmount: args.paid_amount !== undefined ? Number(args.paid_amount) : undefined,
          paymentMethod: args.payment_method || 'Cash',
          notes: args.notes,
          lang: userLang,
        });
        this.contextManager.setActiveCustomer(res.customer);
        return args.speech_response || res.responseText;
      }

      // 9. RECORD PAYMENT (UPI, Cash, Card, Bank Transfer)
      if (name === 'record_payment') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name || 'Customer';
        const res = await this.actionRouter.recordPayment({
          customerNameOrId: custName,
          amount: Number(args.amount) || 0,
          paymentMethod: args.payment_method || 'UPI',
          direction: args.direction || 'INCOME',
          description: args.description,
          lang: userLang,
        });
        if (res.customer) {
          this.contextManager.setActiveCustomer(res.customer);
        }
        return args.speech_response || res.responseText;
      }

      // 10. MANAGE STOCK (Stock In / Purchase, Stock Out, Adjustment, Get)
      if (name === 'manage_stock') {
        const res = await this.actionRouter.manageStock({
          action: args.action || 'adjust',
          productName: args.product_name,
          quantity: Number(args.quantity) || 0,
          paymentMethod: args.payment_method,
          paidAmount: args.paid_amount ? Number(args.paid_amount) : undefined,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'get_stock') {
        const res = await this.actionRouter.manageStock({
          action: 'get',
          productName: args.product_name,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      // 11. INVOICES
      if (name === 'get_invoice' || name === 'show_invoice') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.getInvoices({
          customerName: custName,
          invoiceId: args.invoice_id,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'cancel_invoice') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name;
        const res = await this.actionRouter.cancelInvoice({
          customerName: custName,
          invoiceId: args.invoice_id,
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'update_bill') {
        const custName = args.customer_name || resolvedCustomer?.name || this.contextManager.getActiveCustomer()?.name || 'Customer';
        const res = await this.actionRouter.updateBill({
          customerName: custName,
          newAmount: Number(args.new_amount || args.amount),
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      if (name === 'get_payment_summary') {
        const res = await this.actionRouter.getPaymentSummary({
          paymentMethod: args.payment_method || 'All',
          period: args.period || 'today',
          lang: userLang,
        });
        return args.speech_response || res.responseText;
      }

      return formatLocalizedResponse(userLang, {
        hindi: 'समझ गया।',
        hinglish: 'Samajh gaya.',
        english: 'Understood.',
      });
    } catch (err: any) {
      return formatLocalizedResponse(userLang, {
        hindi: `माफ़ कीजिए, ${err.message || 'यह कार्य नहीं हो सका'}।`,
        hinglish: `Sorry, ${err.message || 'ye action perform nahi ho paaya'}.`,
        english: `Sorry, ${err.message || 'could not perform this action'}.`,
      });
    }
  }

  private async executeLocalFallback(
    text: string,
    resolvedCust: Customer | undefined,
    allCustomers: Customer[],
    userLang: UserLanguage
  ): Promise<string> {
    const raw = text.trim();
    const lower = raw.toLowerCase();

    // 1. Add Customer (e.g. "एक रमेश सा कस्टमर", "Add Ramesh as customer", "रमेश करके कस्टमर बनाओ", "Add customer")
    const hindiSpecificCustomerMatch = raw.match(/एक\s+([^\s]+)\s+(?:सा\s+)?(?:कस्टमर|ग्राहक)/i);
    const custAddMatchHindi = hindiSpecificCustomerMatch || raw.match(/([^\s]+)\s*(?:करके|सा|को)?\s*(?:कस्टमर|ग्राहक)\s*(?:बनाओ|जोड़ो|ऐड\s*करो|बना\s*दो|ऐड\s*कर\s*दो)/i);
    const custAddMatchEnglish = lower.match(/(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
                                lower.match(/(?:customer\s+banao|customer\s+add\s+karo)\s+([a-zA-Z\s]+)/i) ||
                                lower.match(/([a-zA-Z\s]+?)\s*(?:ko|karke)?\s*customer\s*(?:banao|add\s*karo)/i);

    if (custAddMatchHindi) {
      const name = custAddMatchHindi[1].replace(/^(नया|न्यू|एक)\s*/, '').trim();
      if (name && name !== 'कस्टमर' && name !== 'ग्राहक') {
        const res = await this.actionRouter.addCustomer({ name, lang: userLang });
        this.contextManager.setActiveCustomer(res.customer);
        return res.responseText;
      }
    }
    if (custAddMatchEnglish && (lower.includes('customer') || lower.includes('कस्टमर'))) {
      const name = custAddMatchEnglish[1].replace(/^(new|naya)\s*/i, '').trim();
      if (name && !name.includes('page') && !name.includes('kholo') && name !== 'a' && name !== 'the') {
        const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
        const res = await this.actionRouter.addCustomer({ name: formattedName, lang: userLang });
        this.contextManager.setActiveCustomer(res.customer);
        return res.responseText;
      }
    }

    // Missing customer name question
    if (
      lower === 'add customer' ||
      lower === 'create customer' ||
      lower === 'customer banao' ||
      lower === 'naya customer banao' ||
      raw === 'कस्टमर बनाओ' ||
      raw === 'नया ग्राहक बनाओ' ||
      raw === 'ग्राहक जोड़ो'
    ) {
      this.contextManager.setPendingSlotFilling({
        action: 'add_customer',
        missingFields: ['name'],
        gathered: {},
        promptQuestion: 'Kis naam se?',
      });
      return formatLocalizedResponse(userLang, {
        hindi: 'किस नाम से नया ग्राहक बनाना है?',
        hinglish: 'Kis naam se naya customer add karna hai?',
        english: 'What is the name for the new customer?',
      });
    }

    // 2. Navigation intent (All tabs, subtabs, and smaller things)
    if (lower.includes('setting') || raw.includes('सेटिंग')) {
      const res = this.actionRouter.navigate('settings_modal', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('search') || raw.includes('सर्च')) {
      const res = this.actionRouter.navigate('search_modal', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('add customer') || lower.includes('customer form') || raw.includes('नया ग्राहक फॉर्म') || raw.includes('कस्टमर फॉर्म')) {
      const res = this.actionRouter.navigate('add_customer_modal', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('add transaction') || lower.includes('entry form') || lower.includes('cash in') || lower.includes('cash out') || raw.includes('लेनदेन फॉर्म') || raw.includes('एंट्री फॉर्म')) {
      const res = this.actionRouter.navigate('add_transaction_modal', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('add product') || lower.includes('product form') || raw.includes('सामान फॉर्म') || raw.includes('प्रोडक्ट फॉर्म')) {
      const res = this.actionRouter.navigate('add_product_modal', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('invoice') || lower.includes('receipt') || raw.includes('रसीद') || raw.includes('बिल प्रीव्यू')) {
      const res = this.actionRouter.navigate('invoice_modal', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('sidebar') || raw.includes('साइडबार')) {
      const res = this.actionRouter.navigate('toggle_sidebar', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('ledger') || lower.includes('khata kholo') || raw.includes('खाता खोलो') || raw.includes('लेजर खोलो')) {
      const cust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : allCustomers[0]);
      const res = this.actionRouter.navigate('customer_ledger_modal', { customerName: cust?.name }, userLang);
      return res.responseText;
    }
    if (lower.includes('customer page') || lower.includes('customers kholo') || lower.includes('show customers') || raw.includes('कस्टमर्स खोलो') || raw.includes('ग्राहक पेज')) {
      const res = this.actionRouter.navigate('customers', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('transaction page') || lower.includes('transactions kholo') || lower.includes('show transactions') || lower.includes('ledger page') || raw.includes('लेनदेन खोलो')) {
      const res = this.actionRouter.navigate('transactions', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('billing kholo') || lower.includes('invoice open') || lower.includes('billing page') || raw.includes('बिलिंग खोलो')) {
      const res = this.actionRouter.navigate('billing', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('stock kholo') || lower.includes('stocks kholo') || lower.includes('inventory page') || raw.includes('स्टॉक खोलो')) {
      const res = this.actionRouter.navigate('stocks', undefined, userLang);
      return res.responseText;
    }
    if (lower.includes('dashboard') || lower.includes('home kholo') || lower.includes('home page') || raw.includes('डैशबोर्ड खोलो')) {
      const res = this.actionRouter.navigate('home', undefined, userLang);
      return res.responseText;
    }

    // 3. Reports / Summary intent
    if (lower.includes('kitna paisa aaya') || lower.includes('today sales') || lower.includes('aaj kitna aaya') || lower.includes('summary') || lower.includes('report') || lower.includes('bikri') || raw.includes('कितना पैसा आया') || raw.includes('बिक्री बताओ') || raw.includes('आज की बिक्री')) {
      const res = await this.actionRouter.getReport('today', userLang);
      return res.responseText;
    }

    // 4. Delete customer / transaction / reminder intent
    if (lower.includes('delete') || lower.includes('hata do') || lower.includes('remove') || lower.includes('hatao') || raw.includes('डिलीट') || raw.includes('हटाओ')) {
      // 4a. Customer deletion
      if (lower.includes('customer') || raw.includes('ग्राहक') || raw.includes('कस्टमर')) {
        const targetCust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : allCustomers[0]);
        if (targetCust) {
          const promptDesc = formatLocalizedResponse(userLang, {
            hindi: `कस्टमर ${targetCust.name} (बैलेंस: ₹${targetCust.balance.toLocaleString('en-IN')})`,
            hinglish: `Customer ${targetCust.name} (Balance: ₹${targetCust.balance.toLocaleString('en-IN')})`,
            english: `Customer ${targetCust.name} (Balance: ₹${targetCust.balance.toLocaleString('en-IN')})`,
          });
          this.contextManager.setPendingConfirmation({
            action: 'delete_customer',
            payload: { customerId: targetCust.id },
            message: promptDesc,
            description: promptDesc,
          });
          this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');
          return ConfirmationManager.formatConfirmationPrompt(this.contextManager.getPendingConfirmation()!, userLang);
        }
      }

      // 4b. Reminder deletion
      if (lower.includes('reminder') || raw.includes('रिमाइंडर')) {
        const rems = await this.actionRouter.getReminders(resolvedCust?.name, userLang);
        if (rems.reminders && rems.reminders.length > 0) {
          const targetRem = rems.reminders[0];
          const promptDesc = formatLocalizedResponse(userLang, {
            hindi: `${targetRem.customerName || 'रिमाइंडर'} (${targetRem.dueDate})`,
            hinglish: `${targetRem.customerName || 'Reminder'} (${targetRem.dueDate})`,
            english: `${targetRem.customerName || 'Reminder'} (${targetRem.dueDate})`,
          });
          this.contextManager.setPendingConfirmation({
            action: 'delete_reminder',
            payload: { reminderId: targetRem.id },
            message: promptDesc,
            description: promptDesc,
          });
          this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');
          return ConfirmationManager.formatConfirmationPrompt(this.contextManager.getPendingConfirmation()!, userLang);
        }
      }

      // 4c. Real Transaction deletion
      const allTx = await fetchTransactions();
      const targetCustomer = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);
      
      let matchingTx: Transaction | undefined;
      if (targetCustomer) {
        matchingTx = allTx.find(t => (t.customerId && t.customerId === targetCustomer.id) || (t.partyName && t.partyName.toLowerCase() === targetCustomer.name.toLowerCase()));
      }
      if (!matchingTx && this.contextManager.getActiveTransaction()?.id) {
        matchingTx = allTx.find(t => t.id === this.contextManager.getActiveTransaction()!.id);
      }
      if (!matchingTx && allTx.length > 0) {
        matchingTx = allTx[0];
      }

      if (!matchingTx) {
        return formatLocalizedResponse(userLang, {
          hindi: 'डिलीट करने के लिए कोई लेनदेन नहीं मिला।',
          hinglish: 'Delete karne ke liye koi transaction nahi mila.',
          english: 'No transaction found to delete.',
        });
      }

      const party = matchingTx.partyName || targetCustomer?.name || 'Customer';
      const typeStr = matchingTx.type === 'in' ? 'जमा/क्रेडिट' : 'उधार/डेबिट';
      const desc = formatLocalizedResponse(userLang, {
        hindi: `${party} का ₹${matchingTx.amount.toLocaleString('en-IN')} का लेनदेन (${typeStr})`,
        hinglish: `${party} ka ₹${matchingTx.amount.toLocaleString('en-IN')} ka transaction (${typeStr})`,
        english: `Transaction of ₹${matchingTx.amount.toLocaleString('en-IN')} for ${party}`,
      });

      this.contextManager.setPendingConfirmation({
        action: 'delete_transaction',
        payload: { 
          transactionId: matchingTx.id,
          customerId: matchingTx.customerId || targetCustomer?.id,
          partyName: party,
          amount: matchingTx.amount,
          type: matchingTx.type,
        },
        message: desc,
        description: desc,
      });
      this.callbacks.onStateChange?.('WAITING_FOR_CONFIRMATION');

      return formatLocalizedResponse(userLang, {
        hindi: `${desc} मिला है। क्या मैं इसे हटा दूँ? (हाँ / डिलीट करो)`,
        hinglish: `${desc} mila hai. Kya main ise delete karun? (Haan / Delete kar do)`,
        english: `Found ${desc}. Would you like me to delete it? (Yes / Delete)`,
      });
    }

    // 5. Total dues / Market Udhar & Pending customer questions
    if (
      lower.includes('kitne customer') && (lower.includes('baaki') || lower.includes('baki') || lower.includes('udhar') || lower.includes('pending') || lower.includes('paisa')) ||
      lower.includes('kiska paisa baaki') || lower.includes('kiska baki') || lower.includes('sabse zyada') ||
      raw.includes('कितने ग्राहकों का बकाया') || raw.includes('किसका पैसा बाकी') || raw.includes('सबसे ज्यादा किसका')
    ) {
      const res = await this.actionRouter.getDueCustomers({ filter: 'due', lang: userLang });
      return res.responseText;
    }

    if (lower.includes('zero balance') || lower.includes('chukta') || lower.includes('settled customer') || raw.includes('जीरो बैलेंस') || raw.includes('चुकता')) {
      const res = await this.actionRouter.getDueCustomers({ filter: 'settled', lang: userLang });
      return res.responseText;
    }

    if (lower.includes('total udhar') || lower.includes('baki paisa') || lower.includes('market udhar') || lower.includes('pending dues') || raw.includes('कुल उधारी') || raw.includes('बाकी पैसा') || raw.includes('कुल बकाया')) {
      const res = await this.actionRouter.getAccountBalance(userLang);
      return res.responseText;
    }

    // 5b. Payment Method Specific Inquiries ("UPI se kitna aaya", "Cash mein kitna aaya")
    if (lower.includes('upi se kitna') || lower.includes('upi payment kitna') || raw.includes('यूपीआई से कितना')) {
      const res = await this.actionRouter.getPaymentSummary({ paymentMethod: 'UPI', period: 'today', lang: userLang });
      return res.responseText;
    }
    if (lower.includes('cash se kitna') || lower.includes('cash mein kitna') || raw.includes('कैश में कितना')) {
      const res = await this.actionRouter.getPaymentSummary({ paymentMethod: 'Cash', period: 'today', lang: userLang });
      return res.responseText;
    }

    // 5c. Yesterday & Date-specific payment questions ("Kal kitna paisa aaya tha")
    if (lower.includes('kal kitna') || raw.includes('कल कितना')) {
      const res = await this.actionRouter.getReport('yesterday', userLang);
      return res.responseText;
    }

    // 5d. Pronoun Follow-up for Payment History: "Usse pehle?", "Pehle kab diya tha?"
    const isPriorPaymentQuestion = lower.includes('usse pehle') || lower.includes('usse pehle kab') || lower.includes('pehle kab') || raw.includes('उससे पहले');
    if (isPriorPaymentQuestion) {
      const cust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);
      if (cust) {
        const res = await this.actionRouter.getTransactions({
          customerNameOrId: cust.name,
          type: 'in',
          offset: 1,
          limit: 1,
          lang: userLang,
        });
        return res.responseText;
      }
    }

    // 5e. Last payment inquiry ("Ravi ne last payment kab ki thi?", "Last payment kab aayi thi")
    if (lower.includes('last payment') || lower.includes('pichli payment') || lower.includes('payment history') || raw.includes('अंतिम भुगतान') || raw.includes('पिछली पेमेंट')) {
      const cust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);
      if (cust) {
        const res = await this.actionRouter.getTransactions({
          customerNameOrId: cust.name,
          type: 'in',
          limit: 1,
          lang: userLang,
        });
        return res.responseText;
      }
    }

    // 6. Balance query intent
    if (lower.includes('balance') || lower.includes('kitna hai') || lower.includes('batao') || lower.includes('dues') || raw.includes('बैलेंस') || raw.includes('बकाया')) {
      const cust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);
      if (cust) {
        this.contextManager.setActiveCustomer(cust);
        const res = await this.actionRouter.getBalance(cust.name, userLang);
        return res.statusText;
      }
      return formatLocalizedResponse(userLang, {
        hindi: 'किस कस्टमर का बैलेंस जानना है?',
        hinglish: 'Kis customer ka balance janna hai?',
        english: 'Which customer would you like to check the balance for?',
      });
    }

    // 7. Robust Multilingual Transaction Intent & Entity Extraction
    const amountMatch = raw.match(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|रुपये|रुपए)?/i);
    const hasAmount = !!amountMatch;
    const amount = hasAmount ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

    const financialIntent = detectFinancialIntent(raw);
    const isActionVerb = /\b(likh\s*do|likho|likhiye|likh\s*lo|likha|chadha\s*do|chada\s*do|daal\s*do|dalo|add\s*karo|add\s*kar\s*do|add|jo\s*do|jod\s*do|jodo|darj\s*karo|note\s*karo|entry\s*karo|kar\s*do)\b|लिख\s*दो|लिखो|लिखिए|लिख\s*लो|लिखा|चढ़ा\s*दो|चढ़ाओ|डाल\s*दो|डालो|ऐड\s*करो|ऐड\s*कर\s*दो|जोड़ो|जोड़\s*दो|दर्ज\s*करो|दर्ज\s*कर\s*दो|नोट\s*करो|नोट\s*कर\s*दो|एंट्री\s*करो|एंट्री\s*कर\s*दो|कर\s*दो/i.test(raw);

    const isTransactionCommand = (hasAmount && (financialIntent === 'PAYMENT_RECEIVED' || financialIntent === 'CREDIT_GIVEN' || isActionVerb)) ||
      lower.includes('add transaction') ||
      lower.includes('add entry') ||
      lower.includes('aur 200 aur') ||
      raw.includes('उधार लिख') ||
      raw.includes('उधर लिख') ||
      raw.includes('जमा लिख') ||
      raw.includes('खाते में') ||
      raw.includes('अकाउंट में');

    if (isTransactionCommand) {
      // 1. Resolve customer strictly using CustomerResolver against database
      const customerResolution = resolveCustomerAgainstDatabase(raw, allCustomers);

      if (customerResolution.status === 'AMBIGUOUS' && customerResolution.candidates && customerResolution.candidates.length > 1) {
        const candidateNames = customerResolution.candidates.map(c => c.name).join(', ');
        return formatLocalizedResponse(userLang, {
          hindi: `${customerResolution.searchedName || 'कस्टमर'} नाम के ${customerResolution.candidates.length} कस्टमर्स मिल रहे हैं (${candidateNames})। आप किस ग्राहक की बात कर रहे हैं?`,
          hinglish: `${customerResolution.searchedName || 'Customer'} naam ke ${customerResolution.candidates.length} customers mil rahe hain (${candidateNames}). Kis customer ki baat kar rahe hain?`,
          english: `Found ${customerResolution.candidates.length} customers matching "${customerResolution.searchedName || 'customer'}" (${candidateNames}). Which one do you mean?`,
        });
      }

      let targetCustomer: Customer | undefined = customerResolution.customer || resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : undefined);

      // If customer name was mentioned in speech but is NOT found in DB, DO NOT create one automatically!
      if (!targetCustomer && customerResolution.status === 'NOT_FOUND') {
        const cleanName = cleanExtractedCustomerName(customerResolution.searchedName || '');
        if (cleanName && cleanName.length >= 2 && !['account', 'khata', 'customer', 'entry'].includes(cleanName.toLowerCase())) {
          return formatLocalizedResponse(userLang, {
            hindi: `"${cleanName}" कस्टमर लिस्ट में नहीं मिल रहे। क्या आप उन्हें नया कस्टमर बनाना चाहते हैं?`,
            hinglish: `"${cleanName}" customer list mein nahi mil rahe. Kya aap unhe naya customer banana chahte hain?`,
            english: `"${cleanName}" was not found in the customer list. Would you like to add them as a new customer?`,
          });
        }
      }

      if (!hasAmount) {
        const targetName = targetCustomer?.name || 'खाता';
        this.contextManager.setPendingSlotFilling({
          action: 'add_transaction',
          missingFields: ['amount', 'transaction_type'],
          gathered: { customerName: targetName },
          promptQuestion: 'Kitne rupaye?',
        });
        return formatLocalizedResponse(userLang, {
          hindi: `${targetCustomer ? targetCustomer.name + ' के खाते में ' : ''}कितने रुपये लिखने हैं?`,
          hinglish: `${targetCustomer ? targetCustomer.name + ' ke account mein ' : ''}Kitne rupaye likhne hain?`,
          english: `How much amount to record${targetCustomer ? ' for ' + targetCustomer.name : ''}?`,
        });
      }

      // Determine transaction type:
      // PAYMENT_RECEIVED (customer pays, "minus karke batao", "aa chuka hai", "de diye", "jama") -> credit (decreases balance)
      // CREDIT_GIVEN (udhar diya, saman diya, debit) -> debit (increases balance)
      const transactionType: 'credit' | 'debit' = financialIntent === 'CREDIT_GIVEN' ? 'debit' : 'credit';

      const res = await this.actionRouter.addTransaction({
        customerNameOrId: targetCustomer ? targetCustomer.name : 'खाता',
        amount,
        transactionType,
        lang: userLang,
      });

      if (res.customer) {
        this.contextManager.setActiveCustomer(res.customer);
      }
      if (res.transaction) {
        this.contextManager.setActiveTransaction({
          id: res.transaction.id,
          amount: res.transaction.amount,
          description: res.transaction.description,
          type: res.transaction.type === 'in' ? 'credit' : 'debit',
        });
      }
      return res.responseText;
    }

    // 8. Reminders intent
    if (lower.includes('reminder') || raw.includes('रिमाइंडर') || lower.includes('yaad dilao')) {
      const cust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);
      const res = await this.actionRouter.getReminders(cust?.name, userLang);
      return res.responseText;
    }

    // 9. Last transaction query intent
    if (lower.includes('last transaction') || lower.includes('pichli transaction') || lower.includes('uski last') || raw.includes('पिछला लेनदेन')) {
      const cust = resolvedCust || (this.contextManager.getActiveCustomer() ? allCustomers.find(c => c.id === this.contextManager.getActiveCustomer()?.id) : null);
      const res = await this.actionRouter.getTransactions({
        customerNameOrId: cust?.name,
        limit: 1,
        lang: userLang,
      });
      return res.responseText;
    }

    // 10. Identity & questions ("Who are you?", "Aap kaun ho?", "What is NotiBook?")
    if (lower.includes('who are you') || lower.includes('kaun ho') || lower.includes('kya ho') || raw.includes('कौन हो') || raw.includes('कौन हैं')) {
      return formatLocalizedResponse(userLang, {
        hindi: 'मैं जार्विस हूँ, नोटीबुक का वॉइस असिस्टेंट। मैं आपके ग्राहकों के खाते, दैनिक बिक्री, बिलिंग और उधारी का हिसाब रखने में मदद करता हूँ।',
        hinglish: 'Main Jarvis hoon, NotiBook ka smart voice assistant. Main aapke customers, khata, daily sales, aur udhar manage karne me madad karta hoon.',
        english: 'I am Jarvis, NotiBook\'s voice assistant. I help you manage customer Khatabooks, record daily sales and expenses, generate bills, and track dues.',
      });
    }

    // 11. Customer count & list queries
    if (lower.includes('kitne customer') || lower.includes('how many customer') || lower.includes('total customer') || raw.includes('कितने ग्राहक') || raw.includes('कितने कस्टमर')) {
      const count = allCustomers.length;
      return formatLocalizedResponse(userLang, {
        hindi: `नोटीबुक में कुल ${count} ग्राहक जुड़े हुए हैं।`,
        hinglish: `NotiBook me total ${count} customers registered hain.`,
        english: `You currently have ${count} customers registered in your NotiBook.`,
      });
    }

    // Context-aware Closing / Farewell ("theek hai", "ok", "bas", "thank you", "bye", "alvida", "goodbye")
    // ONLY when NOT waiting for confirmation and NOT in slot filling!
    const isEndingExpression = 
      lower === 'theek hai' ||
      lower === 'theek h' ||
      lower === 'ok' ||
      lower === 'okay' ||
      lower === 'alright' ||
      lower === 'all right' ||
      lower === 'bas' ||
      lower === 'bas itna hi' ||
      lower === 'that is all' ||
      lower === 'thats all' ||
      lower === 'bye' ||
      lower === 'goodbye' ||
      lower === 'bye jarvis' ||
      lower.includes('alvida') ||
      raw === 'ठीक है' ||
      raw === 'बस' ||
      raw === 'अलविदा';

    if (isEndingExpression && !this.contextManager.getPendingConfirmation() && !this.contextManager.getPendingSlotFilling()) {
      const res = this.actionRouter.endConversation(undefined, userLang);
      this.callbacks.onStateChange?.('ENDING');
      this.callbacks.onEndSession?.(res.responseText, userLang);
      return res.responseText;
    }

    // 12. Gratitude & Greetings
    if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || raw.includes('धन्यवाद') || raw.includes('शुक्रिया')) {
      return formatLocalizedResponse(userLang, {
        hindi: 'आपका स्वागत है! किसी भी अन्य हिसाब या बिलिंग के लिए मुझे बताइए।',
        hinglish: 'You are welcome! Aur kuch update karna ho toh bataiye.',
        english: 'You are welcome! Let me know if you need anything else.',
      });
    }

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('hey') || raw.includes('नमस्ते') || raw.includes('नमस्कार')) {
      return formatLocalizedResponse(userLang, {
        hindi: 'नमस्ते! आज मैं आपकी दुकान और खाते में क्या मदद करूँ?',
        hinglish: 'Namaste! Aaj aapke shop aur ledger me kya check karna hai?',
        english: 'Hello! How can I assist you with your shop ledger or customers today?',
      });
    }

    // 13. Clean, direct conversational default - strictly no canned capability paragraphs
    return formatLocalizedResponse(userLang, {
      hindi: 'जी बताइए, क्या एंट्री करनी है?',
      hinglish: 'Haanji, batayein, ledger me kya update karna hai?',
      english: 'Yes, what would you like to update in your ledger?',
    });
  }

  private respond(text: string, lang: UserLanguage = this.currentDetectedLanguage) {
    this.callbacks.onTranscript?.('assistant', text, lang);
    this.contextManager.addTurn('assistant', text);
    this.callbacks.onStateChange?.('SPEAKING');
  }
}


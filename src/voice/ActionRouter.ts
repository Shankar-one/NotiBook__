import { 
  Customer, 
  Transaction 
} from '../types';
import { 
  fetchCustomers, 
  createCustomerApi, 
  deleteCustomerApi, 
  updateCustomerApi,
  getCustomerByIdOrName 
} from '../api/customers';
import { 
  fetchTransactions, 
  addTransactionApi, 
  deleteTransactionApi,
  updateTransactionApi
} from '../api/transactions';
import { 
  fetchReminders, 
  addReminderApi, 
  deleteReminderApi, 
  updateReminderApi,
  Reminder 
} from '../api/reminders';
import { 
  fetchBusinessSummary, 
  BusinessSummary 
} from '../api/reports';
import { UserLanguage, formatLocalizedResponse } from './LanguageUtils';

export type NavigationTarget = 
  | 'home' 
  | 'customers' 
  | 'billing' 
  | 'transactions' 
  | 'stocks'
  | 'add_customer_modal'
  | 'add_transaction_modal'
  | 'add_product_modal'
  | 'customer_ledger_modal'
  | 'invoice_modal'
  | 'settings_modal'
  | 'search_modal'
  | 'voice_modal'
  | 'toggle_sidebar';

export interface NavigationOptions {
  customerName?: string;
  transactionType?: 'credit' | 'debit' | 'in' | 'out';
}

export interface ActionRouterCallbacks {
  onNavigate?: (target: string, options?: NavigationOptions) => void;
  onCustomerUpdated?: (customer: Customer) => void;
  onTransactionAdded?: (tx: Transaction) => void;
  onRefreshData?: () => void;
}

export class ActionRouter {
  private callbacks: ActionRouterCallbacks;

  constructor(callbacks: ActionRouterCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: ActionRouterCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // 1. Get Balance
  public async getBalance(
    customerNameOrId: string,
    lang: UserLanguage = 'hinglish'
  ): Promise<{ customer: Customer; balance: number; statusText: string }> {
    const customer = await getCustomerByIdOrName(customerNameOrId);
    if (!customer) {
      const notFound = formatLocalizedResponse(lang, {
        hindi: `कस्टमर "${customerNameOrId}" आपके नोटीबुक में नहीं मिला।`,
        hinglish: `Customer "${customerNameOrId}" aapke NotiBook mein nahi mila.`,
        english: `Customer "${customerNameOrId}" was not found in your NotiBook.`,
      });
      throw new Error(notFound);
    }

    const bal = customer.balance;
    let statusText = '';
    if (bal > 0) {
      statusText = formatLocalizedResponse(lang, {
        hindi: `${customer.name} का बकाया बैलेंस ₹${bal.toLocaleString('en-IN')} है।`,
        hinglish: `${customer.name} ka current balance ₹${bal.toLocaleString('en-IN')} pending hai.`,
        english: `${customer.name}'s outstanding balance is ₹${bal.toLocaleString('en-IN')}.`,
      });
    } else if (bal < 0) {
      statusText = formatLocalizedResponse(lang, {
        hindi: `${customer.name} का ₹${Math.abs(bal).toLocaleString('en-IN')} एडवांस डिपॉजिट है।`,
        hinglish: `${customer.name} ka ₹${Math.abs(bal).toLocaleString('en-IN')} advance deposit hai.`,
        english: `${customer.name} has an advance deposit of ₹${Math.abs(bal).toLocaleString('en-IN')}.`,
      });
    } else {
      statusText = formatLocalizedResponse(lang, {
        hindi: `${customer.name} का खाता बिल्कुल चुकता है, कोई बकाया नहीं है।`,
        hinglish: `${customer.name} ka account settled hai, koi balance baki nahi hai.`,
        english: `${customer.name}'s account is fully settled with zero dues.`,
      });
    }

    return { customer, balance: bal, statusText };
  }

  // 2. Add Transaction
  public async addTransaction(params: {
    customerNameOrId?: string;
    amount: number;
    transactionType: 'credit' | 'debit';
    paymentMode?: 'Cash' | 'UPI' | 'Bank' | 'Credit';
    description?: string;
    lang?: UserLanguage;
  }): Promise<{ transaction: Transaction; customer?: Customer; responseText: string }> {
    const { 
      customerNameOrId, 
      amount, 
      transactionType, 
      paymentMode = 'Cash', 
      description,
      lang = 'hinglish' 
    } = params;

    let customer: Customer | null = null;
    if (customerNameOrId) {
      customer = await getCustomerByIdOrName(customerNameOrId);
    }

    const tx = await addTransactionApi({
      customerId: customer?.id,
      partyName: customer ? customer.name : customerNameOrId,
      amount,
      transactionType,
      paymentMode,
      description: description || (customer ? `${transactionType === 'credit' ? 'Payment from' : 'Given to'} ${customer.name}` : undefined),
    });

    if (this.callbacks.onTransactionAdded) {
      this.callbacks.onTransactionAdded(tx);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const name = customer ? customer.name : (customerNameOrId || 'खाता');
    const isCredit = transactionType === 'credit';

    const responseText = formatLocalizedResponse(lang, {
      hindi: `हो गया। ${name} के खाते में ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'जमा (क्रेडिट)' : 'उधार (डेबिट)'} जोड़ दिए गए हैं।`,
      hinglish: `Done. ${name} ke account mein ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'jama (credit)' : 'udhar (debit)'} add kar diya.`,
      english: `Done. Added ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'credit' : 'debit'} to ${name}'s account.`,
    });

    return { transaction: tx, customer: customer || undefined, responseText };
  }

  // 3. Delete Transaction
  public async deleteTransaction(
    transactionId: string,
    lang: UserLanguage = 'hinglish'
  ): Promise<{ success: boolean; responseText: string }> {
    await deleteTransactionApi(transactionId);
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }
    const responseText = formatLocalizedResponse(lang, {
      hindi: 'हो गया। ट्रांजैक्शन सफलतापूर्वक डिलीट कर दिया गया है।',
      hinglish: 'Done. Transaction successfully delete kar diya gaya.',
      english: 'Done. The transaction has been deleted successfully.',
    });
    return { success: true, responseText };
  }

  // 4. Add Customer
  public async addCustomer(params: {
    name: string;
    phone?: string;
    address?: string;
    openingBalance?: number;
    lang?: UserLanguage;
  }): Promise<{ customer: Customer; responseText: string }> {
    const { name, phone, address, openingBalance, lang = 'hinglish' } = params;
    const customer = await createCustomerApi({
      name,
      phone: phone || '+91 98000 00000',
      address: address || '',
      balance: openingBalance || 0,
    });

    if (this.callbacks.onCustomerUpdated) {
      this.callbacks.onCustomerUpdated(customer);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: `हो गया। ${customer.name} को कस्टमर के रूप में जोड़ दिया गया है।`,
      hinglish: `Done. ${customer.name} ko naya customer add kar diya hai.`,
      english: `Done. Added ${customer.name} as a new customer.`,
    });

    return { customer, responseText };
  }

  // 4b. Get Customer
  public async getCustomer(
    customerNameOrId: string,
    lang: UserLanguage = 'hinglish'
  ): Promise<{ customer: Customer; responseText: string }> {
    const customer = await getCustomerByIdOrName(customerNameOrId);
    if (!customer) {
      const notFound = formatLocalizedResponse(lang, {
        hindi: `कस्टमर "${customerNameOrId}" नहीं मिला।`,
        hinglish: `Customer "${customerNameOrId}" nahi mila.`,
        english: `Customer "${customerNameOrId}" not found.`,
      });
      throw new Error(notFound);
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: `${customer.name}: फोन ${customer.phone}, बकाया ₹${customer.balance.toLocaleString('en-IN')}।`,
      hinglish: `${customer.name}: Phone ${customer.phone}, balance ₹${customer.balance.toLocaleString('en-IN')}.`,
      english: `${customer.name}: Phone ${customer.phone}, balance ₹${customer.balance.toLocaleString('en-IN')}.`,
    });

    return { customer, responseText };
  }

  // 4c. Update Customer
  public async updateCustomer(params: {
    customerNameOrId: string;
    phone?: string;
    address?: string;
    lang?: UserLanguage;
  }): Promise<{ customer: Customer; responseText: string }> {
    const { customerNameOrId, phone, address, lang = 'hinglish' } = params;
    const existing = await getCustomerByIdOrName(customerNameOrId);
    if (!existing) {
      throw new Error(`Customer "${customerNameOrId}" not found.`);
    }

    const updated = await updateCustomerApi(existing.id, {
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
    });

    if (updated && this.callbacks.onCustomerUpdated) {
      this.callbacks.onCustomerUpdated(updated);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: `हो गया। ${existing.name} का विवरण अपडेट कर दिया गया है।`,
      hinglish: `Done. ${existing.name} ki details update kar di gayi hain.`,
      english: `Done. Updated details for ${existing.name}.`,
    });

    return { customer: updated || existing, responseText };
  }

  // 5. Delete Customer
  public async deleteCustomer(
    customerId: string,
    lang: UserLanguage = 'hinglish'
  ): Promise<{ success: boolean; responseText: string }> {
    await deleteCustomerApi(customerId);
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }
    const responseText = formatLocalizedResponse(lang, {
      hindi: 'कस्टमर रिकॉर्ड सफलतापूर्वक हटा दिया गया है।',
      hinglish: 'Customer record successfully delete kar diya.',
      english: 'Customer record has been deleted successfully.',
    });
    return { success: true, responseText };
  }

  // 5b. Get Transactions
  public async getTransactions(params: {
    customerNameOrId?: string;
    limit?: number;
    lang?: UserLanguage;
  }): Promise<{ transactions: Transaction[]; responseText: string }> {
    const { customerNameOrId, limit = 5, lang = 'hinglish' } = params;
    let txs = await fetchTransactions();
    if (customerNameOrId) {
      const lower = customerNameOrId.toLowerCase();
      txs = txs.filter(t => t.partyName?.toLowerCase().includes(lower));
    }
    const recent = txs.slice(0, limit);

    if (recent.length === 0) {
      const responseText = formatLocalizedResponse(lang, {
        hindi: customerNameOrId ? `${customerNameOrId} के लिए कोई हालिया लेनदेन नहीं मिला।` : 'कोई लेनदेन नहीं मिला।',
        hinglish: customerNameOrId ? `${customerNameOrId} ke liye koi transaction nahi mila.` : 'Koi transaction nahi mila.',
        english: customerNameOrId ? `No recent transactions found for ${customerNameOrId}.` : 'No transactions found.',
      });
      return { transactions: [], responseText };
    }

    const first = recent[0];
    const isCredit = first.type === 'in';
    const responseText = formatLocalizedResponse(lang, {
      hindi: `पिछला लेनदेन ₹${first.amount.toLocaleString('en-IN')} का (${isCredit ? 'जमा' : 'उधार'}) था।`,
      hinglish: `Last transaction ₹${first.amount.toLocaleString('en-IN')} ka (${isCredit ? 'jama' : 'udhar'}) tha.`,
      english: `Last transaction was for ₹${first.amount.toLocaleString('en-IN')} (${isCredit ? 'credit' : 'debit'}).`,
    });

    return { transactions: recent, responseText };
  }

  // 5c. Update Transaction
  public async updateTransaction(params: {
    transactionId: string;
    amount?: number;
    description?: string;
    lang?: UserLanguage;
  }): Promise<{ transaction: Transaction | null; responseText: string }> {
    const { transactionId, amount, description, lang = 'hinglish' } = params;
    const updated = await updateTransactionApi(transactionId, {
      ...(amount !== undefined ? { amount } : {}),
      ...(description ? { description } : {}),
    });

    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: 'लेनदेन सफलतापूर्वक अपडेट कर दिया गया है।',
      hinglish: 'Transaction successfully update ho gaya.',
      english: 'Transaction updated successfully.',
    });

    return { transaction: updated, responseText };
  }

  // 5d. Total Market Balance (Account Balance)
  public async getAccountBalance(
    lang: UserLanguage = 'hinglish'
  ): Promise<{ totalReceivables: number; dueCount: number; responseText: string }> {
    const allCustomers = await fetchCustomers();
    const dueCustomers = allCustomers.filter(c => c.balance > 0);
    const totalDue = dueCustomers.reduce((s, c) => s + c.balance, 0);
    const dueCount = dueCustomers.length;

    const responseText = formatLocalizedResponse(lang, {
      hindi: `मार्केट में कुल ₹${totalDue.toLocaleString('en-IN')} का बकाया है, जो ${dueCount} ग्राहकों से लेना बाकी है।`,
      hinglish: `Market me total ₹${totalDue.toLocaleString('en-IN')} udhar pending hai, jo ${dueCount} customers se lena hai.`,
      english: `Total pending receivables amount to ₹${totalDue.toLocaleString('en-IN')} across ${dueCount} customers.`,
    });

    return { totalReceivables: totalDue, dueCount, responseText };
  }

  // 6. Add Reminder
  public async addReminder(params: {
    customerNameOrId?: string;
    amount?: number;
    dueDate?: string;
    message?: string;
    lang?: UserLanguage;
  }): Promise<{ reminder: Reminder; responseText: string }> {
    const { lang = 'hinglish' } = params;
    let customer: Customer | null = null;
    if (params.customerNameOrId) {
      customer = await getCustomerByIdOrName(params.customerNameOrId);
    }

    const rem = await addReminderApi({
      customerId: customer?.id,
      customerName: customer ? customer.name : params.customerNameOrId,
      amount: params.amount || customer?.balance,
      dueDate: params.dueDate,
      message: params.message,
    });

    const responseText = formatLocalizedResponse(lang, {
      hindi: `${rem.customerName} के लिए रिमाइंडर सेट कर दिया गया है।`,
      hinglish: `${rem.customerName} ke liye reminder set kar diya hai.`,
      english: `Reminder has been set for ${rem.customerName}.`,
    });

    return { reminder: rem, responseText };
  }

  // 6b. Get Reminders
  public async getReminders(
    customerNameOrId?: string,
    lang: UserLanguage = 'hinglish'
  ): Promise<{ reminders: Reminder[]; responseText: string }> {
    let list = await fetchReminders();
    if (customerNameOrId) {
      const lower = customerNameOrId.toLowerCase();
      list = list.filter(r => r.customerName?.toLowerCase().includes(lower));
    }

    if (list.length === 0) {
      const responseText = formatLocalizedResponse(lang, {
        hindi: customerNameOrId ? `${customerNameOrId} के लिए कोई पेंडिंग रिमाइंडर नहीं है।` : 'कोई पेंडिंग रिमाइंडर नहीं है।',
        hinglish: customerNameOrId ? `${customerNameOrId} ke liye koi pending reminder nahi hai.` : 'Koi pending reminder nahi hai.',
        english: customerNameOrId ? `No pending reminders for ${customerNameOrId}.` : 'No pending reminders.',
      });
      return { reminders: [], responseText };
    }

    const first = list[0];
    const responseText = formatLocalizedResponse(lang, {
      hindi: `${first.customerName}: ₹${first.amount?.toLocaleString('en-IN') || 0} का रिमाइंडर ${first.dueDate} तक पेंडिंग है।`,
      hinglish: `${first.customerName}: ₹${first.amount?.toLocaleString('en-IN') || 0} reminder due by ${first.dueDate}.`,
      english: `${first.customerName}: reminder for ₹${first.amount?.toLocaleString('en-IN') || 0} due by ${first.dueDate}.`,
    });

    return { reminders: list, responseText };
  }

  // 6c. Update Reminder
  public async updateReminder(params: {
    reminderId: string;
    status?: 'pending' | 'completed';
    dueDate?: string;
    lang?: UserLanguage;
  }): Promise<{ reminder: Reminder | null; responseText: string }> {
    const { reminderId, status, dueDate, lang = 'hinglish' } = params;
    const updated = await updateReminderApi(reminderId, {
      ...(status ? { status } : {}),
      ...(dueDate ? { dueDate } : {}),
    });

    const responseText = formatLocalizedResponse(lang, {
      hindi: 'रिमाइंडर सफलतापूर्वक अपडेट कर दिया गया है।',
      hinglish: 'Reminder update ho gaya.',
      english: 'Reminder updated successfully.',
    });

    return { reminder: updated, responseText };
  }

  // 6d. Delete Reminder
  public async deleteReminder(
    reminderId: string,
    lang: UserLanguage = 'hinglish'
  ): Promise<{ success: boolean; responseText: string }> {
    await deleteReminderApi(reminderId);
    const responseText = formatLocalizedResponse(lang, {
      hindi: 'रिमाइंडर हटा दिया गया है।',
      hinglish: 'Reminder delete kar diya.',
      english: 'Reminder deleted successfully.',
    });
    return { success: true, responseText };
  }

  // 7. Get Report / Summary
  public async getReport(
    period: string = 'today',
    lang: UserLanguage = 'hinglish'
  ): Promise<{ summary: BusinessSummary; responseText: string }> {
    const summary = await fetchBusinessSummary(period);
    const inAmt = summary.moneyIn.toLocaleString('en-IN');
    const outAmt = summary.moneyOut.toLocaleString('en-IN');
    const recAmt = summary.totalReceivables.toLocaleString('en-IN');

    let responseText = '';
    if (period.includes('week') || period.includes('7days')) {
      responseText = formatLocalizedResponse(lang, {
        hindi: `पिछले 7 दिनों में कुल ₹${inAmt} की बिक्री हुई है और ₹${outAmt} का खर्च हुआ है।`,
        hinglish: `Last 7 days mein ₹${inAmt} aaye hain aur ₹${outAmt} kharch hue hain.`,
        english: `In the last 7 days, total income was ₹${inAmt} and expenses were ₹${outAmt}.`,
      });
    } else {
      responseText = formatLocalizedResponse(lang, {
        hindi: `आज कुल ₹${inAmt} आए हैं, ₹${outAmt} का खर्च हुआ है, और बकाया लेनदारी ₹${recAmt} है।`,
        hinglish: `Aaj total ₹${inAmt} aaye hain, ₹${outAmt} ka expense hua hai, aur pending dues ₹${recAmt} hain.`,
        english: `Today's total inflow is ₹${inAmt}, expenses are ₹${outAmt}, and pending dues are ₹${recAmt}.`,
      });
    }

    return { summary, responseText };
  }

  // 8. Navigation (all tabs, subtabs, modals, and UI elements)
  public navigate(
    target: string = 'home',
    options?: NavigationOptions,
    lang: UserLanguage = 'hinglish',
    speechResponse?: string
  ): { success: boolean; responseText: string } {
    if (this.callbacks.onNavigate) {
      this.callbacks.onNavigate(target, options);
    }

    if (speechResponse && speechResponse.trim()) {
      return { success: true, responseText: speechResponse.trim() };
    }

    const targetDescriptions: Record<string, { hi: string; hg: string; en: string }> = {
      home: { hi: 'डैशबोर्ड पेज', hg: 'Home dashboard', en: 'Home dashboard' },
      customers: { hi: 'ग्राहक सूची (खाता बही)', hg: 'Customers khata', en: 'Customers ledger' },
      billing: { hi: 'बिलिंग और इनवॉइस पेज', hg: 'Billing and invoice tab', en: 'Billing and invoice tab' },
      transactions: { hi: 'लेन-देन पासबुक', hg: 'Transactions passbook', en: 'Transactions passbook' },
      stocks: { hi: 'स्टॉक और इन्वेंटरी', hg: 'Stock and inventory', en: 'Stock and inventory' },
      add_customer_modal: { hi: 'नया ग्राहक जोड़ने का फॉर्म', hg: 'Add customer dialog', en: 'Add customer dialog' },
      add_transaction_modal: { hi: 'लेन-देन दर्ज करने का फॉर्म', hg: 'Add transaction dialog', en: 'Add transaction dialog' },
      add_product_modal: { hi: 'नया सामान जोड़ने का फॉर्म', hg: 'Add product dialog', en: 'Add product dialog' },
      customer_ledger_modal: { hi: options?.customerName ? `${options.customerName} का खाता लेजर` : 'कस्टमर लेजर', hg: options?.customerName ? `${options.customerName} ka ledger` : 'Customer ledger', en: options?.customerName ? `${options.customerName}'s ledger` : 'Customer ledger' },
      invoice_modal: { hi: 'बिल रसीद प्रीव्यू', hg: 'Invoice preview', en: 'Invoice preview' },
      settings_modal: { hi: 'दुकान की सेटिंग', hg: 'Shop settings', en: 'Shop settings' },
      search_modal: { hi: 'सर्च बार', hg: 'Search dialog', en: 'Search dialog' },
      voice_modal: { hi: 'वॉयस असिस्टेंट', hg: 'Voice assistant', en: 'Voice assistant' },
      toggle_sidebar: { hi: 'साइडबार मेनू', hg: 'Sidebar menu', en: 'Sidebar menu' },
    };

    const desc = targetDescriptions[target] || { hi: target, hg: target, en: target };

    const responseText = formatLocalizedResponse(lang, {
      hindi: `जी, ${desc.hi} खोल दिया गया है।`,
      hinglish: `Ji, ${desc.hg} open kar diya gaya hai.`,
      english: `Opening ${desc.en} now.`,
    });

    return { success: true, responseText };
  }

  // 9. End Conversation
  public endConversation(
    speechResponse?: string,
    lang: UserLanguage = 'hinglish'
  ): { shouldEndSession: true; responseText: string } {
    const defaultResponse = formatLocalizedResponse(lang, {
      hindi: 'ठीक है, आपका बहुत धन्यवाद! आपका दिन शुभ हो।',
      hinglish: 'Theek hai, dhanyawad! Have a great day.',
      english: 'Alright, thank you! Have a great day.',
    });
    return {
      shouldEndSession: true,
      responseText: speechResponse && speechResponse.trim() ? speechResponse.trim() : defaultResponse,
    };
  }
}

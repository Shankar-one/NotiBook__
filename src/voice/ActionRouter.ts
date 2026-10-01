import { 
  Customer, 
  Transaction 
} from '../types';
import { 
  fetchCustomers, 
  createCustomerApi, 
  deleteCustomerApi, 
  getCustomerByIdOrName 
} from '../api/customers';
import { 
  fetchTransactions, 
  addTransactionApi, 
  deleteTransactionApi 
} from '../api/transactions';
import { 
  fetchReminders, 
  addReminderApi, 
  deleteReminderApi, 
  Reminder 
} from '../api/reminders';
import { 
  fetchBusinessSummary, 
  BusinessSummary 
} from '../api/reports';
import { UserLanguage, formatLocalizedResponse } from './LanguageUtils';

export interface ActionRouterCallbacks {
  onNavigate?: (page: 'home' | 'customers' | 'billing' | 'transactions' | 'stocks') => void;
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

  // 8. Navigation
  public navigate(
    page: 'home' | 'customers' | 'billing' | 'transactions' | 'stocks',
    lang: UserLanguage = 'hinglish'
  ): { success: boolean; responseText: string } {
    if (this.callbacks.onNavigate) {
      this.callbacks.onNavigate(page);
    }
    const pageNames: Record<string, { hi: string; hg: string; en: string }> = {
      home: { hi: 'डैशबोर्ड', hg: 'Home', en: 'Dashboard' },
      customers: { hi: 'कस्टमर्स', hg: 'Customers', en: 'Customers' },
      billing: { hi: 'बिलिंग', hg: 'Billing', en: 'Billing' },
      transactions: { hi: 'खाता लेनदेन', hg: 'Transactions', en: 'Transactions' },
      stocks: { hi: 'स्टॉक इन्वेंटरी', hg: 'Stocks', en: 'Stocks' },
    };
    const p = pageNames[page] || { hi: page, hg: page, en: page };

    const responseText = formatLocalizedResponse(lang, {
      hindi: `${p.hi} पेज खोला जा रहा है।`,
      hinglish: `${p.hg} page open kar raha hoon.`,
      english: `Opening ${p.en} page.`,
    });

    return { success: true, responseText };
  }
}

import { 
  Customer, 
  Transaction,
  Invoice,
  Product,
  StockMovement,
  PaymentMethod
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
  createSaleApi,
  fetchInvoices,
  cancelInvoiceApi
} from '../api/invoices';
import {
  fetchProducts,
  adjustStockApi
} from '../api/products';
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
import { UserLanguage, formatLocalizedResponse, cleanPartyOrCustomerName } from './LanguageUtils';

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
  onInvoiceCreated?: (invoice: Invoice) => void;
  onProductsUpdated?: (products: Product[]) => void;
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
    const isCredit = transactionType === 'credit';
    const delta = isCredit ? -amount : amount;

    if (customerNameOrId) {
      customer = await getCustomerByIdOrName(customerNameOrId);
      if (!customer && customerNameOrId !== 'खाता' && customerNameOrId !== 'Customer' && customerNameOrId !== 'New Customer' && customerNameOrId.length >= 2) {
        try {
          customer = await createCustomerApi({
            name: customerNameOrId,
            balance: delta,
            status: delta > 0 ? 'due' : delta < 0 ? 'advance' : 'settled',
          });
        } catch (e) {
          console.warn('Could not auto-create customer:', e);
        }
      } else if (customer) {
        const newBalance = customer.balance + delta;
        customer = {
          ...customer,
          balance: newBalance,
          status: newBalance > 0 ? 'due' : newBalance < 0 ? 'advance' : 'settled',
          lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
        };
        try {
          await updateCustomerApi(customer.id, customer);
        } catch {}
      }
    }

    const tx = await addTransactionApi({
      customerId: customer?.id,
      partyName: customer ? customer.name : customerNameOrId,
      amount,
      transactionType,
      paymentMode,
      description: description || (customer ? `${transactionType === 'credit' ? 'Payment from' : 'Given to'} ${customer.name}` : undefined),
    });

    const finalCustomer = tx.customer || customer;

    if (finalCustomer && this.callbacks.onCustomerUpdated) {
      this.callbacks.onCustomerUpdated(finalCustomer);
    }
    if (this.callbacks.onTransactionAdded) {
      this.callbacks.onTransactionAdded(tx);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const name = finalCustomer ? finalCustomer.name : (customerNameOrId || 'खाता');

    const responseText = formatLocalizedResponse(lang, {
      hindi: `हो गया। ${name} के खाते में ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'जमा (क्रेडिट)' : 'उधार (डेबिट)'} जोड़ दिए गए हैं।`,
      hinglish: `Done. ${name} ke account mein ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'jama (credit)' : 'udhar (debit)'} add kar diya.`,
      english: `Done. Added ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'credit' : 'debit'} to ${name}'s account.`,
    });

    return { transaction: tx, customer: finalCustomer || undefined, responseText };
  }

  // 3. Create Sale & Billing (Atomic pipeline: invoice, stock deduction, payment, customer khata)
  public async createSale(params: {
    customerName: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    totalAmount?: number;
    paidAmount?: number;
    paymentMethod?: PaymentMethod;
    notes?: string;
    lang?: UserLanguage;
  }): Promise<{ invoice: Invoice; transaction?: Transaction; customer: Customer; responseText: string }> {
    const {
      customerName,
      productName = 'Item',
      quantity = 1,
      unitPrice,
      totalAmount,
      paidAmount,
      paymentMethod = 'Cash',
      notes,
      lang = 'hinglish',
    } = params;

    const items = [{
      name: productName,
      qty: quantity,
      price: unitPrice || (totalAmount ? totalAmount / quantity : undefined),
    }];

    const result = await createSaleApi({
      customerName,
      items,
      paidAmount,
      paymentMethod,
      notes,
    });

    if (this.callbacks.onInvoiceCreated) {
      this.callbacks.onInvoiceCreated(result.invoice);
    }
    if (this.callbacks.onCustomerUpdated) {
      this.callbacks.onCustomerUpdated(result.customer);
    }
    if (result.transaction && this.callbacks.onTransactionAdded) {
      this.callbacks.onTransactionAdded(result.transaction);
    }
    if (result.updatedProducts && this.callbacks.onProductsUpdated) {
      this.callbacks.onProductsUpdated(result.updatedProducts);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const isPaidInFull = result.invoice.dueAmount === 0;
    const isCredit = result.invoice.paymentStatus === 'Due';
    const responseText = formatLocalizedResponse(lang, {
      hindi: isCredit
        ? `${result.customer.name} के नाम ₹${result.invoice.grandTotal.toLocaleString('en-IN')} का बिल उधार पर दर्ज कर दिया है। स्टॉक अपडेट हो गया है। कुल बकाया ₹${result.customer.balance.toLocaleString('en-IN')} है।`
        : `${result.customer.name} का ₹${result.invoice.grandTotal.toLocaleString('en-IN')} का बिल बन गया है और ₹${(result.invoice.paidAmount || 0).toLocaleString('en-IN')} ${result.invoice.paymentMode} से प्राप्त हुए। ${isPaidInFull ? 'खाता चुकता है।' : `बाकी ₹${result.invoice.dueAmount?.toLocaleString('en-IN')} बकाया है।`}`,
      hinglish: isCredit
        ? `${result.customer.name} ke naam ₹${result.invoice.grandTotal.toLocaleString('en-IN')} ka bill udhaar par record kar diya. Stock deduct ho gaya. Total due ₹${result.customer.balance.toLocaleString('en-IN')} hai.`
        : `${result.customer.name} ka ₹${result.invoice.grandTotal.toLocaleString('en-IN')} ka bill create ho gaya aur ₹${(result.invoice.paidAmount || 0).toLocaleString('en-IN')} ${result.invoice.paymentMode} se receive ho gaye. ${isPaidInFull ? 'Fully paid.' : `Pending due ₹${result.invoice.dueAmount?.toLocaleString('en-IN')} hai.`}`,
      english: isCredit
        ? `Created ₹${result.invoice.grandTotal.toLocaleString('en-IN')} credit invoice for ${result.customer.name}. Stock updated. Total due is ₹${result.customer.balance.toLocaleString('en-IN')}.`
        : `Created ₹${result.invoice.grandTotal.toLocaleString('en-IN')} invoice for ${result.customer.name}. Received ₹${(result.invoice.paidAmount || 0).toLocaleString('en-IN')} via ${result.invoice.paymentMode}. ${isPaidInFull ? 'Paid in full.' : `Remaining due is ₹${result.invoice.dueAmount?.toLocaleString('en-IN')}.`}`,
    });

    return { ...result, responseText };
  }

  // 3b. Record Payment (UPI, Cash, Card, Bank Transfer) - Section 3, 4, 5, 6, 7
  public async recordPayment(params: {
    customerNameOrId: string;
    amount: number;
    paymentMethod?: PaymentMethod;
    direction?: 'INCOME' | 'OUTGOING';
    description?: string;
    lang?: UserLanguage;
  }): Promise<{ transaction: Transaction; customer?: Customer; responseText: string }> {
    const {
      customerNameOrId,
      amount,
      paymentMethod = 'UPI',
      direction = 'INCOME',
      description,
      lang = 'hinglish',
    } = params;

    let customer: Customer | null = null;
    const isIncome = direction === 'INCOME';

    if (isIncome && customerNameOrId && customerNameOrId.toLowerCase() !== 'supplier') {
      customer = await getCustomerByIdOrName(customerNameOrId);
      if (!customer && customerNameOrId.length >= 2) {
        try {
          customer = await createCustomerApi({
            name: customerNameOrId,
            balance: -amount,
            status: 'advance',
          });
        } catch {}
      } else if (customer) {
        const newBalance = customer.balance - amount;
        customer = {
          ...customer,
          balance: newBalance,
          status: newBalance > 0 ? 'due' : newBalance < 0 ? 'advance' : 'settled',
          lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
        };
        try {
          await updateCustomerApi(customer.id, customer);
        } catch {}
      }
    }

    const partyName = customer ? customer.name : customerNameOrId;
    const tx = await addTransactionApi({
      customerId: customer?.id,
      partyName,
      amount,
      transactionType: isIncome ? 'credit' : 'debit',
      paymentMode: paymentMethod,
      category: isIncome ? 'Customer Payment' : 'Supplier Payment',
      description: description || (isIncome 
        ? `Payment received via ${paymentMethod} from ${partyName}`
        : `Payment sent via ${paymentMethod} to ${partyName}`
      ),
    });

    const finalCustomer = tx.customer || customer;

    if (finalCustomer && this.callbacks.onCustomerUpdated) {
      this.callbacks.onCustomerUpdated(finalCustomer);
    }
    if (this.callbacks.onTransactionAdded) {
      this.callbacks.onTransactionAdded(tx);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: isIncome
        ? `${partyName} से ₹${amount.toLocaleString('en-IN')} ${paymentMethod} द्वारा प्राप्त हुए।${customer ? ` नया बकाया ₹${customer.balance.toLocaleString('en-IN')} है।` : ''}`
        : `${partyName} को ₹${amount.toLocaleString('en-IN')} ${paymentMethod} द्वारा भुगतान कर दिया गया है।`,
      hinglish: isIncome
        ? `${partyName} se ₹${amount.toLocaleString('en-IN')} ${paymentMethod} se receive ho gaye.${customer ? ` Current due ₹${customer.balance.toLocaleString('en-IN')} hai.` : ''}`
        : `${partyName} ko ₹${amount.toLocaleString('en-IN')} ${paymentMethod} se payment sent kar diya.`,
      english: isIncome
        ? `Received ₹${amount.toLocaleString('en-IN')} from ${partyName} via ${paymentMethod}.${customer ? ` Outstanding balance is now ₹${customer.balance.toLocaleString('en-IN')}.` : ''}`
        : `Sent ₹${amount.toLocaleString('en-IN')} payment to ${partyName} via ${paymentMethod}.`,
    });

    return { transaction: tx, customer: customer || undefined, responseText };
  }

  // 4. Manage Stock (adjust, stock_in / purchase, stock_out, get)
  public async manageStock(params: {
    action: 'adjust' | 'stock_in' | 'stock_out' | 'get';
    productName: string;
    quantity?: number;
    paymentMethod?: PaymentMethod;
    paidAmount?: number;
    lang?: UserLanguage;
  }): Promise<{ product?: Product; movement?: StockMovement; responseText: string }> {
    const { action, productName, quantity = 0, paymentMethod, paidAmount, lang = 'hinglish' } = params;
    const products = await fetchProducts();
    const prod = products.find(p => p.name.toLowerCase().includes(productName.toLowerCase().trim()));

    if (action === 'get') {
      if (!prod) {
        const notFound = formatLocalizedResponse(lang, {
          hindi: `सामान "${productName}" स्टॉक में नहीं मिला।`,
          hinglish: `Item "${productName}" stock me nahi mila.`,
          english: `Item "${productName}" not found in stock.`,
        });
        return { responseText: notFound };
      }
      const responseText = formatLocalizedResponse(lang, {
        hindi: `${prod.name} का वर्तमान स्टॉक ${prod.stockQty} ${prod.unit} है।`,
        hinglish: `${prod.name} ka current stock ${prod.stockQty} ${prod.unit} hai.`,
        english: `Current stock of ${prod.name} is ${prod.stockQty} ${prod.unit}.`,
      });
      return { product: prod, responseText };
    }

    let reason: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN' = 'ADJUSTMENT';
    let newQty: number | undefined;
    let deltaQty: number | undefined;

    if (action === 'adjust') {
      newQty = quantity;
      reason = 'ADJUSTMENT';
    } else if (action === 'stock_in') {
      deltaQty = quantity;
      reason = 'PURCHASE';
    } else if (action === 'stock_out') {
      deltaQty = -quantity;
      reason = 'ADJUSTMENT';
    }

    const result = await adjustStockApi({
      productName,
      newQty,
      deltaQty,
      reason,
      referenceId: `Voice command: ${action}`,
    });

    // If money was paid to supplier
    if (paidAmount && paidAmount > 0) {
      const mode = paymentMethod || 'UPI';
      const tx = await addTransactionApi({
        amount: paidAmount,
        transactionType: 'debit',
        paymentMode: mode,
        category: 'Supplier Payment',
        description: `Payment to supplier for ${result.product.name} stock`,
        partyName: 'Supplier',
      });
      if (this.callbacks.onTransactionAdded) {
        this.callbacks.onTransactionAdded(tx);
      }
    }

    const updatedAll = await fetchProducts();
    if (this.callbacks.onProductsUpdated) {
      this.callbacks.onProductsUpdated(updatedAll);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: action === 'adjust'
        ? `${result.product.name} का स्टॉक अब ${result.product.stockQty} ${result.product.unit} कर दिया गया है।`
        : action === 'stock_in'
        ? `स्टॉक में ${quantity} ${result.product.unit} ${result.product.name} जोड़ दिए गए हैं। अब कुल स्टॉक ${result.product.stockQty} है।`
        : `${result.product.name} के ${quantity} ${result.product.unit} कम कर दिए गए हैं। अब कुल स्टॉक ${result.product.stockQty} है।`,
      hinglish: action === 'adjust'
        ? `${result.product.name} ka stock ab ${result.product.stockQty} ${result.product.unit} set kar diya hai.`
        : action === 'stock_in'
        ? `Stock me ${quantity} ${result.product.unit} ${result.product.name} add kar diye hain. Total stock ab ${result.product.stockQty} hai.`
        : `${result.product.name} ke ${quantity} ${result.product.unit} kam kar diye hain. Total stock ab ${result.product.stockQty} hai.`,
      english: action === 'adjust'
        ? `Stock of ${result.product.name} adjusted to ${result.product.stockQty} ${result.product.unit}.`
        : action === 'stock_in'
        ? `Added ${quantity} ${result.product.unit} of ${result.product.name} to stock. Total is now ${result.product.stockQty}.`
        : `Reduced ${quantity} ${result.product.unit} from ${result.product.name}. Total stock is now ${result.product.stockQty}.`,
    });

    return { product: result.product, movement: result.movement, responseText };
  }

  // 5. Payment Summary (UPI, Cash, Card, etc. received today)
  public async getPaymentSummary(params: {
    paymentMethod: 'UPI' | 'Cash' | 'Card' | 'Bank Transfer' | 'All';
    period?: 'today' | 'week' | 'month';
    lang?: UserLanguage;
  }): Promise<{ total: number; count: number; responseText: string }> {
    const { paymentMethod, lang = 'hinglish' } = params;
    const allTx = await fetchTransactions();

    const matching = allTx.filter(t => {
      const isIncome = t.type === 'in' || t.direction === 'INCOME';
      if (!isIncome) return false;
      const isMethod = paymentMethod === 'All' || t.paymentMode?.toLowerCase() === paymentMethod.toLowerCase();
      if (!isMethod) return false;
      return true;
    });

    const total = matching.reduce((sum, t) => sum + t.amount, 0);
    const count = matching.length;

    const responseText = formatLocalizedResponse(lang, {
      hindi: paymentMethod === 'All'
        ? `आज कुल ${count} पेमेंट से ₹${total.toLocaleString('en-IN')} प्राप्त हुए हैं।`
        : `आज ${paymentMethod} द्वारा कुल ₹${total.toLocaleString('en-IN')} प्राप्त हुए हैं (${count} लेनदेन)।`,
      hinglish: paymentMethod === 'All'
        ? `Aaj total ${count} payments se ₹${total.toLocaleString('en-IN')} receive hue hain.`
        : `Aaj ${paymentMethod} se total ₹${total.toLocaleString('en-IN')} receive hue hain (${count} transactions).`,
      english: paymentMethod === 'All'
        ? `Total payments received today: ₹${total.toLocaleString('en-IN')} across ${count} entries.`
        : `Total ${paymentMethod} received today is ₹${total.toLocaleString('en-IN')} across ${count} entries.`,
    });

    return { total, count, responseText };
  }

  // 6. Get Invoices / Latest Bill
  public async getInvoices(params: {
    customerName?: string;
    invoiceId?: string;
    lang?: UserLanguage;
  }): Promise<{ invoice?: Invoice; invoices: Invoice[]; responseText: string }> {
    const { customerName, invoiceId, lang = 'hinglish' } = params;
    const all = await fetchInvoices();
    let filtered = all;

    if (customerName) {
      filtered = all.filter(i => i.customerName.toLowerCase().includes(customerName.toLowerCase().trim()));
    }
    if (invoiceId) {
      filtered = all.filter(i => i.id === invoiceId || i.invoiceNumber.toLowerCase().includes(invoiceId.toLowerCase()));
    }

    const latest = filtered[0];
    if (!latest) {
      const responseText = formatLocalizedResponse(lang, {
        hindi: `${customerName ? customerName + ' का ' : ''}कोई बिल नहीं मिला।`,
        hinglish: `${customerName ? customerName + ' ka ' : ''}koi bill nahi mila.`,
        english: `No invoice found${customerName ? ' for ' + customerName : ''}.`,
      });
      return { invoices: [], responseText };
    }

    if (this.callbacks.onNavigate) {
      this.callbacks.onNavigate('invoice_modal');
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: `${latest.customerName} का बिल ${latest.invoiceNumber} कुल ₹${latest.grandTotal.toLocaleString('en-IN')} का है (${latest.items.length} सामान)।`,
      hinglish: `${latest.customerName} ka bill ${latest.invoiceNumber} ₹${latest.grandTotal.toLocaleString('en-IN')} ka hai (${latest.items.length} items).`,
      english: `Invoice ${latest.invoiceNumber} for ${latest.customerName} is for ₹${latest.grandTotal.toLocaleString('en-IN')} with ${latest.items.length} items.`,
    });

    return { invoice: latest, invoices: filtered, responseText };
  }

  // 7. Cancel Invoice
  public async cancelInvoice(params: {
    invoiceId?: string;
    customerName?: string;
    lang?: UserLanguage;
  }): Promise<{ success: boolean; responseText: string }> {
    const { invoiceId, customerName, lang = 'hinglish' } = params;
    const all = await fetchInvoices();
    const target = all.find(i => 
      (invoiceId && (i.id === invoiceId || i.invoiceNumber === invoiceId)) ||
      (customerName && i.customerName.toLowerCase().includes(customerName.toLowerCase().trim()))
    );

    if (!target) {
      const responseText = formatLocalizedResponse(lang, {
        hindi: 'रद्द करने के लिए कोई बिल नहीं मिला।',
        hinglish: 'Cancel karne ke liye koi invoice nahi mila.',
        english: 'No invoice found to cancel.',
      });
      return { success: false, responseText };
    }

    await cancelInvoiceApi(target.id);
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: `बिल ${target.invoiceNumber} रद्द कर दिया गया है। सामान का स्टॉक और ग्राहक का हिसाब रीसेट हो गया है।`,
      hinglish: `Bill ${target.invoiceNumber} cancel kar diya hai. Stock aur customer balance restore ho gaya.`,
      english: `Invoice ${target.invoiceNumber} has been cancelled. Stock and customer balance restored.`,
    });

    return { success: true, responseText };
  }

  // 7b. Update Bill ("Ravi ka bill 500 ka kar do")
  public async updateBill(params: {
    customerName: string;
    newAmount: number;
    lang?: UserLanguage;
  }): Promise<{ invoice?: Invoice; responseText: string }> {
    const { customerName, newAmount, lang = 'hinglish' } = params;
    const all = await fetchInvoices();
    const target = all.find(i => i.customerName.toLowerCase().includes(customerName.toLowerCase().trim()));

    if (!target) {
      const responseText = formatLocalizedResponse(lang, {
        hindi: `${customerName} का कोई बिल नहीं मिला।`,
        hinglish: `${customerName} ka koi bill nahi mila.`,
        english: `No invoice found for ${customerName}.`,
      });
      return { responseText };
    }

    const oldTotal = target.grandTotal;
    target.grandTotal = newAmount;
    target.subtotal = newAmount;
    if (target.items.length > 0) {
      target.items[0].price = newAmount / target.items[0].qty;
      target.items[0].total = newAmount;
    }
    if (target.paymentStatus === 'Due') {
      target.dueAmount = newAmount;
    } else {
      target.paidAmount = newAmount;
    }

    const savedInvoices = all.map(i => i.id === target.id ? target : i);
    localStorage.setItem('notibook_invoices', JSON.stringify(savedInvoices));

    // Update customer balance delta
    const delta = newAmount - oldTotal;
    const cust = await getCustomerByIdOrName(customerName);
    if (cust && target.paymentStatus === 'Due') {
      cust.balance += delta;
      await updateCustomerApi(cust.id, cust);
      if (this.callbacks.onCustomerUpdated) {
        this.callbacks.onCustomerUpdated(cust);
      }
    }

    if (this.callbacks.onInvoiceCreated) {
      this.callbacks.onInvoiceCreated(target);
    }
    if (this.callbacks.onRefreshData) {
      this.callbacks.onRefreshData();
    }

    const responseText = formatLocalizedResponse(lang, {
      hindi: `${target.customerName} का बिल अपडेट करके ₹${newAmount.toLocaleString('en-IN')} का कर दिया गया है।`,
      hinglish: `${target.customerName} ka bill update karke ₹${newAmount.toLocaleString('en-IN')} kar diya hai.`,
      english: `Updated ${target.customerName}'s invoice to ₹${newAmount.toLocaleString('en-IN')}.`,
    });

    return { invoice: target, responseText };
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

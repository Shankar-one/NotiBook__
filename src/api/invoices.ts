import { Invoice, Transaction, Customer, Product, StockMovement, PaymentMethod } from '../types';
import { apiRequest } from './apiClient';
import { sampleInvoices } from '../data/mockData';
import { fetchProducts } from './products';
import { fetchCustomers, createCustomerApi } from './customers';

export async function fetchInvoices(): Promise<Invoice[]> {
  try {
    const res = await apiRequest<{ invoices: Invoice[] }>('/api/invoices');
    if (res?.invoices && Array.isArray(res.invoices)) {
      localStorage.setItem('notibook_invoices', JSON.stringify(res.invoices));
      return res.invoices;
    }
  } catch {}
  const saved = localStorage.getItem('notibook_invoices');
  return saved ? JSON.parse(saved) : sampleInvoices;
}

export async function createSaleApi(params: {
  customerName: string;
  items: { productId?: string; name: string; qty: number; price?: number }[];
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  discountPercent?: number;
  notes?: string;
}): Promise<{
  invoice: Invoice;
  transaction?: Transaction;
  customer: Customer;
  updatedProducts: Product[];
  stockMovements: StockMovement[];
}> {
  try {
    const res = await apiRequest<{
      invoice: Invoice;
      transaction?: Transaction;
      customer: Customer;
      updatedProducts: Product[];
      stockMovements: StockMovement[];
    }>('/api/sales/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (res?.invoice) {
      // Sync local storage caches
      const savedInvoices = await fetchInvoices();
      localStorage.setItem('notibook_invoices', JSON.stringify([res.invoice, ...savedInvoices.filter(i => i.id !== res.invoice.id)]));

      if (res.customer) {
        const savedCustomers = await fetchCustomers();
        const updatedCusts = [res.customer, ...savedCustomers.filter(c => c.id !== res.customer.id && c.name.toLowerCase() !== res.customer.name.toLowerCase())];
        localStorage.setItem('notibook_customers', JSON.stringify(updatedCusts));
      }

      if (res.transaction) {
        const savedTx = JSON.parse(localStorage.getItem('notibook_transactions') || '[]');
        localStorage.setItem('notibook_transactions', JSON.stringify([res.transaction, ...savedTx.filter((t: any) => t.id !== res.transaction!.id)]));
      }

      if (res.updatedProducts && res.updatedProducts.length > 0) {
        const savedProds = await fetchProducts();
        const updatedProds = savedProds.map(p => {
          const match = res.updatedProducts.find(up => up.id === p.id);
          return match || p;
        });
        localStorage.setItem('notibook_products', JSON.stringify(updatedProds));
      }

      return res;
    }
  } catch {}

  // Client-side atomic fallback
  const allProducts = await fetchProducts();
  const allCustomers = await fetchCustomers();

  // 1. Resolve or create customer
  let customer = allCustomers.find(c => c.name.toLowerCase() === params.customerName.toLowerCase().trim());
  if (!customer) {
    customer = await createCustomerApi({
      name: params.customerName.trim(),
      balance: 0,
      phone: '+91 98000 00000',
    });
  }

  // 2. Validate products & stock deduction
  const stockMovements: StockMovement[] = [];
  const updatedProducts: Product[] = [];
  const billItems: Invoice['items'] = [];

  for (const item of params.items) {
    const prod = allProducts.find(p => 
      (item.productId && p.id === item.productId) || 
      p.name.toLowerCase().includes(item.name.toLowerCase().trim())
    );

    const price = item.price || (prod ? prod.sellPrice : 50);
    const itemTotal = price * item.qty;

    billItems.push({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: prod ? prod.name : item.name,
      qty: item.qty,
      price,
      total: itemTotal,
      productId: prod?.id,
    });

    if (prod) {
      const prevQty = prod.stockQty;
      prod.stockQty = Math.max(0, prod.stockQty - item.qty);
      updatedProducts.push(prod);

      stockMovements.push({
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: prod.id,
        productName: prod.name,
        changeQty: -item.qty,
        reason: 'SALE',
        referenceId: `Sale to ${customer.name}`,
        date: new Intl.DateTimeFormat('en-CA').format(new Date()),
        finalQty: prod.stockQty,
      });
    }
  }

  localStorage.setItem('notibook_products', JSON.stringify(allProducts));

  // 3. Compute Invoice amounts
  const subtotal = billItems.reduce((sum, i) => sum + i.total, 0);
  const discountPercent = params.discountPercent || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxPercent = 0; // standard bill
  const grandTotal = Math.round((taxableAmount + (taxableAmount * taxPercent) / 100) * 100) / 100;

  const paymentMethod: PaymentMethod = params.paymentMethod || 'Cash';
  const paidAmount = params.paidAmount !== undefined ? params.paidAmount : (paymentMethod === 'Credit' ? 0 : grandTotal);
  const dueAmount = Math.max(0, grandTotal - paidAmount);

  let paymentStatus: Invoice['paymentStatus'] = 'Paid';
  if (paidAmount === 0) {
    paymentStatus = 'Due';
  } else if (dueAmount > 0) {
    paymentStatus = 'Partial';
  }

  const invoiceNumber = `#INV-${1000 + Math.floor(Math.random() * 9000)}`;
  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber,
    customerName: customer.name,
    customerId: customer.id,
    date: new Intl.DateTimeFormat('en-CA').format(new Date()),
    items: billItems,
    subtotal,
    discountPercent,
    discountAmount,
    taxPercent: 0,
    taxAmount: 0,
    grandTotal,
    paidAmount,
    dueAmount,
    paymentMode: paymentMethod,
    paymentStatus,
    notes: params.notes || `Sale of ${billItems.length} item(s)`,
  };

  const savedInvoices: Invoice[] = JSON.parse(localStorage.getItem('notibook_invoices') || '[]');
  savedInvoices.unshift(invoice);
  localStorage.setItem('notibook_invoices', JSON.stringify(savedInvoices));

  // 4. Update customer outstanding balance: increases by dueAmount
  let transaction: Transaction | undefined;
  if (dueAmount > 0) {
    customer.balance = (customer.balance || 0) + dueAmount;
    customer.status = customer.balance > 0 ? 'due' : 'settled';
    customer.lastTransactionDate = new Intl.DateTimeFormat('en-CA').format(new Date());
    const custIndex = allCustomers.findIndex(c => c.id === customer!.id);
    if (custIndex !== -1) {
      allCustomers[custIndex] = customer;
    } else {
      allCustomers.unshift(customer);
    }
    localStorage.setItem('notibook_customers', JSON.stringify(allCustomers));
  }

  // 5. Create real financial transaction ONLY for actual money received
  if (paidAmount > 0) {
    transaction = {
      id: `tx-${Date.now()}`,
      date: new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
      type: 'in',
      direction: 'INCOME',
      category: 'Sale',
      description: `Payment received for ${invoiceNumber}`,
      partyName: customer.name,
      paymentMode: paymentMethod,
      amount: paidAmount,
      invoiceId: invoice.id,
      customerId: customer.id,
    };

    const savedTx: Transaction[] = JSON.parse(localStorage.getItem('notibook_transactions') || '[]');
    savedTx.unshift(transaction);
    localStorage.setItem('notibook_transactions', JSON.stringify(savedTx));
  }

  return {
    invoice,
    transaction,
    customer,
    updatedProducts,
    stockMovements,
  };
}

export async function cancelInvoiceApi(invoiceId: string): Promise<boolean> {
  try {
    await apiRequest(`/api/invoices/${invoiceId}/cancel`, { method: 'POST' });
    return true;
  } catch {
    const savedInvoices: Invoice[] = JSON.parse(localStorage.getItem('notibook_invoices') || '[]');
    const inv = savedInvoices.find(i => i.id === invoiceId);
    if (!inv) return false;

    inv.paymentStatus = 'Cancelled';
    localStorage.setItem('notibook_invoices', JSON.stringify(savedInvoices));

    // Restore stock
    const products = await fetchProducts();
    for (const item of inv.items) {
      const prod = products.find(p => p.id === item.productId || p.name === item.name);
      if (prod) {
        prod.stockQty += item.qty;
      }
    }
    localStorage.setItem('notibook_products', JSON.stringify(products));
    return true;
  }
}

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize GoogleGenAI on server with User-Agent header
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// In-memory persistent database store (with fallback default mock data)
let customers = [
  { id: 'cust-1', name: 'Rahul Sharma', phone: '+91 98201 12345', address: 'Sector 4, Andheri East', balance: 2450, lastTransactionDate: '2024-06-17', status: 'due', createdAt: '2024-01-10' },
  { id: 'cust-2', name: 'Amit Verma', phone: '+91 98334 56789', address: 'Lokhandwala Complex', balance: 3100, lastTransactionDate: '2024-06-16', status: 'due', createdAt: '2024-02-14' },
  { id: 'cust-3', name: 'Sunita Patel', phone: '+91 97690 98765', address: 'Powai Vihar', balance: 2380, lastTransactionDate: '2024-06-15', status: 'due', createdAt: '2024-03-01' },
  { id: 'cust-4', name: 'Vikas Gupta', phone: '+91 99200 44556', address: 'Bandra West', balance: 0, lastTransactionDate: '2024-06-18', status: 'settled', createdAt: '2024-03-22' },
  { id: 'cust-5', name: 'Ravi Kumar', phone: '+91 98111 22334', address: 'Goregaon West', balance: 2500, lastTransactionDate: '2024-06-18', status: 'due', createdAt: '2024-04-10' },
  { id: 'cust-6', name: 'Ravi Sharma', phone: '+91 98222 33445', address: 'Malad East', balance: 1400, lastTransactionDate: '2024-06-14', status: 'due', createdAt: '2024-05-12' },
];

let products = [
  { id: 'prod-0', name: 'Biscuit', category: 'Grocery & Snacks', stockQty: 40, lowStockThreshold: 10, buyPrice: 40, sellPrice: 50, unit: 'packet', sku: 'SNK-BIS-01' },
  { id: 'prod-1', name: 'Classmate Deluxe Notebook 240p', category: 'Stationery', stockQty: 85, lowStockThreshold: 20, buyPrice: 65, sellPrice: 90, unit: 'pcs', sku: 'STA-NOTE-01' },
  { id: 'prod-2', name: 'Reynolds Ballpoint Pen Blue (Pack of 10)', category: 'Stationery', stockQty: 40, lowStockThreshold: 15, buyPrice: 70, sellPrice: 100, unit: 'pack', sku: 'STA-PEN-02' },
  { id: 'prod-3', name: 'Asian Paints Apex Emulsion 4L White', category: 'Paints', stockQty: 8, lowStockThreshold: 10, buyPrice: 1450, sellPrice: 1850, unit: 'can', sku: 'PNT-APX-04' },
  { id: 'prod-4', name: 'Professional Paint Roller 9-inch', category: 'Tools', stockQty: 5, lowStockThreshold: 8, buyPrice: 160, sellPrice: 240, unit: 'pcs', sku: 'TLS-ROL-09' },
  { id: 'prod-5', name: 'Birla White WallCare Putty 20kg', category: 'Building Materials', stockQty: 18, lowStockThreshold: 10, buyPrice: 720, sellPrice: 890, unit: 'bag', sku: 'BLD-PUT-20' },
  { id: 'prod-6', name: 'Rust-Oleum Anti-Rust Primer Spray 400ml', category: 'Paints', stockQty: 3, lowStockThreshold: 6, buyPrice: 380, sellPrice: 520, unit: 'can', sku: 'PNT-SPR-01' },
  { id: 'prod-7', name: 'Fevicol SH Synthetic Adhesive 1kg', category: 'Hardware', stockQty: 24, lowStockThreshold: 10, buyPrice: 220, sellPrice: 280, unit: 'jar', sku: 'HDW-FEV-01' },
];

let invoices = [
  {
    id: 'inv-1001',
    invoiceNumber: '#INV-1001',
    customerName: 'Walk-In Customer',
    date: '2024-06-18',
    items: [
      { id: 'item-1', name: 'Classmate Deluxe Notebook 240p', qty: 3, price: 90, total: 270 },
      { id: 'item-2', name: 'Reynolds Ballpoint Pen Blue (Pack of 10)', qty: 2, price: 100, total: 200 }
    ],
    subtotal: 470,
    discountPercent: 10,
    discountAmount: 47,
    taxPercent: 18,
    taxAmount: 76.14,
    grandTotal: 499.14,
    paidAmount: 499.14,
    dueAmount: 0,
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
    notes: 'Paid at counter',
  },
  {
    id: 'inv-1002',
    invoiceNumber: '#INV-1002',
    customerName: 'Rahul Sharma',
    customerId: 'cust-1',
    customerPhone: '+91 98201 12345',
    date: '2024-06-18',
    items: [
      { id: 'item-3', name: 'Asian Paints Apex Emulsion 4L White', qty: 2, price: 1850, total: 3700 },
      { id: 'item-4', name: 'Professional Paint Roller 9-inch', qty: 2, price: 240, total: 480 }
    ],
    subtotal: 4180,
    discountPercent: 5,
    discountAmount: 209,
    taxPercent: 18,
    taxAmount: 714.78,
    grandTotal: 4685.78,
    paidAmount: 4685.78,
    dueAmount: 0,
    paymentMode: 'UPI',
    paymentStatus: 'Paid',
    notes: 'Delivery to Andheri East site',
  },
];

let stockMovements = [
  { id: 'sm-1', productId: 'prod-1', productName: 'Classmate Deluxe Notebook 240p', changeQty: -3, reason: 'SALE', referenceId: '#INV-1001', date: '2024-06-18', finalQty: 85 },
  { id: 'sm-2', productId: 'prod-2', productName: 'Reynolds Ballpoint Pen Blue (Pack of 10)', changeQty: -2, reason: 'SALE', referenceId: '#INV-1001', date: '2024-06-18', finalQty: 40 },
];

let transactions = [
  { id: 'tx-1', date: '2024-06-18 10:15', type: 'in', category: 'Sale', description: 'Cash sale (Stationery)', partyName: 'Walk-In Customer', paymentMode: 'Cash', amount: 500 },
  { id: 'tx-2', date: '2024-06-18 09:40', type: 'in', category: 'Sale', description: 'Paint & Roller invoice', partyName: 'Rahul Sharma', paymentMode: 'UPI', amount: 4685 },
  { id: 'tx-3', date: '2024-06-18 08:30', type: 'out', category: 'Expense', description: 'Tea and breakfast for shop assistants', partyName: 'Sharma Tea Stall', paymentMode: 'Cash', amount: 140 },
  { id: 'tx-4', date: '2024-06-17 18:20', type: 'in', category: 'Customer Payment', description: 'Khata due settlement received', partyName: 'Sunita Patel', paymentMode: 'UPI', amount: 2500 },
];

let reminders = [
  { id: 'rem-1', customerName: 'Rahul Sharma', amount: 2450, dueDate: '2024-06-20', message: 'Payment reminder for paints order', status: 'pending', createdAt: '2024-06-17' },
];

// --- REST API ENDPOINTS ---

// Customers
app.get('/api/customers', (req, res) => {
  res.json({ customers });
});

app.get('/api/customers/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  const filtered = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  res.json({ customers: filtered });
});

app.post('/api/customers', (req, res) => {
  const { name, phone, address, balance } = req.body;
  const newCust = {
    id: `cust-${Date.now()}`,
    name: name || 'New Customer',
    phone: phone || '+91 98000 00000',
    address: address || '',
    balance: balance || 0,
    lastTransactionDate: new Date().toISOString().slice(0, 10),
    status: (balance || 0) > 0 ? 'due' : 'settled',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  customers.unshift(newCust);
  res.json({ customer: newCust });
});

app.delete('/api/customers/:id', (req, res) => {
  customers = customers.filter(c => c.id !== req.params.id);
  res.json({ success: true });
});

app.put('/api/customers/:id', (req, res) => {
  const index = customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Customer not found' });
  customers[index] = { ...customers[index], ...req.body };
  res.json({ customer: customers[index] });
});

// Transactions
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

app.post('/api/transactions', (req, res) => {
  const { customerId, partyName, amount, transactionType, paymentMode, description, category } = req.body;
  const isCredit = transactionType === 'credit';
  const newTx = {
    id: `tx-${Date.now()}`,
    date: new Date().toLocaleString('en-IN', { hour12: false }),
    type: isCredit ? 'in' : 'out',
    category: category || (isCredit ? 'Customer Payment' : 'Expense'),
    description: description || `${isCredit ? 'Payment from' : 'Given to'} ${partyName || 'Customer'}`,
    partyName,
    paymentMode: paymentMode || 'Cash',
    amount: Number(amount) || 0,
  };
  transactions.unshift(newTx);

  // Update customer balance if applicable
  if (partyName && partyName !== 'खाता' && partyName !== 'Customer') {
    const cust = customers.find(c => c.name.toLowerCase() === partyName.toLowerCase());
    if (cust) {
      const delta = isCredit ? -newTx.amount : newTx.amount;
      cust.balance += delta;
      cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
    } else {
      const delta = isCredit ? -newTx.amount : newTx.amount;
      const newCust = {
        id: `cust-${Date.now()}`,
        name: partyName,
        phone: '+91 98000 00000',
        address: '',
        balance: delta,
        lastTransactionDate: new Date().toISOString().slice(0, 10),
        status: delta > 0 ? 'due' : 'settled',
        createdAt: new Date().toISOString().slice(0, 10),
      };
      customers.unshift(newCust);
    }
  }

  res.json({ transaction: newTx });
});

app.put('/api/transactions/:id', (req, res) => {
  const index = transactions.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Transaction not found' });
  transactions[index] = { ...transactions[index], ...req.body };
  res.json({ transaction: transactions[index] });
});

app.delete('/api/transactions/:id', (req, res) => {
  transactions = transactions.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

// Reminders
app.get('/api/reminders', (req, res) => {
  res.json({ reminders });
});

app.post('/api/reminders', (req, res) => {
  const { customerName, amount, dueDate, message } = req.body;
  const newRem = {
    id: `rem-${Date.now()}`,
    customerName: customerName || 'Customer',
    amount: Number(amount) || 0,
    dueDate: dueDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    message: message || 'Payment reminder',
    status: 'pending',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  reminders.unshift(newRem);
  res.json({ reminder: newRem });
});

app.put('/api/reminders/:id', (req, res) => {
  const index = reminders.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Reminder not found' });
  reminders[index] = { ...reminders[index], ...req.body };
  res.json({ reminder: reminders[index] });
});

app.delete('/api/reminders/:id', (req, res) => {
  reminders = reminders.filter(r => r.id !== req.params.id);
  res.json({ success: true });
});

// Products & Inventory
app.get('/api/products', (req, res) => {
  res.json({ products });
});

app.post('/api/products', (req, res) => {
  const { name, category, stockQty, lowStockThreshold, buyPrice, sellPrice, unit, sku } = req.body;
  const newProd = {
    id: `prod-${Date.now()}`,
    name: name || 'New Item',
    category: category || 'General',
    stockQty: Number(stockQty) || 0,
    lowStockThreshold: Number(lowStockThreshold) || 10,
    buyPrice: Number(buyPrice) || 0,
    sellPrice: Number(sellPrice) || 0,
    unit: unit || 'pcs',
    sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
  };
  products.unshift(newProd);
  res.json({ product: newProd });
});

app.put('/api/products/:id', (req, res) => {
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  products[idx] = { ...products[idx], ...req.body };
  res.json({ product: products[idx] });
});

app.delete('/api/products/:id', (req, res) => {
  products = products.filter(p => p.id !== req.params.id);
  res.json({ success: true });
});

// Stock Movements & Adjustments
app.get('/api/stock-movements', (req, res) => {
  res.json({ stockMovements });
});

app.post('/api/stock/adjust', (req, res) => {
  const { productId, productName, newQty, deltaQty, reason, referenceId } = req.body;
  const p = products.find(prod => (productId && prod.id === productId) || (productName && prod.name.toLowerCase().includes(productName.toLowerCase().trim())));
  if (!p) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const previousQty = p.stockQty;
  let finalQty = p.stockQty;
  let changeQty = 0;

  if (newQty !== undefined) {
    finalQty = Math.max(0, Number(newQty));
    changeQty = finalQty - previousQty;
  } else if (deltaQty !== undefined) {
    finalQty = Math.max(0, previousQty + Number(deltaQty));
    changeQty = Number(deltaQty);
  }

  p.stockQty = finalQty;
  const movement = {
    id: `sm-${Date.now()}`,
    productId: p.id,
    productName: p.name,
    changeQty,
    reason: reason || 'ADJUSTMENT',
    referenceId: referenceId || `Stock adjusted from ${previousQty} to ${finalQty}`,
    date: new Date().toISOString().slice(0, 10),
    finalQty,
  };
  stockMovements.unshift(movement);

  res.json({ product: p, movement });
});

// Invoices
app.get('/api/invoices', (req, res) => {
  res.json({ invoices });
});

// ATOMIC BUSINESS TRANSACTION PIPELINE: Sale Creation
app.post('/api/sales/create', (req, res) => {
  const { customerName, items, paidAmount, paymentMethod, discountPercent, notes } = req.body;
  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer name and at least one item are required' });
  }

  // 1. Resolve or create customer
  let cust = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase().trim());
  if (!cust) {
    cust = {
      id: `cust-${Date.now()}`,
      name: customerName.trim(),
      phone: '+91 98000 00000',
      address: '',
      balance: 0,
      lastTransactionDate: new Date().toISOString().slice(0, 10),
      status: 'settled',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    customers.unshift(cust);
  }

  // 2. Validate products and decrease stock atomically
  const movements: any[] = [];
  const updatedProds: any[] = [];
  const billItems: any[] = [];

  for (const it of items) {
    const p = products.find(prod => (it.productId && prod.id === it.productId) || prod.name.toLowerCase().includes(it.name.toLowerCase().trim()));
    const price = it.price || (p ? p.sellPrice : 50);
    const itemTotal = price * it.qty;

    billItems.push({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: p ? p.name : it.name,
      qty: it.qty,
      price,
      total: itemTotal,
      productId: p?.id,
    });

    if (p) {
      p.stockQty = Math.max(0, p.stockQty - it.qty);
      updatedProds.push(p);

      const sm = {
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: p.id,
        productName: p.name,
        changeQty: -it.qty,
        reason: 'SALE',
        referenceId: `Sale to ${cust.name}`,
        date: new Date().toISOString().slice(0, 10),
        finalQty: p.stockQty,
      };
      stockMovements.unshift(sm);
      movements.push(sm);
    }
  }

  // 3. Compute Invoice amounts
  const subtotal = billItems.reduce((s, i) => s + i.total, 0);
  const discPercent = Number(discountPercent) || 0;
  const discAmount = (subtotal * discPercent) / 100;
  const grandTotal = Math.round((subtotal - discAmount) * 100) / 100;

  const mode = paymentMethod || 'Cash';
  const paid = paidAmount !== undefined ? Number(paidAmount) : (mode === 'Credit' ? 0 : grandTotal);
  const due = Math.max(0, grandTotal - paid);

  const newInvoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber: `#INV-${1000 + invoices.length + 1}`,
    customerName: cust.name,
    customerId: cust.id,
    date: new Date().toISOString().slice(0, 10),
    items: billItems,
    subtotal,
    discountPercent: discPercent,
    discountAmount: discAmount,
    taxPercent: 0,
    taxAmount: 0,
    grandTotal,
    paidAmount: paid,
    dueAmount: due,
    paymentMode: mode,
    paymentStatus: paid === 0 ? 'Due' : due > 0 ? 'Partial' : 'Paid',
    notes: notes || `Sale of ${billItems.length} item(s)`,
  };
  invoices.unshift(newInvoice);

  // 4. Update customer outstanding balance: increases by dueAmount
  if (due > 0) {
    cust.balance += due;
    cust.status = cust.balance > 0 ? 'due' : 'settled';
    cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
  }

  // 5. Create real financial transaction ONLY for actual money received
  let newTx: any = null;
  if (paid > 0) {
    newTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'in',
      direction: 'INCOME',
      category: 'Sale',
      description: `Payment received for ${newInvoice.invoiceNumber}`,
      partyName: cust.name,
      paymentMode: mode,
      amount: paid,
      invoiceId: newInvoice.id,
      customerId: cust.id,
    };
    transactions.unshift(newTx);
  }

  res.json({
    invoice: newInvoice,
    transaction: newTx,
    customer: cust,
    updatedProducts: updatedProds,
    stockMovements: movements,
  });
});

app.post('/api/invoices/:id/cancel', (req, res) => {
  const inv = invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  inv.paymentStatus = 'Cancelled';

  // Restore product stock
  for (const item of inv.items) {
    const p = products.find(prod => (item.productId && prod.id === item.productId) || prod.name === item.name);
    if (p) {
      p.stockQty += item.qty;
      stockMovements.unshift({
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: p.id,
        productName: p.name,
        changeQty: item.qty,
        reason: 'RETURN',
        referenceId: `Cancellation of ${inv.invoiceNumber}`,
        date: new Date().toISOString().slice(0, 10),
        finalQty: p.stockQty,
      });
    }
  }

  // Reverse customer balance if due amount was outstanding
  if (inv.dueAmount && inv.dueAmount > 0) {
    const cust = customers.find(c => c.name.toLowerCase() === inv.customerName.toLowerCase());
    if (cust) {
      cust.balance = Math.max(0, cust.balance - inv.dueAmount);
      cust.status = cust.balance > 0 ? 'due' : 'settled';
    }
  }

  res.json({ success: true, invoice: inv });
});

// Summary / Reports
app.get('/api/reports/summary', (req, res) => {
  const moneyIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const moneyOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const totalReceivables = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);

  res.json({
    summary: {
      period: String(req.query.period || 'today'),
      moneyIn: moneyIn || 18640,
      moneyOut: moneyOut || 7280,
      netProfit: (moneyIn || 18640) - (moneyOut || 7280),
      transactionCount: transactions.length,
      totalReceivables: totalReceivables || 7930,
      topCustomers: customers.filter(c => c.balance > 0).slice(0, 3).map(c => ({ name: c.name, balance: c.balance })),
    },
  });
});

// --- GEMINI LIVE CONVERSATIONAL VOICE AGENT ENDPOINT ---
app.post('/api/voice/chat', async (req, res) => {
  const { message, context, activeCustomer } = req.body;

  const systemInstruction = `You are Jarvis, the intelligent conversational voice assistant for NotiBook (smart business ledger & Khatabook for Indian merchants).

STRICT CONVERSATIONAL & LANGUAGE RULES (Follow strictly on every turn):
1. English input → natural English response.
2. Hindi input (Devanagari or Romanized) → natural Hindi response.
3. Hinglish input → natural Hinglish response.
4. Mixed-language input → naturally match the user's mixture.
5. If the user changes language during a conversation, switch with them immediately.
6. Preserve conversation context when switching languages (e.g. active customer, previous amounts).
7. Tool calls and database operations are language-independent.
8. Never translate the user's command into another language merely for processing.
9. The final spoken response (either in speech_response parameter of a tool call or as a direct message) must use the appropriate language/style matching the user.
10. Confirmations, clarification questions, errors, navigation responses, transaction results, and reports must all follow the same language rule.
11. Do not use generic fallback responses when the user's intent can be understood.
12. Do not depend on example phrases, keyword matching, regex matching, or a fixed command dictionary.

NAVIGATION & OPENING TABS / SMALLER THINGS:
13. If the user is telling to open ANY tab of website then open it, even the smaller things!
    Always call the 'navigate' tool for any open / show / view request:
    - Main pages & subtabs:
      * 'home' -> Dashboard, home overview (e.g. "डैशबोर्ड खोलो", "Show home", "Dashboard")
      * 'customers' -> Customer list & khata (e.g. "कस्टमर्स खोलो", "Show parties", "Customer ledger")
      * 'billing' -> Billing and invoice generator (e.g. "बिलिंग खोलो", "Open invoice tab", "Bill generate karo")
      * 'transactions' -> Transactions passbook (e.g. "लेन-देन खोलो", "Show transactions", "Passbook")
      * 'stocks' -> Inventory and stocks (e.g. "स्टॉक खोलो", "Inventory page", "Products")
    - Modals, forms & smaller UI elements:
      * 'add_customer_modal' -> Open Add Customer dialog/form (e.g. "नया ग्राहक जोड़ने का फॉर्म खोलो", "Open add customer modal", "Naya customer popup")
      * 'add_transaction_modal' -> Open Add Transaction dialog (Cash In / Out) (e.g. "लेन-देन दर्ज करने का फॉर्म खोलो", "Open transaction dialog", "Cash in entry box", "Expense modal")
      * 'add_product_modal' -> Open Add Product / Item dialog (e.g. "नया सामान जोड़ने का फॉर्म खोलो", "Open add product modal", "Naya item add dialog")
      * 'customer_ledger_modal' -> Open a specific customer's ledger modal popup (e.g. "रवि का लेजर खोलो", "Open Rahul's ledger", "Uska khata dialog dikhao") -> set customer_name parameter
      * 'invoice_modal' -> Open Invoice preview & print modal (e.g. "बिल रसीद खोलो", "Show invoice receipt modal", "Invoice preview")
      * 'settings_modal' -> Open Shop Settings dialog (e.g. "दुकान की सेटिंग खोलो", "Open settings modal", "Settings kholo")
      * 'search_modal' -> Open Global Search bar popup (e.g. "सर्च बार खोलो", "Open search bar", "Search box dikhao")
      * 'voice_modal' -> Open Voice Record & Assistant modal (e.g. "वॉयस डायलॉग खोलो", "Open voice modal")
      * 'toggle_sidebar' -> Open, close, expand or collapse sidebar (e.g. "साइडबार खोलो", "Sidebar band karo", "Toggle sidebar")

CAPABILITY & LEDGER TOOLS:
- Customers: add_customer, get_customer, update_customer, delete_customer
- Transactions: add_transaction (credit=jama/in, debit=udhar/out), get_transactions, update_transaction, delete_transaction
- Balances: get_balance (individual customer), get_account_balance (total market receivables across all customers)
- Reports: get_report (today, week, month sales & expenses)
- Reminders: add_reminder, get_reminders, update_reminder, delete_reminder
- Ending Conversation: end_conversation (when the merchant indicates they are done, finished, saying goodbye, or acknowledging with "theek hai", "ok", "bas", "thank you", "bye")

CRITICAL TRANSACTION & KHATA ENTRY INSTRUCTIONS:
- Whenever the user speaks an entry command like:
  * "कृपा शंकर के अकाउंट में ₹1000 उधर लिख दो" / "कृपा शंकर के खाते में 1000 उधार लिखो"
  * "सुरेश को 500 उधार दिए" / "रमेश को 200 दे दो"
  * "राहुल के खाते में 500 जमा लिखो" / "प्रिया से 1200 पेमेंट आई"
  * "Kripa Shankar ke account mein 1000 udhar likh do"
  * "Usmein 500 add kar do" / "उसके खाते में 500 लिख दो"
  You MUST call 'add_transaction' immediately with:
  * customer_name: The customer or party name mentioned (e.g. 'कृपा शंकर', 'Ramesh', 'Rahul') or from activeCustomer if pronoun like 'uske khate me'.
  * amount: The numerical amount in Rupees (e.g. 1000, 500).
  * transaction_type: 'debit' for udhar/उधार/उधर/given/diye/likh do udhar/debit, 'credit' for jama/जमा/received/mila/payment.
  * speech_response: Natural confirmation in user language, e.g. "हो गया। कृपा शंकर के खाते में ₹1,000 उधार लिख दिए हैं।"
  * NEVER reply with a generic question like "जी बताइए, क्या एंट्री करनी है?" when the amount or customer is specified!

CONVERSATION ENDING & CLOSING RULES:
- When the merchant acknowledges completion, says they are finished, or gives a closing expression (e.g. "theek hai", "theek hai bhai", "ok", "okay", "alright", "bas", "bas itna hi", "that's all", "thank you", "thanks", "bye", "goodbye", "alvida", "ठीक है", "बस"):
  * If there is NO pending confirmation or unfinished action: You MUST call 'end_conversation' with a polite, friendly closing farewell in the user's matching language (e.g. "Theek hai, dhanyawad! Have a great day.", "अलविदा! कोई और काम हो तो बताइएगा।", "Alright, thank you! Have a great day."). Do NOT ask "How can I help you" or give generic replies.
- CRITICAL CONTEXTUAL DISTINCTION:
  * "Theek hai" / "ok" / "haan" CAN mean confirmation IF Jarvis previously asked for confirmation (e.g. "Confirm karoon?", "Delete karoon?"). If the user is confirming a pending action, execute/confirm the action, do NOT end the conversation!
  * Only call 'end_conversation' when the merchant is acknowledging completion or closing the conversation.

Pronouns like "usmein", "uska", "uski", "woh", "that customer", "the last one" resolve to the currently active customer: ${activeCustomer ? `${activeCustomer.name} (Balance: ₹${activeCustomer.balance})` : 'None'}.

CURRENT CONVERSATION CONTEXT STATE:
- Pending confirmation: ${context?.pendingConfirmation ? JSON.stringify(context.pendingConfirmation) : 'NONE'}
- Pending slot filling: ${context?.pendingSlotFilling ? JSON.stringify(context.pendingSlotFilling) : 'NONE'}

CRITICAL ACTION DECISION FOR ACKNOWLEDGMENTS ("theek hai", "ok", "alright", "bas", "thanks", "bye"):
- If Pending confirmation is NOT NONE: The user is confirming the pending action. Execute that action now!
- If Pending confirmation is NONE: The user is acknowledging the previous answer/action and is closing the conversation. You MUST call the 'end_conversation' tool with a friendly farewell in their language! Do NOT ask "how can I help" or reply with text.`;

  const tools = [
    {
      functionDeclarations: [
        // END CONVERSATION
        {
          name: 'end_conversation',
          description: 'Close and end the active voice session when the user indicates the conversation is finished, done, or says goodbye (e.g. theek hai, ok, bas, thank you, bye after an answer). Do NOT call this if user is confirming a pending action or answering slot filling.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              speech_response: {
                type: Type.STRING,
                description: 'Polite natural farewell in the exact language and style used by the merchant',
              },
            },
            required: ['speech_response'],
          },
        },

        // NAVIGATION (Tabs & smaller things)
        {
          name: 'navigate',
          description: 'Open any page, tab, subtab, modal dialog, form, or UI component in NotiBook (even smaller things)',
          parameters: {
            type: Type.OBJECT,
            properties: {
              target: {
                type: Type.STRING,
                description: 'Target to open: home, customers, billing, transactions, stocks, add_customer_modal, add_transaction_modal, add_product_modal, customer_ledger_modal, invoice_modal, settings_modal, search_modal, voice_modal, toggle_sidebar',
              },
              customer_name: {
                type: Type.STRING,
                description: 'Customer name if opening a customer ledger or specific transaction form',
              },
              transaction_type: {
                type: Type.STRING,
                description: 'credit (cash in) or debit (cash out) if opening transaction modal',
              },
              speech_response: {
                type: Type.STRING,
                description: 'Natural spoken response confirming navigation in the exact language and style used by the user',
              },
            },
            required: ['target', 'speech_response'],
          },
        },

        // CUSTOMERS
        {
          name: 'add_customer',
          description: 'Add a new customer to NotiBook ledger',
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Customer full name' },
              phone: { type: Type.STRING, description: 'Optional mobile phone number' },
              opening_balance: { type: Type.NUMBER, description: 'Optional opening balance' },
              address: { type: Type.STRING, description: 'Optional location or address' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['name', 'speech_response'],
          },
        },
        {
          name: 'get_customer',
          description: 'Look up customer profile and ledger information',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Customer name or ID' },
              speech_response: { type: Type.STRING, description: 'Natural spoken answer in user language' },
            },
            required: ['customer_name', 'speech_response'],
          },
        },
        {
          name: 'update_customer',
          description: 'Update customer phone, address, or details',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Customer name' },
              phone: { type: Type.STRING, description: 'Updated phone' },
              address: { type: Type.STRING, description: 'Updated address' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['customer_name', 'speech_response'],
          },
        },
        {
          name: 'delete_customer',
          description: 'Delete customer record from ledger (requires confirmation)',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Customer name' },
              customer_id: { type: Type.STRING, description: 'Optional customer ID' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation prompt in user language' },
            },
            required: ['customer_name', 'speech_response'],
          },
        },

        // TRANSACTIONS
        {
          name: 'add_transaction',
          description: 'Record a money in/out or credit/debit transaction for a customer or expense',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Name of customer or party' },
              amount: { type: Type.NUMBER, description: 'Amount in Rupees' },
              transaction_type: { type: Type.STRING, enum: ['credit', 'debit'], description: 'credit = payment received/jama, debit = given on credit/udhar' },
              payment_mode: { type: Type.STRING, description: 'Cash, UPI, Bank' },
              description: { type: Type.STRING, description: 'Optional note or item description' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['amount', 'transaction_type', 'speech_response'],
          },
        },
        {
          name: 'get_transactions',
          description: 'Get recent transaction entries for a customer or shop',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Optional customer name' },
              limit: { type: Type.NUMBER, description: 'Max number of transactions to return' },
              speech_response: { type: Type.STRING, description: 'Natural spoken answer in user language' },
            },
            required: ['speech_response'],
          },
        },
        {
          name: 'update_transaction',
          description: 'Update an existing transaction details or amount',
          parameters: {
            type: Type.OBJECT,
            properties: {
              transaction_id: { type: Type.STRING, description: 'Transaction ID' },
              customer_name: { type: Type.STRING, description: 'Customer name' },
              amount: { type: Type.NUMBER, description: 'Updated amount' },
              description: { type: Type.STRING, description: 'Updated note' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['speech_response'],
          },
        },
        {
          name: 'delete_transaction',
          description: 'Delete a previous transaction (requires confirmation)',
          parameters: {
            type: Type.OBJECT,
            properties: {
              transaction_id: { type: Type.STRING, description: 'Optional ID' },
              customer_name: { type: Type.STRING, description: 'Customer name' },
              speech_response: { type: Type.STRING, description: 'Natural confirmation prompt in user language' },
            },
            required: ['speech_response'],
          },
        },

        // BALANCE
        {
          name: 'get_balance',
          description: 'Get the current balance and due status for an individual customer',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Customer name' },
              speech_response: { type: Type.STRING, description: 'Natural spoken answer with balance in user language' },
            },
            required: ['customer_name', 'speech_response'],
          },
        },
        {
          name: 'get_account_balance',
          description: 'Get total market pending receivables and dues across all customers',
          parameters: {
            type: Type.OBJECT,
            properties: {
              speech_response: { type: Type.STRING, description: 'Natural spoken answer with total shop dues in user language' },
            },
            required: ['speech_response'],
          },
        },

        // REPORTS
        {
          name: 'get_report',
          description: 'Get business sales, expenses, and profit summary for today or week',
          parameters: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING, enum: ['today', 'week', 'month', '7days'], description: 'Time period' },
              speech_response: { type: Type.STRING, description: 'Natural spoken summary in user language' },
            },
            required: ['speech_response'],
          },
        },

        // REMINDERS
        {
          name: 'add_reminder',
          description: 'Create a payment reminder for a customer',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Customer name' },
              amount: { type: Type.NUMBER, description: 'Due amount' },
              due_date: { type: Type.STRING, description: 'Target date (YYYY-MM-DD)' },
              message: { type: Type.STRING, description: 'Reminder note' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['customer_name', 'speech_response'],
          },
        },
        {
          name: 'get_reminders',
          description: 'List pending payment reminders',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Optional customer name' },
              speech_response: { type: Type.STRING, description: 'Natural spoken answer in user language' },
            },
            required: ['speech_response'],
          },
        },
        {
          name: 'update_reminder',
          description: 'Update reminder status to completed or change due date',
          parameters: {
            type: Type.OBJECT,
            properties: {
              reminder_id: { type: Type.STRING, description: 'Reminder ID' },
              status: { type: Type.STRING, enum: ['pending', 'completed'] },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['reminder_id', 'speech_response'],
          },
        },
        {
          name: 'delete_reminder',
          description: 'Delete a reminder',
          parameters: {
            type: Type.OBJECT,
            properties: {
              reminder_id: { type: Type.STRING, description: 'Reminder ID' },
              customer_name: { type: Type.STRING, description: 'Customer name' },
              speech_response: { type: Type.STRING, description: 'Natural spoken confirmation in user language' },
            },
            required: ['speech_response'],
          },
        },
      ],
    },
  ];

  if (ai) {
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastErr: any = null;

    // Build conversation contents with history if available
    let contentsPayload: any = message;
    if (context && Array.isArray(context.recentTurns) && context.recentTurns.length > 0) {
      const history = context.recentTurns.slice(-8).map((turn: any) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(turn.text || '') }],
      }));
      history.push({
        role: 'user',
        parts: [{ text: String(message || '') }],
      });
      contentsPayload = history;
    }

    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini timeout on ${modelName}`)), 7000)
        );

        const generatePromise = ai.models.generateContent({
          model: modelName,
          contents: contentsPayload,
          config: {
            systemInstruction,
            // @ts-ignore
            tools,
          },
        });

        const response = (await Promise.race([generatePromise, timeoutPromise])) as any;

        const functionCalls = response.functionCalls;
        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          return res.json({
            toolCall: {
              name: call.name,
              args: call.args,
            },
          });
        }

        if (response.text && response.text.trim()) {
          const rawTrim = String(message || '').trim().toLowerCase();
          const isAcknowledgeClosing = (
            rawTrim === 'theek hai' || rawTrim === 'theek h' || rawTrim === 'ok' || rawTrim === 'okay' ||
            rawTrim === 'alright' || rawTrim === 'all right' || rawTrim === 'bas' || rawTrim === 'bas itna hi' ||
            rawTrim === 'that is all' || rawTrim === 'thats all' || rawTrim === "that's all" ||
            rawTrim === 'bye' || rawTrim === 'goodbye' || rawTrim === 'thank you' || rawTrim === 'thanks' ||
            rawTrim === 'thank you jarvis' || rawTrim === 'thanks jarvis' ||
            message === 'ठीक है' || message === 'बस' || message === 'अलविदा' || message === 'धन्यवाद'
          );

          // If user gives closing acknowledgment and there is NO pending action, close the conversation
          if (isAcknowledgeClosing && !context?.pendingConfirmation && !context?.pendingSlotFilling) {
            const isHindiText = /[\u0900-\u097F]/.test(message || '');
            const isHinglishText = !isHindiText && /(karo|hai|theek|batao|khatabook|bhai)/i.test(message || '');
            const farewell = isHindiText
              ? 'ठीक है, आपका बहुत धन्यवाद! आपका दिन शुभ हो।'
              : (isHinglishText ? 'Theek hai, dhanyawad! Have a great day.' : 'Alright, thank you! Have a great day.');
            return res.json({
              toolCall: {
                name: 'end_conversation',
                args: { speech_response: farewell }
              }
            });
          }

          return res.json({
            reply: response.text.trim(),
          });
        }
        break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[GeminiLive Server] Model ${modelName} error:`, err.message || err);
      }
    }
    if (lastErr) {
      console.warn('[GeminiLive Server] Candidate models exhausted, utilizing dynamic fallback:', lastErr.message);
    }
  }

  // --- DYNAMIC MULTILINGUAL CAPABILITY ENGINE & FALLBACK ---
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase();
  const isHindi = /[\u0900-\u097F]/.test(raw);
  const isHinglish = !isHindi && (
    /\b(karo|karke|banao|batao|bataiye|diya|diye|liya|liye|hoga|hogi|honge|raha|rahi|rahe|kholo|dikhao|paisa|paise|rupaye|udhar|jama|mera|meri|mere|tera|teri|tere|uska|uski|usmein|usme|kya|kaun|kaise|kitna|kitne|bhai|khatabook|hisab|dhanyawad|shukriya|namaste|theek|achha|bikri|munafa|kharcha|kharch)\b/i.test(lower) ||
    /\b(kar\s+do|de\s+do|bata\s+do|hata\s+do|bhej\s+do|market\s+me|khata\s+me|dukan\s+me|us\s+me|is\s+me|ka\s+balance|ki\s+last|hai\s+ya|hai\s+kya)\b/i.test(lower)
  );
  const userLang: 'hindi' | 'hinglish' | 'english' = isHindi ? 'hindi' : (isHinglish ? 'hinglish' : 'english');

  const custName = activeCustomer ? activeCustomer.name : 'Ravi';

  // 0. Context-aware Closing / Farewell ("theek hai", "ok", "bas", "thank you", "bye", "alvida")
  const isClosingPhrase =
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

  if (isClosingPhrase && !context?.pendingConfirmation && !context?.pendingSlotFilling) {
    const farewell = userLang === 'hindi'
      ? 'ठीक है, आपका बहुत धन्यवाद! आपका दिन शुभ हो।'
      : (userLang === 'hinglish' ? 'Theek hai, dhanyawad! Have a great day.' : 'Alright, thank you! Have a great day.');
    return res.json({
      toolCall: {
        name: 'end_conversation',
        args: { speech_response: farewell }
      }
    });
  }

  // 1. Customer Creation ("एक रमेश सा कस्टमर", "Add Ramesh as customer", "रमेश करके कस्टमर बनाओ", "Add customer")
  const hindiSpecificCustomerMatch = raw.match(/एक\s+([^\s]+)\s+(?:सा\s+)?(?:कस्टमर|ग्राहक)/i);
  const custAddMatchHindi = hindiSpecificCustomerMatch || raw.match(/([^\s]+)\s*(?:करके|सा|को)?\s*(?:कस्टमर|ग्राहक)\s*(?:बनाओ|जोड़ो|ऐड\s*करो|बना\s*दो|ऐड\s*कर\s*दो)/i);
  const custAddMatchEnglish = lower.match(/(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
                              lower.match(/(?:customer\s+banao|customer\s+add\s+karo)\s+([a-zA-Z\s]+)/i) ||
                              lower.match(/([a-zA-Z\s]+?)\s*(?:ko|karke)?\s*customer\s*(?:banao|add\s*karo)/i);

  if (custAddMatchHindi) {
    const rawName = custAddMatchHindi[1].replace(/^(नया|न्यू|एक)\s*/, '').trim();
    if (rawName && rawName !== 'कस्टमर' && rawName !== 'ग्राहक') {
      return res.json({ toolCall: { name: 'add_customer', args: { name: rawName } } });
    }
  }
  if (custAddMatchEnglish && (lower.includes('customer') || lower.includes('कस्टमर'))) {
    const name = custAddMatchEnglish[1].replace(/^(new|naya)\s*/i, '').trim();
    if (name && !name.includes('page') && !name.includes('kholo') && name !== 'a' && name !== 'the') {
      return res.json({ toolCall: { name: 'add_customer', args: { name: name.charAt(0).toUpperCase() + name.slice(1) } } });
    }
  }

  // Missing name follow-up prompt when user says just "Add customer" / "Customer banao" / "कस्टमर बनाओ"
  if (
    lower === 'add customer' ||
    lower === 'create customer' ||
    lower === 'customer banao' ||
    lower === 'naya customer banao' ||
    raw === 'कस्टमर बनाओ' ||
    raw === 'नया ग्राहक बनाओ' ||
    raw === 'ग्राहक जोड़ो'
  ) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'किस नाम से नया ग्राहक बनाना है?' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Kis naam se naya customer add karna hai?' });
    }
    return res.json({ reply: 'What is the name for the new customer?' });
  }

  // 2. Navigation & Smaller Things
  if (lower.includes('setting') || raw.includes('सेटिंग')) {
    const speech = userLang === 'hindi' ? 'दुकान की सेटिंग खोल दी गई है।' : (userLang === 'hinglish' ? 'Shop settings open kar diya hai.' : 'Opening shop settings.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'settings_modal', speech_response: speech } } });
  }
  if (lower.includes('search') || raw.includes('सर्च')) {
    const speech = userLang === 'hindi' ? 'सर्च बार खोल दिया गया है।' : (userLang === 'hinglish' ? 'Search bar open kar diya hai.' : 'Opening search bar.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'search_modal', speech_response: speech } } });
  }
  if (lower.includes('add customer') || lower.includes('customer form') || raw.includes('नया ग्राहक फॉर्म') || raw.includes('कस्टमर फॉर्म')) {
    const speech = userLang === 'hindi' ? 'नया ग्राहक जोड़ने का फॉर्म खोल दिया गया है।' : (userLang === 'hinglish' ? 'Naya customer form open kar diya hai.' : 'Opening add customer dialog.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'add_customer_modal', speech_response: speech } } });
  }
  if (lower.includes('add transaction') || lower.includes('entry form') || lower.includes('cash in') || lower.includes('cash out') || raw.includes('लेनदेन फॉर्म') || raw.includes('एंट्री फॉर्म')) {
    const speech = userLang === 'hindi' ? 'लेन-देन दर्ज करने का फॉर्म खोल दिया गया है।' : (userLang === 'hinglish' ? 'Transaction entry form open kar diya hai.' : 'Opening transaction dialog.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'add_transaction_modal', speech_response: speech } } });
  }
  if (lower.includes('add product') || lower.includes('product form') || raw.includes('सामान फॉर्म') || raw.includes('प्रोडक्ट फॉर्म')) {
    const speech = userLang === 'hindi' ? 'नया सामान जोड़ने का फॉर्म खोल दिया गया है।' : (userLang === 'hinglish' ? 'Product entry form open kar diya hai.' : 'Opening add product dialog.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'add_product_modal', speech_response: speech } } });
  }
  if (lower.includes('invoice') || lower.includes('receipt') || raw.includes('रसीद') || raw.includes('बिल प्रीव्यू')) {
    const speech = userLang === 'hindi' ? 'बिल रसीद प्रीव्यू खोल दिया गया है।' : (userLang === 'hinglish' ? 'Invoice preview open kar diya hai.' : 'Opening invoice preview.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'invoice_modal', speech_response: speech } } });
  }
  if (lower.includes('sidebar') || raw.includes('साइडबार')) {
    const speech = userLang === 'hindi' ? 'साइडबार बदल दिया गया है।' : (userLang === 'hinglish' ? 'Sidebar toggle kar diya hai.' : 'Sidebar toggled.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'toggle_sidebar', speech_response: speech } } });
  }
  if (lower.includes('ledger') || lower.includes('khata kholo') || raw.includes('खाता खोलो') || raw.includes('लेजर खोलो')) {
    const speech = userLang === 'hindi' ? `${custName} का लेजर खोल दिया गया है।` : (userLang === 'hinglish' ? `${custName} ka ledger open kar diya hai.` : `Opening ${custName}'s ledger.`);
    return res.json({ toolCall: { name: 'navigate', args: { target: 'customer_ledger_modal', customer_name: custName, speech_response: speech } } });
  }
  if (lower.includes('customer page') || lower.includes('customers kholo') || lower.includes('show customers') || raw.includes('कस्टमर्स खोलो') || raw.includes('ग्राहक पेज')) {
    const speech = userLang === 'hindi' ? 'ग्राहक खाता सूची खोल दी गई है।' : (userLang === 'hinglish' ? 'Customers page open kar diya hai.' : 'Opening customers page.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'customers', speech_response: speech } } });
  }
  if (lower.includes('transaction page') || lower.includes('transactions kholo') || raw.includes('लेनदेन खोलो')) {
    const speech = userLang === 'hindi' ? 'लेन-देन पासबुक खोल दिया गया है।' : (userLang === 'hinglish' ? 'Transactions page open kar diya hai.' : 'Opening transactions.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'transactions', speech_response: speech } } });
  }
  if (lower.includes('billing') || raw.includes('बिलिंग खोलो') || lower.includes('bill page')) {
    const speech = userLang === 'hindi' ? 'बिलिंग पेज खोल दिया गया है।' : (userLang === 'hinglish' ? 'Billing page open kar diya hai.' : 'Opening billing page.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'billing', speech_response: speech } } });
  }
  if (lower.includes('stock') || raw.includes('स्टॉक खोलो') || lower.includes('inventory')) {
    const speech = userLang === 'hindi' ? 'स्टॉक और इन्वेंटरी पेज खोल दिया गया है।' : (userLang === 'hinglish' ? 'Stocks page open kar diya hai.' : 'Opening stocks page.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'stocks', speech_response: speech } } });
  }
  if (lower.includes('home') || lower.includes('dashboard') || raw.includes('होम') || raw.includes('डैशबोर्ड')) {
    const speech = userLang === 'hindi' ? 'होम डैशबोर्ड खोल दिया गया है।' : (userLang === 'hinglish' ? 'Home dashboard open kar diya hai.' : 'Opening dashboard.');
    return res.json({ toolCall: { name: 'navigate', args: { target: 'home', speech_response: speech } } });
  }

  // 3. Identity queries ("Who are you?", "Aap kaun ho?", "आप कौन हैं?")
  if (lower.includes('who are you') || lower.includes('kaun ho') || lower.includes('kya ho') || lower.includes('kya kar sakte') || raw.includes('कौन हो') || raw.includes('कौन हैं')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'मैं जार्विस हूँ, नोटीबुक का वॉइस असिस्टेंट। मैं आपके ग्राहकों के खाते, दैनिक बिक्री, बिलिंग और उधारी का हिसाब रखने में मदद करता हूँ।' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Main Jarvis hoon, NotiBook ka smart voice assistant. Main aapke customers, khata, daily sales, aur udhar manage karne me madad karta hoon.' });
    }
    return res.json({ reply: 'I am Jarvis, NotiBook\'s voice assistant. I help you manage customer Khatabooks, record daily sales and expenses, generate bills, and track dues.' });
  }

  // 4. Total Dues / Market Udhar query ("Total udhar kitna hai", "Market me kitna paisa fasa hai", "Kul bakaya")
  if (lower.includes('total udhar') || lower.includes('baki paisa') || lower.includes('market udhar') || lower.includes('market me') || lower.includes('kul udhar') || lower.includes('kul bakaya') || lower.includes('pending dues') || lower.includes('total dues') || lower.includes('sabka udhar') || raw.includes('कुल उधारी') || raw.includes('बाकी पैसा') || raw.includes('कुल बकाया')) {
    return res.json({ toolCall: { name: 'get_account_balance', args: {} } });
  }

  // 5. Customer count & list query ("Kitne customer hain", "How many customers")
  if (lower.includes('kitne customer') || lower.includes('how many customer') || lower.includes('total customer') || lower.includes('sab customer') || raw.includes('कितने ग्राहक') || raw.includes('कितने कस्टमर')) {
    const count = customers.length;
    if (userLang === 'hindi') {
      return res.json({ reply: `नोटीबुक में कुल ${count} ग्राहक जुड़े हुए हैं।` });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: `NotiBook me total ${count} customers registered hain.` });
    }
    return res.json({ reply: `You currently have ${count} customers registered in your NotiBook.` });
  }

  // 6. Report & Sales queries
  if (lower.includes('kitna paisa aaya') || lower.includes('aaj kitna aaya') || lower.includes('summary') || lower.includes('sales') || lower.includes('bikri') || raw.includes('कितना पैसा आया') || raw.includes('बिक्री बताओ') || raw.includes('आज की बिक्री')) {
    return res.json({ toolCall: { name: 'get_report', args: { period: 'today' } } });
  }

  // 7. Delete transaction / customer
  if (lower.includes('delete') || lower.includes('hata do') || raw.includes('डिलीट') || raw.includes('हटाओ')) {
    if (lower.includes('customer') || raw.includes('ग्राहक') || raw.includes('कस्टमर')) {
      return res.json({ toolCall: { name: 'delete_customer', args: { customer_name: custName } } });
    }
    return res.json({ toolCall: { name: 'delete_transaction', args: { customer_name: custName } } });
  }

  // 8. Robust Multilingual Transaction Intent & Entity Extraction
  const amountMatch = raw.match(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|रुपये|रुपए)?/i);
  const hasAmount = !!amountMatch;
  const amount = hasAmount ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  const isDebitIndicator = /\b(udhar|udhari|debit|diya|diye|de\s*do|dedo|dekar|nikasi|gaya)\b|उधर|उधार|उधारी|डेबिट|दिए|दिया|दे\s*दो|देना|काट\s*लो|काटो|माइनस/i.test(raw);
  const isCreditIndicator = /\b(jama|credit|mila|mili|mile|aaya|aayi|payment|received|jama\s*karo)\b|जमा|क्रेडिट|मिला|मिली|मिले|आया|आई|पेमेंट|पाया/i.test(raw);
  const isActionVerb = /\b(likh\s*do|likho|likhiye|likh\s*lo|likha|chadha\s*do|chada\s*do|daal\s*do|dalo|add\s*karo|add\s*kar\s*do|add|jo\s*do|jod\s*do|jodo|darj\s*karo|note\s*karo|entry\s*karo|kar\s*do)\b|लिख\s*दो|लिखो|लिखिए|लिख\s*लो|लिखा|चढ़ा\s*दो|चढ़ाओ|डाल\s*दो|डालो|ऐड\s*करो|ऐड\s*कर\s*दो|जोड़ो|जोड़\s*दो|दर्ज\s*करो|दर्ज\s*कर\s*दो|नोट\s*करो|नोट\s*कर\s*दो|एंट्री\s*करो|एंट्री\s*कर\s*दो|कर\s*दो/i.test(raw);

  const isTransactionCommand = (hasAmount && (isDebitIndicator || isCreditIndicator || isActionVerb)) ||
    lower.includes('add transaction') ||
    lower.includes('add entry') ||
    lower.includes('aur 200 aur') ||
    raw.includes('उधार लिख') ||
    raw.includes('उधर लिख') ||
    raw.includes('जमा लिख') ||
    raw.includes('खाते में') ||
    raw.includes('अकाउंट में');

  if (isTransactionCommand && hasAmount) {
    let targetName: string | undefined;

    // Check pronouns first (uske, usmein, usko)
    const isPronoun = /\b(usmein|usme|uske|uska|uski|unke|unka|unhe|unko|isme|ismein|iska|iski|woh|same\s+customer)\b|उसके|उसमें|उसको|उसका|उसकी|उनके|उनका|इसमें|इसका|इसकी/i.test(raw);
    if (isPronoun && activeCustomer) {
      targetName = activeCustomer.name;
    }

    // Match known customer in server memory
    if (!targetName) {
      for (const cust of customers) {
        if (raw.toLowerCase().includes(cust.name.toLowerCase())) {
          targetName = cust.name;
          break;
        }
      }
    }

    // Extract customer name pattern from speech
    if (!targetName) {
      const namePatterns = [
        /(?:^|अरे|जार्विस|भाई|सुनो|please|hey\s+jarvis)?\s*([a-zA-Z\s\u0900-\u097F]+?)\s*(?:के|की|का|ke|ki|ka)\s*(?:अकाउंट|खाते|खाता|account|khata|name|naam)?\s*(?:में|पे|पर|mein|me)/i,
        /(?:^|अरे|जार्विस|भाई|सुनो|please|hey\s+jarvis)?\s*([a-zA-Z\s\u0900-\u097F]+?)\s*(?:को|se|से|pe|पे|पर)\s*(?:₹|\d+|उधर|उधार|जमा)/i,
        /(?:to|for|in|naam|नाम|नाम\s*pe|नाम\s*पर)\s+([a-zA-Z\s\u0900-\u097F]+?)(?:'s|\s+ke|\s+के|\s+account|\s+khata|\s+अकाउंट|\s+खाते)?$/i,
      ];
      for (const pat of namePatterns) {
        const match = raw.match(pat);
        if (match && match[1]) {
          let extracted = match[1].replace(/^(hey\s+jarvis|jarvis|bhai|are|sun|suno|please|zara|ek|naya|new)\s*/i, '').trim();
          extracted = extracted.replace(/[0-9₹,\.]+/g, '').trim();
          const reserved = ['account', 'khata', 'customer', 'grahak', 'khatabook', 'entry', 'balance', 'अकाउंट', 'खाता', 'खाते', 'कस्टमर', 'ग्राहक', 'एंट्री', 'उधार', 'उधर', 'जमा', 'uske', 'usmein'];
          if (extracted.length >= 2 && !reserved.includes(extracted.toLowerCase())) {
            targetName = extracted;
            break;
          }
        }
      }
    }

    if (!targetName) {
      targetName = custName;
    }

    const transactionType: 'credit' | 'debit' = isDebitIndicator ? 'debit' : 'credit';
    const isCredit = transactionType === 'credit';
    const speech = userLang === 'hindi'
      ? `हो गया। ${targetName} के खाते में ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'जमा (क्रेडिट)' : 'उधार (डेबिट)'} जोड़ दिए गए हैं।`
      : (userLang === 'hinglish'
        ? `Done. ${targetName} ke account mein ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'jama' : 'udhar'} add kar diya.`
        : `Done. Added ₹${amount.toLocaleString('en-IN')} ${isCredit ? 'credit' : 'debit'} to ${targetName}'s account.`);

    return res.json({
      toolCall: {
        name: 'add_transaction',
        args: {
          customer_name: targetName,
          amount,
          transaction_type: transactionType,
          speech_response: speech,
        },
      },
    });
  }

  // 9. Single Customer Balance queries
  if (lower.includes('balance') || lower.includes('kitna hai') || lower.includes('baki hai') || raw.includes('बैलेंस') || raw.includes('बकाया')) {
    const matchedCustomer = customers.find(c => lower.includes(c.name.toLowerCase()) || lower.includes(c.name.split(' ')[0].toLowerCase()));
    if (matchedCustomer) {
      return res.json({ toolCall: { name: 'get_balance', args: { customer_name: matchedCustomer.name } } });
    }

    const words = raw.split(/[^a-zA-Z0-9\u0900-\u097F]+/).filter(Boolean);
    const ignoreWords = [
      'what', 'is', 'the', 'of', 'for', 'tell', 'show', 'check', 'get', 'give', 'me', 'please',
      'ka', 'ki', 'ke', 'ko', 'me', 'mein', 'se', 'balance', 'kitna', 'hai', 'hain', 'tha', 'thi',
      'batao', 'bataiye', 'बताओ', 'का', 'की', 'के', 'बैलेंस', 'कितना', 'है', 'bata', 'dikhao', 'dekho',
      'account', 'hisab', 'khata'
    ];
    const possibleName = words.find(w => !ignoreWords.includes(w.toLowerCase()));
    return res.json({ toolCall: { name: 'get_balance', args: { customer_name: possibleName || custName } } });
  }

  // 10. Last transaction query
  if (lower.includes('last transaction') || lower.includes('uski last') || lower.includes('pichla') || raw.includes('पिछला लेनदेन')) {
    return res.json({ toolCall: { name: 'get_transactions', args: { customer_name: custName, limit: 1 } } });
  }

  // 11. Reminders
  if (lower.includes('reminder') || raw.includes('रिमाइंडर') || lower.includes('yaad dilao')) {
    return res.json({ toolCall: { name: 'get_reminders', args: { customer_name: custName } } });
  }

  // 12. Billing / Invoice inquiry ("Bill kaise banayein", "How to create bill")
  if (lower.includes('bill kaise') || lower.includes('create invoice') || lower.includes('create a bill') || lower.includes('create bill') || lower.includes('how to bill') || lower.includes('make a bill') || raw.includes('बिल कैसे') || raw.includes('बिल बनाना')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'बिलिंग के लिए आप "बिलिंग खोलो" बोल सकते हैं, या ग्राहक का नाम और सामान बोलकर तुरंत इनवॉइस तैयार कर सकते हैं।' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Billing ke liye aap "Billing kholo" bol sakte hain, ya voice command se items add karke turant tax invoice print kar sakte hain.' });
    }
    return res.json({ reply: 'To generate a bill, say "Open billing" or dictate items with quantities to create and print an invoice instantly.' });
  }

  // 13. Gratitude & Pleasantries ("Thank you", "Dhanyawad", "Shukriya")
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || raw.includes('धन्यवाद') || raw.includes('शुक्रिया')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'आपका स्वागत है! किसी भी अन्य काम के लिए मुझे बताइए।' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'You are welcome! Aur kuch update karna ho toh bataiye.' });
    }
    return res.json({ reply: 'You are welcome! Let me know if you need anything else.' });
  }

  // 14. Greetings & Hello
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('hey') || raw.includes('नमस्ते') || raw.includes('नमस्कार')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'नमस्ते! आज मैं आपकी दुकान और खाते में क्या मदद करूँ?' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Namaste! Aaj aapke shop aur ledger me kya check karna hai?' });
    }
    return res.json({ reply: 'Hello! How can I assist you with your shop ledger or customers today?' });
  }

  // 15. Clean conversational prompt - strictly NO canned paragraph recitations
  if (userLang === 'hindi') {
    return res.json({ reply: 'जी बताइए, क्या एंट्री करनी है?' });
  }
  if (userLang === 'hinglish') {
    return res.json({ reply: 'Haanji, batayein, kya update karna hai?' });
  }
  return res.json({ reply: 'Yes, what would you like to update in your ledger?' });
});

// WebSocket Server for Gemini Live Real-time Audio
const wss = new WebSocketServer({ server, path: '/api/voice/live-ws' });
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected for live audio');

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {}
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });
});

// Vite Middleware for Development / Static serving for Production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[NotiBook] Server listening on http://0.0.0.0:${port}`);
  });
}

setupServer().catch((err) => {
  console.error('[NotiBook] Failed to start server:', err);
});

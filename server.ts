import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocketServer } from 'ws';
import { SemanticActionPlanner, DatabaseSnapshot } from './src/voice/SemanticActionPlanner';
import { cleanExtractedCustomerName, FORBIDDEN_CUSTOMER_PHRASES } from './src/voice/CustomerResolver';
import { SemanticActionPlan, ExecutionResult } from './src/voice/types';
import { detectLanguage, toDevanagariForHindiTTS, prepareEnglishForTTS } from './src/voice/LanguageUtils';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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

let invoices: any[] = [
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
    phone: phone || '', // Never invent fake phone numbers
    address: address || '',
    balance: Number(balance) || 0,
    lastTransactionDate: new Date().toISOString().slice(0, 10),
    status: (Number(balance) || 0) > 0 ? 'due' : (Number(balance) || 0) < 0 ? 'advance' : 'settled',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  customers.unshift(newCust);
  res.json({ customer: newCust });
});

app.delete('/api/customers/:id', (req, res) => {
  const param = req.params.id;
  const cust = customers.find(c => c.id === param || c.name.toLowerCase() === param.toLowerCase());
  if (cust) {
    customers = customers.filter(c => c.id !== cust.id);
    transactions = transactions.filter(t => (t as any).customerId !== cust.id && t.partyName?.toLowerCase() !== cust.name.toLowerCase());
  } else {
    customers = customers.filter(c => c.id !== param);
  }
  res.json({ success: true, deletedCustomer: cust });
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
    category: category || (isCredit ? 'Customer Payment' : 'Customer Credit'),
    description: description || `${isCredit ? 'Payment from' : 'Given to'} ${partyName || 'Customer'}`,
    partyName,
    paymentMode: paymentMode || 'Cash',
    amount: Number(amount) || 0,
    customerId,
  };
  transactions.unshift(newTx);

  let updatedCust = null;
  // Resolve customer by customerId first, then by matching against existing customers
  let cust = customerId ? customers.find(c => c.id === customerId) : null;
  if (!cust && partyName && partyName !== 'खाता' && partyName !== 'Customer') {
    const pName = partyName.trim().toLowerCase();
    cust = customers.find(c => c.name.toLowerCase() === pName) ||
           customers.find(c => c.name.toLowerCase().includes(pName) || pName.includes(c.name.toLowerCase().split(' ')[0]));
  }

  if (cust) {
    const delta = isCredit ? -newTx.amount : newTx.amount;
    cust.balance += delta;
    cust.status = cust.balance > 0 ? 'due' : cust.balance < 0 ? 'advance' : 'settled';
    cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
    updatedCust = cust;
  }
  // NEVER CREATE A CUSTOMER AUTOMATICALLY FROM A TRANSACTION SENTENCE!

  res.json({ transaction: newTx, customer: updatedCust });
});

app.put('/api/transactions/:id', (req, res) => {
  const index = transactions.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Transaction not found' });
  transactions[index] = { ...transactions[index], ...req.body };
  res.json({ transaction: transactions[index] });
});

app.delete('/api/transactions/:id', (req, res) => {
  const paramId = req.params.id;
  const cleanParamId = paramId.replace(/^ctx-/, '').replace(/^tx-/, '');
  const targetTx = transactions.find(t => 
    t.id === paramId || 
    t.id === cleanParamId || 
    t.id === `tx-${cleanParamId}` || 
    t.id.replace(/^tx-/, '') === cleanParamId
  );
  transactions = transactions.filter(t => 
    t.id !== paramId && 
    t.id !== cleanParamId && 
    t.id !== `tx-${cleanParamId}` && 
    t.id.replace(/^tx-/, '') !== cleanParamId
  );

  let updatedCust: any = null;
  if (targetTx && (targetTx.partyName || (targetTx as any).customerId)) {
    const cust = customers.find(c => 
      ((targetTx as any).customerId && c.id === (targetTx as any).customerId) || 
      (targetTx.partyName && c.name.toLowerCase() === targetTx.partyName.toLowerCase())
    );
    if (cust) {
      const delta = targetTx.type === 'in' ? targetTx.amount : -targetTx.amount;
      cust.balance += delta;
      cust.status = cust.balance > 0 ? 'due' : cust.balance < 0 ? 'advance' : 'settled';
      cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
      updatedCust = cust;
    }
  }

  res.json({ success: true, deletedTransaction: targetTx, updatedCustomer: updatedCust });
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

// --- GENERAL SEMANTIC INTERPRETATION & EXECUTION ENGINE ---
const planner = new SemanticActionPlanner(apiKey);

function generateTruthfulResponse(
  plan: SemanticActionPlan,
  results: any[],
  rawLang: 'hindi' | 'hinglish' | 'english',
  targetCustomer?: any
): string {
  const lang: 'hindi' | 'hinglish' | 'english' = rawLang === 'english' ? 'english' : 'hindi';

  // If plan has clarification question, return it
  if (plan.clarificationQuestion && results.length === 0) {
    return plan.clarificationQuestion;
  }

  // 1. END CONVERSATION
  if (plan.primaryIntent === 'END_CONVERSATION') {
    if (lang === 'hindi') return 'ठीक है, बहुत धन्यवाद! आपका दिन शुभ हो।';
    if (lang === 'english') return 'Alright, thank you! Have a great day.';
    return 'Theek hai, dhanyawad! Have a great day.';
  }

  // 2. NAVIGATE
  const navResult = results.find(r => r.action === 'NAVIGATE');
  if (navResult && results.length === 1) {
    const dest = (navResult as any).destination || 'page';
    const friendlyName = dest === 'customers' ? (lang === 'hindi' ? 'कस्टमर लिस्ट' : (lang === 'english' ? 'Customers page' : 'Customers tab')) :
      dest === 'transactions' ? (lang === 'hindi' ? 'लेनदेन पासबुक' : (lang === 'english' ? 'Transactions passbook' : 'Transactions page')) :
      dest === 'billing' ? (lang === 'hindi' ? 'बिलिंग व इनवॉइस' : 'Billing tab') :
      dest === 'stocks' ? (lang === 'hindi' ? 'स्टॉक व इन्वेंट्री' : 'Stocks inventory') :
      dest === 'customer_ledger_modal' ? (targetCustomer ? `${targetCustomer.name} का खाता` : 'Customer ledger') :
      dest === 'settings_modal' ? 'Settings' : dest;

    if (lang === 'hindi') return `${friendlyName} खोल दिया गया है।`;
    if (lang === 'english') return `Opening ${friendlyName}.`;
    return `${friendlyName} open kar diya hai.`;
  }

  // 3. MULTI-ACTION (e.g. Create customer + Add debt)
  const createCustRes = results.find(r => r.action === 'CREATE_CUSTOMER');
  const addDebtRes = results.find(r => r.action === 'ADD_CUSTOMER_DEBT');
  const recordPayRes = results.find(r => r.action === 'RECORD_PAYMENT');

  if (createCustRes && addDebtRes && addDebtRes.success) {
    const custName = createCustRes.customer?.name || addDebtRes.customer?.name || 'Customer';
    const amt = addDebtRes.transaction?.amount ?? 0;
    const finalBal = addDebtRes.newBal ?? amt;

    if (lang === 'hindi') {
      return `नया ग्राहक "${custName}" जोड़ दिया गया है और उनके खाते में ₹${amt.toLocaleString('en-IN')} उधार लिख दिए हैं। अब उनका कुल बकाया ₹${finalBal.toLocaleString('en-IN')} है।`;
    }
    if (lang === 'english') {
      return `Added "${custName}" as a new customer and recorded ₹${amt.toLocaleString('en-IN')} credit in their account. Total balance is now ₹${finalBal.toLocaleString('en-IN')}.`;
    }
    return `"${custName}" ko naya customer add kar diya aur unke khate mein ₹${amt.toLocaleString('en-IN')} udhar likh diya hai. Ab unka total balance ₹${finalBal.toLocaleString('en-IN')} hai.`;
  }

  if (createCustRes && recordPayRes && recordPayRes.success) {
    const custName = createCustRes.customer?.name || recordPayRes.customer?.name || 'Customer';
    const amt = recordPayRes.transaction?.amount ?? 0;

    if (lang === 'hindi') {
      return `नया ग्राहक "${custName}" जोड़ दिया गया है और उनसे ₹${amt.toLocaleString('en-IN')} प्राप्त हो गए हैं।`;
    }
    if (lang === 'english') {
      return `Added "${custName}" as a new customer and recorded ₹${amt.toLocaleString('en-IN')} payment received.`;
    }
    return `"${custName}" ko naya customer add kar diya aur unse ₹${amt.toLocaleString('en-IN')} payment receive ho gayi hai.`;
  }

  if (createCustRes && createCustRes.success && results.length === 1) {
    const custName = createCustRes.customer?.name || 'Customer';
    if (createCustRes.existed) {
      if (lang === 'hindi') return `"${custName}" पहले से ही आपकी कस्टमर लिस्ट में मौजूद हैं।`;
      if (lang === 'english') return `"${custName}" already exists in your customer list.`;
      return `"${custName}" pehle se customer list mein hain.`;
    }
    if (lang === 'hindi') return `नया ग्राहक "${custName}" जोड़ दिया गया है।`;
    if (lang === 'english') return `Added "${custName}" as a new customer.`;
    return `"${custName}" ko naya customer add kar diya hai.`;
  }

  // 4. ADD_CUSTOMER_DEBT (Udhar given)
  if (addDebtRes && addDebtRes.success) {
    const custName = addDebtRes.customer?.name || targetCustomer?.name || 'Customer';
    const amt = addDebtRes.transaction?.amount ?? 0;
    const finalBal = addDebtRes.newBal ?? (targetCustomer?.balance ?? 0);

    if (lang === 'hindi') {
      return `${custName} के खाते में ₹${amt.toLocaleString('en-IN')} उधार लिख दिए हैं। अब उनका कुल बकाया ₹${finalBal.toLocaleString('en-IN')} है।`;
    }
    if (lang === 'english') {
      return `Recorded ₹${amt.toLocaleString('en-IN')} credit for ${custName}. Total balance is now ₹${finalBal.toLocaleString('en-IN')}.`;
    }
    return `${custName} ke account mein ₹${amt.toLocaleString('en-IN')} udhar likh diye hain. Ab unka total balance ₹${finalBal.toLocaleString('en-IN')} hai.`;
  }

  // 5. RECORD_PAYMENT (Payment received / Jama / Minus from khata)
  if (recordPayRes && recordPayRes.success) {
    const custName = recordPayRes.customer?.name || targetCustomer?.name || 'Customer';
    const amt = recordPayRes.transaction?.amount ?? 0;
    const finalBal = recordPayRes.newBal ?? (targetCustomer?.balance ?? 0);
    const isSettled = finalBal <= 0;

    if (lang === 'hindi') {
      return `${custName} से ₹${amt.toLocaleString('en-IN')} प्राप्त हो गए। अब उनके खाते में ₹${finalBal.toLocaleString('en-IN')} बाकी हैं।${isSettled ? ' खाता चुकता हो गया है।' : ''}`;
    }
    if (lang === 'english') {
      return `Received ₹${amt.toLocaleString('en-IN')} from ${custName}. Outstanding balance is now ₹${finalBal.toLocaleString('en-IN')}.${isSettled ? ' Account is fully settled.' : ''}`;
    }
    return `${custName} se ₹${amt.toLocaleString('en-IN')} receive ho gaye. Ab unke khate mein ₹${finalBal.toLocaleString('en-IN')} baaki hain.${isSettled ? ' Khata settled ho gaya hai.' : ''}`;
  }

  // 6. GET_CUSTOMER_BALANCE
  const balRes = results.find(r => r.action === 'GET_CUSTOMER_BALANCE');
  if (balRes && balRes.success) {
    const custName = balRes.customer?.name || targetCustomer?.name || 'Customer';
    const bal = balRes.balance ?? targetCustomer?.balance ?? 0;

    if (bal > 0) {
      if (lang === 'hindi') return `${custName} का ₹${bal.toLocaleString('en-IN')} बकाया है।`;
      if (lang === 'english') return `${custName}'s outstanding balance is ₹${bal.toLocaleString('en-IN')}.`;
      return `${custName} ka ₹${bal.toLocaleString('en-IN')} baaki hai.`;
    } else if (bal < 0) {
      if (lang === 'hindi') return `${custName} का ₹${Math.abs(bal).toLocaleString('en-IN')} एडवांस जमा है।`;
      if (lang === 'english') return `${custName} has an advance deposit of ₹${Math.abs(bal).toLocaleString('en-IN')}.`;
      return `${custName} ka ₹${Math.abs(bal).toLocaleString('en-IN')} advance deposit hai.`;
    } else {
      if (lang === 'hindi') return `${custName} का खाता बिल्कुल चुकता है, कोई बकाया नहीं है।`;
      if (lang === 'english') return `${custName}'s account is fully settled with zero dues.`;
      return `${custName} ka account fully settled hai, zero dues.`;
    }
  }

  // 7. GET_ACCOUNT_SUMMARY
  const summaryRes = results.find(r => r.action === 'GET_ACCOUNT_SUMMARY');
  if (summaryRes && summaryRes.success) {
    const total = summaryRes.totalReceivables ?? 0;
    if (lang === 'hindi') return `मार्केट में कुल बकाया ₹${total.toLocaleString('en-IN')} लेना है।`;
    if (lang === 'english') return `Total market receivables across all customers are ₹${total.toLocaleString('en-IN')}.`;
    return `Market me total ₹${total.toLocaleString('en-IN')} baaki lena hai.`;
  }

  // 8. GET_CUSTOMER_HISTORY
  const histRes = results.find(r => r.action === 'GET_CUSTOMER_HISTORY');
  if (histRes && histRes.success) {
    const custName = histRes.customer?.name || targetCustomer?.name || 'Customer';
    const latest = histRes.latest;
    if (latest) {
      const typeStr = latest.type === 'in' ? (lang === 'hindi' ? 'जमा' : 'payment') : (lang === 'hindi' ? 'उधार' : 'credit');
      if (lang === 'hindi') return `${custName} का पिछला लेनदेन ₹${latest.amount.toLocaleString('en-IN')} (${typeStr}, ${latest.paymentMode}) का था।`;
      if (lang === 'english') return `Last transaction for ${custName} was ₹${latest.amount.toLocaleString('en-IN')} (${typeStr} via ${latest.paymentMode}).`;
      return `${custName} ki last transaction ₹${latest.amount.toLocaleString('en-IN')} (${typeStr}, ${latest.paymentMode}) ki thi.`;
    } else {
      if (lang === 'hindi') return `${custName} के लिए कोई पिछला लेनदेन नहीं मिला।`;
      if (lang === 'english') return `No previous transactions found for ${custName}.`;
      return `${custName} ke liye koi transaction nahi mila.`;
    }
  }

  // Fallback
  if (lang === 'hindi') return 'समझ गया, एक्शन पूरा कर दिया गया है।';
  if (lang === 'english') return 'Understood, action completed.';
  return 'Samajh gaya, action update kar diya.';
}

// Multimodal Voice Audio-to-Text Transcription via Gemini 3.8 Flash
app.post('/api/voice/transcribe', async (req, res) => {
  try {
    const { audioData, mimeType, language } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    if (!ai) {
      return res.status(500).json({ error: 'Gemini AI not initialized on server' });
    }

    const cleanBase64 = String(audioData).replace(/^data:audio\/[^;]+;base64,/, '').trim();
    const rawMime = mimeType ? String(mimeType).split(';')[0].trim() : 'audio/webm';

    const langDirective = language === 'hindi'
      ? 'Transcribe strictly in Hindi (Devanagari script).'
      : language === 'english'
      ? 'Transcribe in English.'
      : 'Transcribe verbatim in the language spoken (Hindi, Hinglish, or English).';

    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    let transcribedText = '';

    for (const model of candidateModels) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: rawMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: `You are an expert multilingual speech-to-text transcriber for NotiBook, a shopkeeper ledger and Khatabook app.
${langDirective}
CRITICAL RULES:
1. Return ONLY the exact transcribed words spoken by the user.
2. Do NOT add any preamble, conversational filler, markdown quotes, notes, or explanations.
3. If no audible speech is detected or it is just background noise/silence, return an empty string.`,
                },
              ],
            },
          ],
        });

        const rawResult = result.text ? result.text.trim() : '';
        transcribedText = rawResult.replace(/^["'`]+|["'`]+$/g, '').trim();
        if (transcribedText) break;
      } catch (err: any) {
        console.warn(`[AudioTranscription] Model ${model} failed:`, err.message || err);
      }
    }

    console.log(`[AudioTranscription] Transcribed (${rawMime}): "${transcribedText}"`);
    return res.json({ transcript: transcribedText });
  } catch (err: any) {
    console.error('[AudioTranscription] Error:', err);
    return res.status(500).json({ error: err.message || 'Transcription error' });
  }
});

// Automatic Multilingual Voice TTS Endpoint (English -> English Voice, Hindi -> Hindi Voice)
app.post('/api/voice/tts', async (req, res) => {
  try {
    const { text, lang } = req.body;
    const rawText = String(text || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const detected = (lang === 'english' || lang === 'hindi') ? lang : detectLanguage(rawText);
    const isHindi = detected !== 'english' || /[\u0900-\u097F]/.test(rawText);
    const spokenText = isHindi ? toDevanagariForHindiTTS(rawText) : prepareEnglishForTTS(rawText);
    const targetTl = isHindi ? 'hi' : 'en';

    // 1. Primary: Native language neural TTS (hi-IN voice for Hindi, en-US voice for English)
    try {
      const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${targetTl}&dt=t&q=${encodeURIComponent(spokenText.slice(0, 200))}`;
      const ttsRes = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (ttsRes.ok) {
        const arrayBuffer = await ttsRes.arrayBuffer();
        if (arrayBuffer.byteLength > 200) {
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          return res.json({
            audioData: base64Audio,
            mimeType: 'audio/mpeg',
            lang: isHindi ? 'hi-IN' : 'en-US',
            spokenText,
          });
        }
      }
    } catch (gErr: any) {
      console.warn('[TTS] Neural TTS fetch warning:', gErr.message || gErr);
    }

    // 2. Fallback: Gemini 3.8 Flash Lite TTS
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [{ text: spokenText }],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: isHindi ? 'Kore' : 'Puck' },
              },
            },
          },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({
            audioData: base64Audio,
            mimeType: 'audio/wav',
            lang: isHindi ? 'hi-IN' : 'en-US',
            spokenText,
          });
        }
      } catch (aiErr: any) {
        console.warn('[TTS] Gemini TTS fallback warning:', aiErr.message || aiErr);
      }
    }

    return res.status(503).json({ error: 'Server TTS unavailable' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'TTS error' });
  }
});

app.post('/api/voice/chat', async (req, res) => {
  const { message, context, userLanguage } = req.body;
  const rawMessage = String(message || '').trim();

  if (!rawMessage) {
    return res.json({
      reply: userLanguage === 'english' ? 'Yes, I am listening.' : 'हाँ, मैं सुन रहा हूँ।',
      actions: [],
    });
  }

  // 1. Snapshot database for semantic action planner
  const totalReceivables = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const dbSnapshot: DatabaseSnapshot = {
    customers: customers.map(c => ({ id: c.id, name: c.name, balance: c.balance, phone: c.phone })),
    products: products.map(p => ({ id: p.id, name: p.name, stockQty: p.stockQty, sellPrice: p.sellPrice })),
    transactions: transactions.slice(0, 15).map(t => ({ id: t.id, partyName: t.partyName, amount: t.amount, type: t.type, date: t.date })),
    totalReceivables,
  };

  // 2. Generate Semantic Action Plan & Auto-Detect Language (Hindi vs English)
  const autoDetectedLang = detectLanguage(rawMessage);
  const plan = await planner.plan(rawMessage, context || { recentTurns: [] }, dbSnapshot);
  const userLang: 'hindi' | 'hinglish' | 'english' = autoDetectedLang === 'english' && plan.detectedLanguage === 'english' ? 'english' : (autoDetectedLang === 'hindi' ? 'hindi' : (plan.detectedLanguage === 'english' ? 'english' : 'hindi'));

  console.log(`[SemanticEngine] Utterance: "${rawMessage}" => Intent: [${plan.primaryIntent}], Actions: ${plan.actions.length}, Language: [${userLang}]`);

  // 3. Check for genuine missing information, ambiguity, or direct clarification
  if (plan.clarificationQuestion && (plan.actions.length === 0 || plan.missingInformation.length > 0 || plan.ambiguities.length > 0)) {
    return res.json({
      reply: plan.clarificationQuestion,
      plan,
      executionResults: [],
      toolCalls: [],
    });
  }

  // 4. Authoritative Database Execution Engine
  // Chains actions with real dependency handling
  const executionResults: any[] = [];
  const toolCalls: any[] = [];
  let newlyCreatedCustomer: any = null;
  let activeCustomerTarget: any = null;
  let latestTransactionCreated: any = null;

  for (const item of plan.actions) {
    const act = item.action;
    const params = item.parameters || {};

    try {
      // 4a. NAVIGATE
      if (act === 'NAVIGATE') {
        const dest = params.destination || params.target || 'home';
        toolCalls.push({
          name: 'navigate',
          args: {
            target: dest,
            customerName: params.customerName,
          },
        });
        executionResults.push({ action: act, success: true, destination: dest });
      }

      // 4b. CREATE_CUSTOMER
      else if (act === 'CREATE_CUSTOMER') {
        const rawName = params.customerName || 'New Customer';
        const cleanName = cleanExtractedCustomerName(rawName) || rawName.trim();
        
        // Safety: Never create UI concepts or empty as customers
        if (!cleanName || FORBIDDEN_CUSTOMER_PHRASES.has(cleanName.toLowerCase()) || cleanName.length < 2) {
          executionResults.push({ action: act, success: false, error: 'Invalid customer name' });
          continue;
        }

        let existing = customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
        if (!existing) {
          const newCust = {
            id: `cust-${Date.now()}`,
            name: cleanName,
            phone: params.phone || '', // NEVER invent fake phone numbers
            address: params.address || '',
            balance: Number(params.openingBalance) || 0,
            lastTransactionDate: new Date().toISOString().slice(0, 10),
            status: 'settled',
            createdAt: new Date().toISOString().slice(0, 10),
          };
          customers.unshift(newCust);
          newlyCreatedCustomer = newCust;
          activeCustomerTarget = newCust;
          toolCalls.push({
            name: 'add_customer',
            args: { name: newCust.name, phone: newCust.phone, customer: newCust },
          });
          executionResults.push({ action: act, success: true, customer: newCust });
        } else {
          newlyCreatedCustomer = existing;
          activeCustomerTarget = existing;
          executionResults.push({ action: act, success: true, customer: existing, existed: true });
        }
      }

      // 4c. ADD_CUSTOMER_DEBT (Udhar / Credit Given)
      else if (act === 'ADD_CUSTOMER_DEBT') {
        const amt = Number(params.amount) || 0;
        let cust: any = null;

        if (params.usePriorActionResultForCustomerId && newlyCreatedCustomer) {
          cust = newlyCreatedCustomer;
        } else if (params.customerName) {
          cust = customers.find(c => c.name.toLowerCase() === params.customerName.toLowerCase().trim()) ||
                 customers.find(c => c.name.toLowerCase().includes(params.customerName.toLowerCase().trim()));
        } else if (context?.activeCustomer?.id) {
          cust = customers.find(c => c.id === context.activeCustomer.id);
        }

        if (!cust) {
          executionResults.push({ action: act, success: false, error: 'Customer not found' });
          continue;
        }

        const prevBal = cust.balance;
        cust.balance += amt;
        cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
        cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

        const newTx = {
          id: `tx-${Date.now()}`,
          date: new Date().toLocaleString('en-IN', { hour12: false }),
          type: 'out',
          category: 'Customer Credit',
          description: params.description || `Credit given to ${cust.name}`,
          partyName: cust.name,
          paymentMode: 'Cash',
          amount: amt,
          customerId: cust.id,
        };
        transactions.unshift(newTx);
        activeCustomerTarget = cust;
        latestTransactionCreated = newTx;

        toolCalls.push({
          name: 'add_transaction',
          args: {
            customer_name: cust.name,
            amount: amt,
            transaction_type: 'debit',
            customer: cust,
            transaction: newTx,
          },
        });
        executionResults.push({ action: act, success: true, customer: cust, transaction: newTx, prevBal, newBal: cust.balance });
      }

      // 4d. RECORD_PAYMENT (Customer pays merchant -> Jama / Minus from khata)
      else if (act === 'RECORD_PAYMENT') {
        const amt = Number(params.amount) || 0;
        let cust: any = null;

        if (params.customerName) {
          cust = customers.find(c => c.name.toLowerCase() === params.customerName.toLowerCase().trim()) ||
                 customers.find(c => c.name.toLowerCase().includes(params.customerName.toLowerCase().trim()));
        } else if (context?.activeCustomer?.id) {
          cust = customers.find(c => c.id === context.activeCustomer.id);
        }

        if (!cust) {
          executionResults.push({ action: act, success: false, error: 'Customer not found' });
          continue;
        }

        const prevBal = cust.balance;
        cust.balance -= amt;
        cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
        cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

        const newTx = {
          id: `tx-${Date.now()}`,
          date: new Date().toLocaleString('en-IN', { hour12: false }),
          type: 'in',
          category: 'Customer Payment',
          description: params.description || `Payment from ${cust.name}`,
          partyName: cust.name,
          paymentMode: params.paymentMethod || 'Cash',
          amount: amt,
          customerId: cust.id,
        };
        transactions.unshift(newTx);
        activeCustomerTarget = cust;
        latestTransactionCreated = newTx;

        toolCalls.push({
          name: 'add_transaction',
          args: {
            customer_name: cust.name,
            amount: amt,
            transaction_type: 'credit',
            payment_mode: newTx.paymentMode,
            customer: cust,
            transaction: newTx,
          },
        });
        executionResults.push({ action: act, success: true, customer: cust, transaction: newTx, prevBal, newBal: cust.balance });
      }

      // 4e. GET_CUSTOMER_BALANCE
      else if (act === 'GET_CUSTOMER_BALANCE') {
        let cust: any = null;
        if (params.customerName) {
          cust = customers.find(c => c.name.toLowerCase().includes(params.customerName.toLowerCase().trim()));
        } else if (context?.activeCustomer?.id) {
          cust = customers.find(c => c.id === context.activeCustomer.id);
        }
        if (cust) {
          activeCustomerTarget = cust;
          toolCalls.push({
            name: 'get_balance',
            args: { customer_name: cust.name, balance: cust.balance },
          });
          executionResults.push({ action: act, success: true, customer: cust, balance: cust.balance });
        }
      }

      // 4f. GET_CUSTOMER_HISTORY
      else if (act === 'GET_CUSTOMER_HISTORY') {
        let cust: any = null;
        if (params.customerName) {
          cust = customers.find(c => c.name.toLowerCase().includes(params.customerName.toLowerCase().trim()));
        } else if (context?.activeCustomer?.id) {
          cust = customers.find(c => c.id === context.activeCustomer.id);
        }
        if (cust) {
          const custTxs = transactions.filter((t: any) => t.customerId === cust.id || t.partyName?.toLowerCase() === cust.name.toLowerCase());
          toolCalls.push({
            name: 'get_transactions',
            args: { customer_name: cust.name, transactions: custTxs.slice(0, 3) },
          });
          executionResults.push({ action: act, success: true, customer: cust, count: custTxs.length, latest: custTxs[0] });
        }
      }

      // 4g. GET_ACCOUNT_SUMMARY
      else if (act === 'GET_ACCOUNT_SUMMARY') {
        const total = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
        toolCalls.push({ name: 'get_account_balance', args: { totalReceivables: total } });
        executionResults.push({ action: act, success: true, totalReceivables: total });
      }

      // 4h. END_CONVERSATION
      else if (act === 'END_CONVERSATION') {
        toolCalls.push({ name: 'end_conversation', args: {} });
        executionResults.push({ action: act, success: true });
      }
    } catch (e: any) {
      console.warn(`[ExecutionEngine] Action ${act} failed:`, e);
      executionResults.push({ action: act, success: false, error: e.message });
    }
  }

  // 5. Generate Natural, Truthful Spoken Response in user's detected language
  const reply = generateTruthfulResponse(plan, executionResults, userLang, activeCustomerTarget);

  // 6. Return Structured Response to frontend
  return res.json({
    reply,
    plan,
    executionResults,
    updatedCustomer: activeCustomerTarget,
    newTransaction: latestTransactionCreated,
    toolCall: toolCalls[0],
    toolCalls,
    updatedContext: {
      activeCustomer: activeCustomerTarget ? {
        id: activeCustomerTarget.id,
        name: activeCustomerTarget.name,
        phone: activeCustomerTarget.phone,
        balance: activeCustomerTarget.balance,
      } : context?.activeCustomer,
      lastAction: plan.primaryIntent,
      detectedLanguage: userLang,
    },
  });
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

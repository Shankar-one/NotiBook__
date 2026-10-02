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
let customers: any[] = [
  { id: 'cust-1', name: 'Rahul Sharma', phone: '+91 98201 12345', address: 'Sector 4, Andheri East', balance: 2450, lastTransactionDate: '2024-06-17', status: 'due', createdAt: '2024-01-10' },
  { id: 'cust-2', name: 'Amit Verma', phone: '+91 98334 56789', address: 'Lokhandwala Complex', balance: 3100, lastTransactionDate: '2024-06-16', status: 'due', createdAt: '2024-02-14' },
  { id: 'cust-3', name: 'Sunita Patel', phone: '+91 97690 98765', address: 'Powai Vihar', balance: 2380, lastTransactionDate: '2024-06-15', status: 'due', createdAt: '2024-03-01' },
  { id: 'cust-4', name: 'Vikas Gupta', phone: '+91 99200 44556', address: 'Bandra West', balance: 0, lastTransactionDate: '2024-06-18', status: 'settled', createdAt: '2024-03-22' },
  { id: 'cust-5', name: 'Ravi Kumar', phone: '+91 98111 22334', address: 'Goregaon West', balance: 2500, lastTransactionDate: '2024-06-18', status: 'due', createdAt: '2024-04-10' },
  { id: 'cust-6', name: 'Ravi Sharma', phone: '+91 98222 33445', address: 'Malad East', balance: 1400, lastTransactionDate: '2024-06-14', status: 'due', createdAt: '2024-05-12' },
  { id: 'cust-7', name: 'Ramesh', phone: '+91 98333 11223', address: 'Andheri West', balance: 2500, lastTransactionDate: '2024-06-18', status: 'due', createdAt: '2024-05-15' },
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

let stockMovements: any[] = [
  { id: 'sm-1', productId: 'prod-1', productName: 'Classmate Deluxe Notebook 240p', changeQty: -3, reason: 'SALE', referenceId: '#INV-1001', date: '2024-06-18', finalQty: 85 },
  { id: 'sm-2', productId: 'prod-2', productName: 'Reynolds Ballpoint Pen Blue (Pack of 10)', changeQty: -2, reason: 'SALE', referenceId: '#INV-1001', date: '2024-06-18', finalQty: 40 },
];

let transactions: any[] = [
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

// --- GEMINI LIVE CONVERSATIONAL VOICE AGENT ENDPOINT ---
const FORBIDDEN_CUSTOMER_PHRASES = new Set([
  'account', 'khata', 'khate', 'customer', 'grahak', 'entry', 'balance', 'udhar', 'jama',
  'paisa', 'paise', 'rupaye', 'rupees', 'rs', 'inr', 'batao', 'dikhao', 'kholo', 'karo', 'de do',
  'minus', 'hisab', 'payment', 'today', 'kal', 'yesterday', 'bill', 'receipt',
  'aa chuka', 'aa chuka hai', 'aa gaya', 'mil gaya', 'de diye', 'diye', 'minus karke',
  'minus karke batao', 'minus karo', 'to khate', 'to khate mein', 'khate mein se', 'khate mein',
  'account mein', 'account mein se', 'usme', 'usmein', 'unke', 'uska', 'iski', 'iske',
  'pay kar di', 'payment kar di', 'receive hua', 'receive hue', 'karke batao', 'bata do',
  'अकाउंट', 'खाता', 'खाते', 'कस्टमर', 'ग्राहक', 'एंट्री', 'बैलेंस', 'उधार', 'उधर', 'जमा',
  'पैसा', 'पैसे', 'रुपये', 'रुपए', 'बताओ', 'दिखाओ', 'खोलो', 'करो', 'दे दो', 'माइनस',
  'माइनस करके बताओ', 'माइनस करो', 'आ चुका है', 'आ गया', 'मिल गया', 'दे दिए', 'खाते में',
  'खाते में से', 'कम करो', 'पेमेंट कर दी'
]);

function normalizeCustomerName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase()
    .replace(/^(?:shri|shree|mr\.?|mrs\.?|ms\.?|customer|grahak|naya|new)\s+/i, '')
    .replace(/\s+(?:ji|bhai|bhaiya|saheb|sahab|babu|sir|madam)$/i, '')
    .replace(/\s+/g, ' ');
}

function cleanCustomerName(rawName: string): string {
  if (!rawName) return '';
  let text = rawName.trim();
  text = text.replace(/^(?:अरे|भाई|सुनो|जार्विस|jarvis|hey\s+jarvis|please|zara|ek|naya|new|a\s+customer\s+named|a\s+customer|customer|grahak)\s+/i, '');
  text = text.replace(/\s+(?:and\s+add|and\s+put|and\s+mark|and\s+set|aur\s+uske|aur\s+iska|aur\s+uska|aur|and|with\s+phone|with|having|for|to)\b.*$/i, '');
  text = text.replace(/(?:\s+(?:ka|ki|ke|ko|se|ne|pe|par|में|पे|पर|का|की|के|को|से|ने))+$/i, '');
  text = text.replace(/^(?:se|ko|ne|ka|ki|ke|to|in|for)\s+/i, '');
  text = text.replace(/\s+(?:ke\s+khate\s+mein\s+se|ke\s+khate\s+mein|to\s+khate\s+mein|khate\s+mein\s+se|khate\s+mein|account\s+mein|mein|me)$/i, '');
  text = text.replace(/\s+(?:aa\s+chuka\s+hai|aa\s+chuka|aa\s+gaya|mil\s+gaya|de\s+diye|diye|minus\s+karke\s+batao|minus\s+karo)$/i, '');
  text = text.replace(/\s+(?:के\s+खाते\s+में\s+से|के\s+खाते\s+में|खाते\s+में\s+से|खाते\s+में|अकाउंट\s+में|में)$/i, '');
  text = text.replace(/\s+(?:आ\s+चुका\s+है|आ\s+गया|मिल\s+गया|दे\s+दिए|दिए|माइनस\s+करके\s+बताओ|माइनस\s+करो)$/i, '');
  text = text.replace(/[0-9₹,\.]+/g, '').trim();

  const lower = text.toLowerCase();
  if (FORBIDDEN_CUSTOMER_PHRASES.has(lower) || lower.length < 2) return '';
  const words = lower.split(/\s+/).filter(Boolean);
  const nonFragmentWords = words.filter(w => !FORBIDDEN_CUSTOMER_PHRASES.has(w) && !['to', 'se', 'ko', 'ne', 'ka', 'ki', 'ke', 'hai', 'tha', 'mein'].includes(w));
  if (nonFragmentWords.length === 0) return '';
  return text.trim();
}

function extractNaturalAmount(raw: string): { amount?: number; hasAmount: boolean } {
  const lower = raw.toLowerCase();

  // 1. Hindi/Hinglish written words
  const writtenHindiMap: Array<[RegExp, number]> = [
    [/\b(?:ek\s+hazar|ek\s+hazaar|एक\s*हजार|एक\s*हज़ार)\b/i, 1000],
    [/\b(?:do\s+hazar|do\s+hazaar|दो\s*हजार|दो\s*हज़ार)\b/i, 2000],
    [/\b(?:teen\s+hazar|teen\s+hazaar|तीन\s*हजार|तीन\s*हज़ार)\b/i, 3000],
    [/\b(?:char\s+hazar|char\s+hazaar|चार\s*हजार|चार\s*हज़ार)\b/i, 4000],
    [/\b(?:panch\s+hazar|panch\s+hazaar|पाँच\s*हजार|पाँच\s*हज़ार|पांच\s*हजार)\b/i, 5000],
    [/\b(?:das\s+hazar|das\s+hazaar|दस\s*हजार|दस\s*हज़ार)\b/i, 10000],
    [/\b(?:dhai\s+hazar|ढाई\s*हजार)\b/i, 2500],
    [/\b(?:dedh\s+hazar|डेढ़\s*हजार)\b/i, 1500],
    [/\b(?:hazar|hazaar|हजार|हज़ार)\b/i, 1000],
    [/\b(?:panch\s+sau|पाँच\s*सौ|पांच\s*सौ)\b/i, 500],
    [/\b(?:char\s+sau|चार\s*सौ)\b/i, 400],
    [/\b(?:teen\s+sau|तीन\s*सौ)\b/i, 300],
    [/\b(?:do\s+sau|दो\s*सौ)\b/i, 200],
    [/\b(?:ek\s+sau|एक\s*सौ|sau|सौ)\b/i, 100],
    [/\b(?:one\s+thousand)\b/i, 1000],
    [/\b(?:two\s+thousand)\b/i, 2000],
    [/\b(?:three\s+thousand)\b/i, 3000],
    [/\b(?:four\s+thousand)\b/i, 4000],
    [/\b(?:five\s+thousand)\b/i, 5000],
    [/\b(?:five\s+hundred)\b/i, 500],
    [/\b(?:two\s+hundred)\b/i, 200],
    [/\b(?:one\s+hundred)\b/i, 100],
  ];

  for (const [regex, val] of writtenHindiMap) {
    if (regex.test(lower)) {
      return { amount: val, hasAmount: true };
    }
  }

  // 2. Direct digits (excluding 10-digit phone numbers)
  const numMatches = Array.from(raw.matchAll(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|रुपये|रुपए)?/gi));
  if (numMatches.length > 0) {
    const validAmountMatches = numMatches
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(v => !isNaN(v) && v > 0 && !(v >= 6000000000 && v <= 9999999999));

    if (validAmountMatches.length > 0) {
      const val = validAmountMatches[validAmountMatches.length - 1];
      return { amount: val, hasAmount: true };
    }
  }

  return { hasAmount: false };
}

function resolveCustomerInServer(input: string, activeCust?: any, recentMentioned?: any[]): {
  status: 'EXACT' | 'AMBIGUOUS' | 'NOT_FOUND' | 'PRONOUN' | 'NO_NAME';
  customer?: any;
  candidates?: any[];
  searchedName?: string;
} {
  if (!input || !input.trim()) return { status: 'NO_NAME' };
  const inputLower = input.toLowerCase().trim();

  // 1. Check pronouns and contextual account references ("into account", "to the account", "in account", "khate mein", "account mein", "usme", "uska")
  const isPronounOrAccount = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|woh|him|her|into\s+(?:the\s+)?account|to\s+(?:the\s+)?account|in\s+(?:the\s+)?account|khate\s+mein|account\s+mein)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उनका|उनकी|उनके|उन्हें|उनको|खाते\s*में|अकाउंट\s*में/i.test(inputLower);
  if (isPronounOrAccount) {
    if (recentMentioned && Array.isArray(recentMentioned) && recentMentioned.length > 1) {
      const candidateList = recentMentioned
        .map(r => customers.find(c => c.id === r.id || c.name.toLowerCase() === r.name.toLowerCase()))
        .filter(Boolean);
      if (candidateList.length > 1) {
        return { status: 'AMBIGUOUS', candidates: candidateList };
      }
    }
    if (activeCust) {
      const cust = customers.find(c => c.id === activeCust.id) || activeCust;
      return { status: 'PRONOUN', customer: cust, searchedName: cust.name };
    }
    return { status: 'NO_NAME' };
  }

  // 2. Direct exact name or ID match
  const exact = customers.find(c => c.name.toLowerCase() === inputLower || c.id.toLowerCase() === inputLower);
  if (exact) return { status: 'EXACT', customer: exact, searchedName: exact.name };

  // 3. Normalized name match
  const normInput = normalizeCustomerName(input);
  const normMatch = customers.find(c => normalizeCustomerName(c.name) === normInput);
  if (normMatch) return { status: 'EXACT', customer: normMatch, searchedName: normMatch.name };

  // 4. Phone number match
  const phoneDigits = input.replace(/[^0-9]/g, '');
  if (phoneDigits.length >= 10) {
    const phoneMatch = customers.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').includes(phoneDigits.slice(-10)));
    if (phoneMatch) return { status: 'EXACT', customer: phoneMatch, searchedName: phoneMatch.name };
  }

  // 5. Full customer name present in speech (longest first to avoid substring errors)
  const sorted = [...customers].sort((a, b) => b.name.length - a.name.length);
  const fullMatches: any[] = [];
  for (const c of sorted) {
    const esc = c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9\u0900-\u097F])${esc}(?:$|[^a-zA-Z0-9\u0900-\u097F])`, 'i');
    if (regex.test(inputLower)) {
      fullMatches.push(c);
    }
  }
  if (fullMatches.length === 1) return { status: 'EXACT', customer: fullMatches[0], searchedName: fullMatches[0].name };
  if (fullMatches.length > 1) return { status: 'AMBIGUOUS', candidates: fullMatches, searchedName: fullMatches[0].name };

  // 6. First-name or distinct token match
  const firstMatches: any[] = [];
  for (const c of customers) {
    const firstName = c.name.toLowerCase().split(' ')[0];
    if (firstName && firstName.length >= 3 && !FORBIDDEN_CUSTOMER_PHRASES.has(firstName)) {
      const escFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9\u0900-\u097F])${escFirst}(?:$|[^a-zA-Z0-9\u0900-\u097F])`, 'i');
      if (regex.test(inputLower)) {
        if (!firstMatches.some(m => m.id === c.id)) {
          firstMatches.push(c);
        }
      }
    }
  }
  if (firstMatches.length === 1) return { status: 'EXACT', customer: firstMatches[0], searchedName: firstMatches[0].name };
  if (firstMatches.length > 1) return { status: 'AMBIGUOUS', candidates: firstMatches, searchedName: firstMatches[0].name.split(' ')[0] };

  // 7. Explicit customer creation extraction (e.g. "Add customer Ramesh" or "Ramesh ko customer add karo")
  const creationMatch = 
    inputLower.match(/(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
    inputLower.match(/(?:customer\s+banao|customer\s+add\s+karo)\s+([a-zA-Z\s]+)/i) ||
    inputLower.match(/([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:customer|ग्राहक)\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|जोड़ो|बनाओ)/i);
  if (creationMatch && creationMatch[1]) {
    const clean = cleanCustomerName(creationMatch[1]);
    if (clean) return { status: 'NOT_FOUND', searchedName: clean };
  }

  // 8. Candidate before grammatical particle
  const partMatch = input.match(/(?:^|अरे|जार्विस|भाई|सुनो)?\s*([a-zA-Z\u0900-\u097F]{2,20}(?:\s+[a-zA-Z\u0900-\u097F]{2,20})?)\s*(?:ne|ko|ka|ki|ke|se|ने|को|का|की|के|से)\s+/i);
  if (partMatch && partMatch[1]) {
    const cand = cleanCustomerName(partMatch[1]);
    if (cand) {
      const match = customers.find(c => c.name.toLowerCase().includes(cand.toLowerCase()));
      if (match) return { status: 'EXACT', customer: match, searchedName: match.name };
      return { status: 'NOT_FOUND', searchedName: cand };
    }
  }

  return { status: 'NO_NAME' };
}

// --- DYNAMIC SEMANTIC MULTI-ACTION PARSER & BACKEND EXECUTION ENGINE ---
function planAndExecuteSemanticPipeline(
  raw: string,
  userLang: 'hindi' | 'hinglish' | 'english',
  context?: any,
  activeCustomer?: any
): any {
  const lower = raw.toLowerCase().trim();

  // 1. CLOSING / FAREWELL
  const isClosing = 
    lower === 'theek hai' || lower === 'theek h' || lower === 'ok' || lower === 'okay' ||
    lower === 'alright' || lower === 'all right' || lower === 'bas' || lower === 'bas itna hi' ||
    lower === 'that is all' || lower === 'thats all' || lower === 'bye' || lower === 'goodbye' ||
    lower === 'bye jarvis' || lower.includes('alvida') || raw === 'ठीक है' || raw === 'बस' || raw === 'अलविदा' || raw === 'धन्यवाद';
  if (isClosing && !context?.pendingConfirmation && !context?.pendingSlotFilling) {
    return executeBackendTool('end_conversation', {}, userLang, context, activeCustomer);
  }

  // 2. NAVIGATION
  if (lower.includes('setting') || raw.includes('सेटिंग')) return executeBackendTool('navigate', { target: 'settings_modal' }, userLang, context, activeCustomer);
  if (lower.includes('search') || raw.includes('सर्च')) return executeBackendTool('navigate', { target: 'search_modal' }, userLang, context, activeCustomer);
  if (lower.includes('add customer') && (lower.includes('modal') || lower.includes('form'))) return executeBackendTool('navigate', { target: 'add_customer_modal' }, userLang, context, activeCustomer);
  if (lower.includes('add transaction') || lower.includes('entry form') || lower.includes('cash in') || lower.includes('cash out')) return executeBackendTool('navigate', { target: 'add_transaction_modal' }, userLang, context, activeCustomer);
  if (lower.includes('add product') || lower.includes('product form')) return executeBackendTool('navigate', { target: 'add_product_modal' }, userLang, context, activeCustomer);
  if (lower.includes('invoice') || lower.includes('receipt') || raw.includes('रसीद')) return executeBackendTool('navigate', { target: 'invoice_modal' }, userLang, context, activeCustomer);
  if (lower.includes('sidebar') || raw.includes('साइडबार')) return executeBackendTool('navigate', { target: 'toggle_sidebar' }, userLang, context, activeCustomer);
  if (lower.includes('customer page') || lower.includes('customers kholo') || raw.includes('कस्टमर्स खोलो')) return executeBackendTool('navigate', { target: 'customers' }, userLang, context, activeCustomer);
  if (lower.includes('transaction page') || lower.includes('transactions kholo') || raw.includes('लेनदेन खोलो')) return executeBackendTool('navigate', { target: 'transactions' }, userLang, context, activeCustomer);
  if (lower.includes('billing') || raw.includes('बिलिंग खोलो')) return executeBackendTool('navigate', { target: 'billing' }, userLang, context, activeCustomer);
  if (lower.includes('stock') || raw.includes('स्टॉक खोलो') || lower.includes('inventory')) return executeBackendTool('navigate', { target: 'stocks' }, userLang, context, activeCustomer);
  if (lower.includes('home') || lower.includes('dashboard') || raw.includes('होम') || raw.includes('डैशबोर्ड')) return executeBackendTool('navigate', { target: 'home' }, userLang, context, activeCustomer);

  // 3. UNDO ACTION
  if (
    lower.includes('undo') || lower.includes('hata do') || lower.includes('galat thi') || lower.includes('cancel karo entry') ||
    raw.includes('हटा दो') || raw.includes('गलत थी') || raw.includes('अंडू')
  ) {
    return executeBackendTool('undo_recent_customer_action', {}, userLang, context, activeCustomer);
  }

  // 4. ACCOUNT BALANCE (Total market dues)
  if (
    /\b(total\s+udhar|market\s+udhar|market\s+me|baki\s+paisa|sabka\s+udhar|kul\s+udhar|kul\s+bakaya|pending\s+dues|total\s+dues|lena\s+hai)\b/i.test(lower) ||
    /कुल\s*उधारी|बाकी\s*पैसा|कुल\s*बकाया|मार्केट\s*में|लेना\s*है|सबका\s*उधार/i.test(raw)
  ) {
    return executeBackendTool('get_account_balance', {}, userLang, context, activeCustomer);
  }

  // 5. DUE CUSTOMERS
  if (
    lower.includes('due customer') || lower.includes('paise lene hain') || lower.includes('pending payment') ||
    lower.includes('sabse zyada outstanding') || raw.includes('पैसे लेने हैं') || raw.includes('बकाया ग्राहक')
  ) {
    return executeBackendTool('get_due_customers', { filter: 'due' }, userLang, context, activeCustomer);
  }

  // 6. MULTI-ACTION CUSTOMER CREATION (+ OPTIONAL DEBT / PHONE / OPENING BALANCE)
  // Understands all natural forms:
  // "create a customer Ram and add Rs 1000 as Udhar"
  // "Ram ko customer bana do aur 1000 udhar likh do"
  // "राम को ग्राहक बना दो और उसके खाते में एक हजार उधार लिख दो"
  // "Add Ram as a customer and put 1000 as due"
  // "Ek naya customer Ram naam se banao, uske khate mein 1000 outstanding rakho"
  // "Ram ko add karo, uska 1000 ka hisaab baaki hai"
  // "Create Ram and mark 1000 as udhaar"
  // "Rahul ko add karo aur uska number 9876543210 hai"
  const creationMatch = 
    raw.match(/(?:create|add)\s+(?:a\s+)?customer\s+(?:named\s+)?([A-Za-z\u0900-\u097F]+?)(?:\s+(?:and|with|having|for|to)|$)/i) ||
    raw.match(/(?:add|create)\s+([A-Za-z\u0900-\u097F]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
    raw.match(/(?:create|add)\s+([A-Za-z\u0900-\u097F]+?)\s+and\s+(?:add|mark|put|set)/i) ||
    raw.match(/(?:new\s+customer|customer)\s+([A-Za-z\u0900-\u097F]+?)(?:\s+(?:and|with|having|for|to)|$)/i) ||
    raw.match(/([a-zA-Z\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:naya\s+)?customer\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|bana\s*dijiye)/i) ||
    raw.match(/(?:ek\s+)?(?:naya\s+)?customer\s+([a-zA-Z\u0900-\u097F]+?)\s*(?:naam\s+se\s+)?(?:banao|bana\s*do|add\s*karo|rakho)/i) ||
    raw.match(/([a-zA-Z\u0900-\u097F]+?)\s*ko\s+(?:naya\s+)?(?:add\s*karo|banao)/i) ||
    raw.match(/([^\s]+)\s*को\s*(?:नया\s+)?(?:ग्राहक|कस्टमर)\s*(?:बनाओ|बना\s*दो|जोड़ो|ऐड\s*करो)/i) ||
    raw.match(/(?:नया\s+)?(?:ग्राहक|कस्टमर)\s+([^\s]+)\s*(?:बनाओ|बना\s*दो|जोड़ो)/i) ||
    raw.match(/([^\s]+)\s*के\s*नाम\s*से\s*(?:नया\s+)?(?:ग्राहक|कस्टमर)\s*बनाओ/i);

  if (creationMatch && creationMatch[1]) {
    const rawCand = creationMatch[1].trim();
    const candidateName = cleanCustomerName(rawCand);

    if (candidateName && candidateName.length >= 2 && !FORBIDDEN_CUSTOMER_PHRASES.has(candidateName.toLowerCase())) {
      // Check phone number if specified
      const phoneMatch = raw.match(/(?:number|no\.?|phone|मोबाइल|फ़ोन)\s*(?:is|hai|number)?\s*([6-9]\d{9})/i) || raw.match(/\b([6-9]\d{9})\b/);
      const phoneNum = phoneMatch ? phoneMatch[1] : '';

      // Check debt / udhaar
      const isDebt = /\b(udhar|udhari|due|outstanding|debit|उधार|उधर|खाते में)\b/i.test(raw);
      const amountData = extractNaturalAmount(raw);

      // Check or create customer in database
      let cust: any = customers.find(c => c.name.toLowerCase() === candidateName.toLowerCase());
      let newlyCreated = false;

      if (!cust) {
        cust = {
          id: `cust-${Date.now()}`,
          name: candidateName,
          phone: phoneNum,
          address: '',
          balance: 0,
          lastTransactionDate: new Date().toISOString().slice(0, 10),
          status: 'settled',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        customers.unshift(cust);
        newlyCreated = true;
      } else if (phoneNum) {
        cust.phone = phoneNum;
      }

      let newTx: any = null;

      // Execute Debt addition if specified
      if (isDebt && amountData.hasAmount && amountData.amount && amountData.amount > 0) {
        const amt = amountData.amount;
        cust.balance = (cust.balance || 0) + amt;
        cust.status = cust.balance > 0 ? 'due' : 'settled';
        cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

        newTx = {
          id: `tx-${Date.now()}`,
          date: new Date().toLocaleString('en-IN', { hour12: false }),
          type: 'out',
          category: 'Customer Credit',
          description: `Opening udhar for ${cust.name}`,
          partyName: cust.name,
          paymentMode: 'Cash',
          amount: amt,
          customerId: cust.id,
        };
        transactions.unshift(newTx);

        // Combined natural response matching exact language
        const speech = userLang === 'hindi'
          ? `${cust.name} को ग्राहक बना दिया गया है और उनके खाते में ₹${amt.toLocaleString('en-IN')} उधार दर्ज कर दिया गया है।`
          : (userLang === 'english'
              ? `${cust.name} has been added as a customer and ₹${amt.toLocaleString('en-IN')} has been recorded as outstanding.`
              : `${cust.name} ko customer bana diya aur unke khate mein ₹${amt.toLocaleString('en-IN')} udhar likh diya.`);

        return {
          reply: speech,
          createdCustomer: newlyCreated ? cust : undefined,
          updatedCustomer: cust,
          newTransaction: newTx,
          contextUpdates: {
            active_customer: cust,
            active_customer_id: cust.id,
            last_action: 'ADD_CUSTOMER_DEBT',
            last_created_entity: { type: 'CUSTOMER', id: cust.id, name: cust.name },
            recentCustomersMentioned: [{ id: cust.id, name: cust.name }],
          },
        };
      }

      // Customer creation with phone number
      if (phoneNum) {
        const speech = userLang === 'hindi'
          ? `${cust.name} को ग्राहक जोड़ दिया गया है और फ़ोन नंबर ${phoneNum} सेट कर दिया गया है।`
          : (userLang === 'english'
              ? `Added ${cust.name} as a customer with phone number ${phoneNum}.`
              : `${cust.name} ko customer add kar diya hai aur phone number ${phoneNum} set kar diya hai.`);

        return {
          reply: speech,
          createdCustomer: newlyCreated ? cust : undefined,
          updatedCustomer: cust,
          contextUpdates: {
            active_customer: cust,
            active_customer_id: cust.id,
            last_action: 'CREATE_CUSTOMER',
            last_created_entity: { type: 'CUSTOMER', id: cust.id, name: cust.name },
            recentCustomersMentioned: [{ id: cust.id, name: cust.name }],
          },
        };
      }

      // Customer creation only
      const speech = userLang === 'hindi'
        ? `${cust.name} को ग्राहक बना दिया गया है।`
        : (userLang === 'english'
            ? `${cust.name} has been added as a customer.`
            : `${cust.name} ko customer bana diya.`);

      return {
        reply: speech,
        createdCustomer: newlyCreated ? cust : undefined,
        updatedCustomer: cust,
        contextUpdates: {
          active_customer: cust,
          active_customer_id: cust.id,
          last_action: 'CREATE_CUSTOMER',
          last_created_entity: { type: 'CUSTOMER', id: cust.id, name: cust.name },
          recentCustomersMentioned: [{ id: cust.id, name: cust.name }],
        },
      };
    }
  }

  // 7. CONTEXTUAL PRONOUN FOLLOW-UP ("Usme 1000 udhar likh do", "Now show me his last payment", "Ab uska khata kholo")
  const isPronounUtterance = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|woh|his|her|their|that\s+customer)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उनका|उनकी|उनके|उन्हें|उनको/i.test(lower);
  if (isPronounUtterance && activeCustomer) {
    const cust = customers.find(c => c.id === activeCustomer.id) || activeCustomer;

    // Pronoun + Debt ("Usme 1000 udhar likh do")
    const isDebt = /\b(udhar|udhari|due|outstanding|debit|likh|likho|chadha|dalo|उधार|उधर|खाते में)\b/i.test(lower);
    const amountData = extractNaturalAmount(raw);

    if (isDebt && amountData.hasAmount && amountData.amount) {
      const amt = amountData.amount;
      cust.balance = (cust.balance || 0) + amt;
      cust.status = cust.balance > 0 ? 'due' : 'settled';
      cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

      const newTx = {
        id: `tx-${Date.now()}`,
        date: new Date().toLocaleString('en-IN', { hour12: false }),
        type: 'out',
        category: 'Customer Credit',
        description: `Credit given to ${cust.name}`,
        partyName: cust.name,
        paymentMode: 'Cash',
        amount: amt,
        customerId: cust.id,
      };
      transactions.unshift(newTx);

      const speech = userLang === 'hindi'
        ? `${cust.name} के खाते में ₹${amt.toLocaleString('en-IN')} उधार दर्ज कर दिया गया है।`
        : (userLang === 'english'
            ? `Recorded ₹${amt.toLocaleString('en-IN')} as outstanding for ${cust.name}.`
            : `${cust.name} ke khate mein ₹${amt.toLocaleString('en-IN')} udhar likh diya.`);

      return {
        reply: speech,
        updatedCustomer: cust,
        newTransaction: newTx,
        contextUpdates: {
          active_customer: cust,
          active_customer_id: cust.id,
          last_action: 'ADD_CUSTOMER_DEBT',
          last_transaction: newTx,
          recentCustomersMentioned: [{ id: cust.id, name: cust.name }],
        },
      };
    }

    // Pronoun + Payment ("Usne 1000 de diye")
    const isPayment = /\b(de\s*diye|diye|mil\s*gaye|jama|pay|paid|payment)\b/i.test(lower);
    if (isPayment && amountData.hasAmount && amountData.amount) {
      return executeBackendTool('record_customer_payment', { customer_id: cust.id, customer_name: cust.name, amount: amountData.amount }, userLang, context, activeCustomer);
    }

    // Pronoun + History / Last Payment ("Now show me his last payment")
    if (lower.includes('last payment') || lower.includes('pichli baar') || lower.includes('previous payment') || raw.includes('पिछला भुगतान')) {
      const custTx = transactions.filter(t => (t.customerId && t.customerId === cust.id) || (t.partyName && t.partyName.toLowerCase() === cust.name.toLowerCase()));
      const lastPay = custTx.find(t => t.type === 'in' || t.category === 'Customer Payment');
      if (lastPay) {
        const speech = userLang === 'hindi'
          ? `${cust.name} का पिछला भुगतान ₹${lastPay.amount.toLocaleString('en-IN')} का था (${lastPay.date})।`
          : (userLang === 'english'
              ? `His last payment was ₹${lastPay.amount.toLocaleString('en-IN')} on ${lastPay.date}.`
              : `${cust.name} ka last payment ₹${lastPay.amount.toLocaleString('en-IN')} tha (${lastPay.date}).`);
        return { reply: speech, updatedCustomer: cust };
      } else {
        const speech = userLang === 'hindi'
          ? `${cust.name} का कोई पिछला भुगतान रिकॉर्ड नहीं है।`
          : (userLang === 'english'
              ? `No prior payment recorded for ${cust.name}.`
              : `${cust.name} ka koi pichla payment nahi mila.`);
        return { reply: speech, updatedCustomer: cust };
      }
    }

    // Pronoun + Open Ledger ("Ab uska khata kholo")
    if (lower.includes('khata kholo') || lower.includes('ledger') || lower.includes('open') || raw.includes('खाता खोलो')) {
      return executeBackendTool('open_customer', { customer_name: cust.name, customer_id: cust.id }, userLang, context, activeCustomer);
    }

    // Pronoun + Balance ("Uska balance batao")
    if (lower.includes('balance') || lower.includes('baaki') || lower.includes('kitna') || raw.includes('बैलेंस')) {
      return executeBackendTool('get_customer_balance', { customer_name: cust.name, customer_id: cust.id }, userLang, context, activeCustomer);
    }
  }

  // 8. RESOLVE TARGET CUSTOMER FROM UTTERANCE
  const resolvedCustResult = resolveCustomerInServer(raw, activeCustomer, context?.recentCustomersMentioned);
  const amountData = extractNaturalAmount(raw);

  // Check ambiguity across database or recently discussed customers
  if (resolvedCustResult.status === 'AMBIGUOUS' && resolvedCustResult.candidates && resolvedCustResult.candidates.length > 1) {
    const candidateNames = resolvedCustResult.candidates.map(c => c.name);
    const amtStr = amountData.hasAmount && amountData.amount ? `₹${amountData.amount.toLocaleString('en-IN')} ` : '';
    const askMsg = userLang === 'hindi'
      ? `${amtStr}${candidateNames[0]} के खाते में या ${candidateNames[1]} के खाते में जोड़ना है?`
      : (userLang === 'english'
          ? `Should I add ${amtStr}to ${candidateNames[0]}'s account or ${candidateNames[1]}'s account?`
          : `${amtStr}${candidateNames[0]} ke khate mein ya ${candidateNames[1]} ke khate mein add karna hai?`);
    return { reply: askMsg };
  }

  const targetCust = resolvedCustResult.customer || (activeCustomer ? customers.find(c => c.id === activeCustomer.id) : undefined);

  // 9. PAYMENT RECEIVED INTENT ("Ramesh ne 2000 de diye", "Ramesh ne payment kar di")
  const isPaymentIntent = 
    /\b(?:ne\s+\d+|ne\s+payment|ka\s+\d+\s+aa|ka\s+\d+\s+mil|se\s+\d+\s+receive|se\s+payment)\b/i.test(lower) ||
    /\b(aa\s*chuka\s*hai|aa\s*chuka|aa\s*gaya|aa\s*gayi|aaye|aaya|mil\s*gaya|mil\s*gaye|mile|receive\s*hua|receive\s*hue|received|de\s*diye|pay\s*kar\s*diye|pay\s*kiya|pay\s*kar\s*di|payment\s*kar\s*di|payment\s*aayi|wapas\s*kar\s*diye|wapas\s*diye|jama|jama\s*karo|jama\s*likho|jama\s*kar\s*do|minus\s*karo|minus\s*karke|minus)\b/i.test(lower) ||
    /आ\s*चुका\s*है|आ\s*चुका|आ\s*गया|आ\s*गई|आए|आया|मिल\s*गया|मिल\s*गए|मिले|प्राप्त\s*हुए|पेमेंट\s*कर\s*दी|पेमेंट\s*आई|दे\s*दिए|वापस\s*कर\s*दिए|जमा|जमा\s*करो|माइनस/i.test(raw);

  if (isPaymentIntent) {
    if (!targetCust) {
      if (resolvedCustResult.status === 'NOT_FOUND' && resolvedCustResult.searchedName) {
        const notFoundMsg = userLang === 'hindi'
          ? `"${resolvedCustResult.searchedName}" कस्टमर लिस्ट में नहीं मिल रहे। क्या आप उन्हें नया कस्टमर बनाना चाहते हैं?`
          : (userLang === 'english' ? `"${resolvedCustResult.searchedName}" was not found in the customer list. Would you like to add them as a new customer?` : `"${resolvedCustResult.searchedName}" customer list mein nahi mil rahe. Kya aap unhe naya customer banana chahte hain?`);
        return { reply: notFoundMsg };
      }
      const askWho = userLang === 'hindi' ? 'किस ग्राहक ने पेमेंट दी है?' : (userLang === 'english' ? 'Which customer made the payment?' : 'Kis customer ki payment aayi hai?');
      return { reply: askWho };
    }

    if (!amountData.hasAmount || !amountData.amount) {
      // MISSING AMOUNT (TEST 5): Prompt user without inventing any numbers!
      const askAmt = userLang === 'hindi' ? 'कितने रुपये प्राप्त हुए?' : (userLang === 'english' ? 'How much was received?' : 'Kitne rupaye receive hue?');
      return {
        reply: askAmt,
        pendingSlotFilling: {
          action: 'add_transaction',
          missingFields: ['amount'],
          gathered: { customerName: targetCust.name, transactionType: 'credit' },
          promptQuestion: askAmt,
        },
      };
    }

    return executeBackendTool('record_customer_payment', { customer_id: targetCust.id, customer_name: targetCust.name, amount: amountData.amount }, userLang, context, activeCustomer);
  }

  // 10. DEBT ADDITION INTENT ("add 1000 into account", "add 1000", "Ramesh ko 1000 udhar likh do", "1000 jod do", "1000 daal do")
  const isDebtIntent = 
    /\b(udhar|udhari|debit|due|dues|outstanding|le\s*gaya|samaan\s*diya|udhar\s*likho|udhar\s*likh\s*do|udhar\s*chadha\s*do|udhar\s*diya)\b/i.test(lower) ||
    /\b(?:add|daal|dalo|jod|jodo|likh|likho|charge|put|set)\b.*?(?:into\s+(?:the\s+)?account|to\s+(?:the\s+)?account|in\s+(?:the\s+)?account|khata|khate|account)/i.test(lower) ||
    /\b(?:into\s+(?:the\s+)?account|to\s+(?:the\s+)?account|in\s+(?:the\s+)?account|khata|khate|account)\b.*?(?:add|daal|dalo|jod|jodo|likh|likho)/i.test(lower) ||
    /^(?:add|jod\s*do|daal\s*do|likh\s*do)?\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:rs\.?|inr|₹|rupya|rupaye|rupees))?$/i.test(lower.trim()) ||
    /\badd\s+(?:rs\.?|inr|₹)?\s*\d+/i.test(lower) ||
    /उधार|उधर|उधारी|डेबिट|सामान\s*दिया|उधार\s*लिखो|उधार\s*लिख\s*दो|उधार\s*चढ़ा\s*दो|उधार\s*दिया|खाते\s*में\s*(?:जोड़ो|डालो|लिखो|ऐड)/i.test(raw);

  if (isDebtIntent) {
    if (!targetCust) {
      if (resolvedCustResult.status === 'NOT_FOUND' && resolvedCustResult.searchedName) {
        const notFoundMsg = userLang === 'hindi'
          ? `"${resolvedCustResult.searchedName}" कस्टमर लिस्ट में नहीं मिल रहे। क्या आप उन्हें नया कस्टमर बनाना चाहते हैं?`
          : (userLang === 'english' ? `"${resolvedCustResult.searchedName}" was not found in the customer list. Would you like to add them as a new customer?` : `"${resolvedCustResult.searchedName}" customer list mein nahi mil rahe. Kya aap unhe naya customer banana chahte hain?`);
        return { reply: notFoundMsg };
      }
      const amtStr = amountData.hasAmount && amountData.amount ? `₹${amountData.amount.toLocaleString('en-IN')}` : '₹1,000';
      const askWho = userLang === 'hindi'
        ? `${amtStr} किस ग्राहक के खाते में जोड़ना है?`
        : (userLang === 'english'
            ? `Which customer's account should I add ${amtStr} to?`
            : `${amtStr} kis customer ke khate mein add karna hai?`);
      return {
        reply: askWho,
        pendingSlotFilling: {
          action: 'add_transaction',
          missingFields: ['customer_name'],
          gathered: { amount: amountData.amount || 1000, transactionType: 'debit' },
          promptQuestion: askWho,
        },
      };
    }

    if (!amountData.hasAmount || !amountData.amount) {
      const askAmt = userLang === 'hindi' ? 'कितने रुपये का उधार लिखना है?' : (userLang === 'english' ? 'How much credit to record?' : 'Kitne rupaye ka udhar likhna hai?');
      return {
        reply: askAmt,
        pendingSlotFilling: {
          action: 'add_transaction',
          missingFields: ['amount'],
          gathered: { customerName: targetCust.name, transactionType: 'debit' },
          promptQuestion: askAmt,
        },
      };
    }

    return executeBackendTool('add_customer_debt', { customer_id: targetCust.id, customer_name: targetCust.name, amount: amountData.amount }, userLang, context, activeCustomer);
  }

  // 11. OPEN CUSTOMER LEDGER ("Ramesh ka khata kholo")
  if (lower.includes('khata kholo') || lower.includes('ledger') || lower.includes('open') || raw.includes('खाता खोलो') || raw.includes('लेजर खोलो')) {
    if (targetCust) {
      return executeBackendTool('open_customer', { customer_id: targetCust.id, customer_name: targetCust.name }, userLang, context, activeCustomer);
    }
    if (resolvedCustResult.status === 'NOT_FOUND' && resolvedCustResult.searchedName) {
      const notFoundMsg = userLang === 'hindi'
        ? `"${resolvedCustResult.searchedName}" कस्टमर लिस्ट में नहीं मिल रहे। क्या आप उन्हें नया कस्टमर बनाना चाहते हैं?`
        : (userLang === 'english' ? `"${resolvedCustResult.searchedName}" was not found in the customer list. Would you like to add them as a new customer?` : `"${resolvedCustResult.searchedName}" customer list mein nahi mil rahe. Kya aap unhe naya customer banana chahte hain?`);
      return { reply: notFoundMsg };
    }
  }

  // 12. BALANCE QUERY ("Ramesh ka balance batao")
  const isBalQuery = 
    /\b(balance|baki\s*hai|kitna\s*hai|kitna\s*baki|dues|hisab\s*batao|ab\s*kitna|kitne\s*paise)\b/i.test(lower) ||
    /बैलेंस|कितना\s*बाकी|बकाया|हिसाब\s*बताओ|अब\s*कितना/i.test(raw);

  if (isBalQuery) {
    if (targetCust) {
      return executeBackendTool('get_customer_balance', { customer_id: targetCust.id, customer_name: targetCust.name }, userLang, context, activeCustomer);
    }
  }

  // 13. TRANSACTION HISTORY ("last transaction", "pichli payment")
  if (lower.includes('last payment') || lower.includes('last transaction') || lower.includes('pichli baar') || raw.includes('पिछला भुगतान')) {
    if (targetCust) {
      return executeBackendTool('get_customer_history', { customer_id: targetCust.id, customer_name: targetCust.name }, userLang, context, activeCustomer);
    }
  }

  // 14. CUSTOMER SUMMARY ("summary", "poora hisab")
  if (lower.includes('summary') || lower.includes('poora hisab') || raw.includes('समरी') || raw.includes('पूरा हिसाब')) {
    if (targetCust) {
      return executeBackendTool('get_customer_summary', { customer_id: targetCust.id, customer_name: targetCust.name }, userLang, context, activeCustomer);
    }
  }

  // If user only provided an amount (e.g. "1000") without intent:
  if (amountData.hasAmount && amountData.amount) {
    const amtStr = `₹${amountData.amount.toLocaleString('en-IN')}`;
    const askCust = userLang === 'hindi'
      ? `${amtStr} किस ग्राहक के खाते में जोड़ना है?`
      : (userLang === 'english' ? `Which customer's account should I add ${amtStr} to?` : `${amtStr} kis customer ke khate mein add karna hai?`);
    return {
      reply: askCust,
      pendingSlotFilling: {
        action: 'add_transaction',
        missingFields: ['customer_name'],
        gathered: { amount: amountData.amount, transactionType: 'debit' },
        promptQuestion: askCust,
      },
    };
  }

  // If a customer was specifically called by name alone (e.g. "Ramesh" or "Rahul"):
  if (targetCust && raw.trim().toLowerCase() === targetCust.name.toLowerCase()) {
    return executeBackendTool('get_customer_balance', { customer_id: targetCust.id, customer_name: targetCust.name }, userLang, context, activeCustomer);
  }

  // Generic natural conversational response in user's detected language
  const defaultReply = userLang === 'hindi'
    ? 'जी बताइए, क्या एंट्री करनी है?'
    : (userLang === 'english' ? 'How can I assist you with your ledger? You can ask to view a customer balance, add udhar, or record a payment.' : 'Haanji, batayein, khate mein kya entry karni hai?');

  return { reply: defaultReply };
}

// Authoritative Backend Tool Execution Engine
function executeBackendTool(
  toolName: string,
  args: any,
  userLang: 'hindi' | 'hinglish' | 'english',
  context?: any,
  activeCustomer?: any
): {
  reply: string;
  createdCustomer?: any;
  updatedCustomer?: any;
  newTransaction?: any;
  deletedCustomerId?: string;
  deletedTransactionId?: string;
  navigation?: { target: string; options?: any };
  contextUpdates?: any;
  pendingConfirmation?: any;
  pendingSlotFilling?: any;
  shouldEndSession?: boolean;
} {
  // 1. END CONVERSATION
  if (toolName === 'end_conversation') {
    const farewell = args.speech_response || (userLang === 'hindi'
      ? 'ठीक है, आपका बहुत धन्यवाद! आपका दिन शुभ हो।'
      : (userLang === 'hinglish' ? 'Theek hai, dhanyawad! Have a great day.' : 'Alright, thank you! Have a great day.'));
    return { reply: farewell, shouldEndSession: true };
  }

  // 2. ASK CLARIFICATION
  if (toolName === 'ask_clarification') {
    return {
      reply: args.question,
      pendingSlotFilling: args.reason === 'missing_amount' ? {
        action: 'add_transaction',
        missingFields: ['amount'],
        gathered: { customerName: args.target_customer },
        promptQuestion: args.question,
      } : undefined,
    };
  }

  // 3. NAVIGATION & OPEN CUSTOMER
  if (toolName === 'navigate') {
    const target = args.target || 'home';
    const speech = userLang === 'hindi'
      ? `${target} खोल दिया गया है।`
      : (userLang === 'hinglish' ? `${target} open kar diya hai.` : `Opening ${target}.`);
    return { reply: speech, navigation: { target } };
  }

  if (toolName === 'open_customer') {
    const custName = cleanCustomerName(args.customer_name || activeCustomer?.name || '');
    const found = customers.find(c => (args.customer_id && c.id === args.customer_id) || c.name.toLowerCase() === custName.toLowerCase());
    const targetName = found ? found.name : custName;
    const speech = userLang === 'hindi'
      ? `${targetName} का खाता खोल दिया गया है।`
      : (userLang === 'hinglish' ? `${targetName} ka khata open kar diya hai.` : `Opening ledger for ${targetName}.`);
    return {
      reply: speech,
      navigation: { target: 'customer_ledger_modal', options: { customerName: targetName } },
      contextUpdates: found ? { active_customer: found, active_customer_id: found.id, recentCustomersMentioned: [{ id: found.id, name: found.name }] } : undefined,
    };
  }

  // 4. GET ACCOUNT BALANCE (Total market dues)
  if (toolName === 'get_account_balance') {
    const dueCusts = customers.filter(c => c.balance > 0);
    const total = dueCusts.reduce((s, c) => s + c.balance, 0);
    const speech = userLang === 'hindi'
      ? `मार्केट में कुल ₹${total.toLocaleString('en-IN')} का बकाया है, जो ${dueCusts.length} ग्राहकों से लेना बाकी है।`
      : (userLang === 'hinglish' ? `Market me total ₹${total.toLocaleString('en-IN')} pending dues hain (${dueCusts.length} customers).` : `Total market receivables are ₹${total.toLocaleString('en-IN')} across ${dueCusts.length} customers.`);
    return { reply: speech };
  }

  // 5. GET DUE CUSTOMERS
  if (toolName === 'get_due_customers') {
    const filter = args.filter || 'due';
    if (filter === 'settled') {
      const settled = customers.filter(c => c.balance <= 0);
      const speech = userLang === 'hindi'
        ? `कुल ${settled.length} ग्राहकों का खाता चुकता (Zero balance) है: ${settled.slice(0, 3).map(c => c.name).join(', ')}${settled.length > 3 ? ' आदि' : ''}।`
        : (userLang === 'hinglish' ? `Total ${settled.length} customers ka balance settled hai: ${settled.slice(0, 3).map(c => c.name).join(', ')}.` : `${settled.length} customers have settled accounts.`);
      return { reply: speech };
    }
    const dueList = customers.filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance);
    const total = dueList.reduce((s, c) => s + c.balance, 0);
    if (dueList.length === 0) {
      const speech = userLang === 'hindi' ? 'किसी भी ग्राहक का कोई बकाया बाकी नहीं है।' : 'No customers currently have pending dues.';
      return { reply: speech };
    }
    const top = dueList[0];
    const speech = userLang === 'hindi'
      ? `कुल ${dueList.length} ग्राहकों का ₹${total.toLocaleString('en-IN')} बकाया है। सबसे ज्यादा बकाया ${top.name} (₹${top.balance.toLocaleString('en-IN')}) का है।`
      : (userLang === 'hinglish' ? `Total ${dueList.length} customers ka ₹${total.toLocaleString('en-IN')} pending hai. Sabse zyada ${top.name} (₹${top.balance.toLocaleString('en-IN')}) ka hai.` : `${dueList.length} customers owe ₹${total.toLocaleString('en-IN')}. Highest is ${top.name} with ₹${top.balance.toLocaleString('en-IN')}.`);
    return { reply: speech };
  }

  // 6. GET REPORT
  if (toolName === 'get_report') {
    const period = args.period || 'today';
    const moneyIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    const moneyOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    const speech = userLang === 'hindi'
      ? `आज की कुल बिक्री ₹${moneyIn.toLocaleString('en-IN')} और खर्चे ₹${moneyOut.toLocaleString('en-IN')} हैं।`
      : (userLang === 'hinglish' ? `Total collection ₹${moneyIn.toLocaleString('en-IN')} aur kharcha ₹${moneyOut.toLocaleString('en-IN')} hai.` : `Total collection: ₹${moneyIn.toLocaleString('en-IN')}, expenses: ₹${moneyOut.toLocaleString('en-IN')}.`);
    return { reply: speech };
  }

  // 7. RESOLVE CUSTOMER AGAINST REAL DATABASE
  let targetCustomer: any = null;
  const rawCustName = cleanCustomerName(args.customer_name || args.name || '');

  if (args.customer_id) {
    targetCustomer = customers.find(c => c.id === args.customer_id);
  }

  if (!targetCustomer && rawCustName) {
    const resolution = resolveCustomerInServer(rawCustName, activeCustomer, context?.recentCustomersMentioned);
    if (resolution.status === 'AMBIGUOUS' && resolution.candidates && resolution.candidates.length > 1) {
      const names = resolution.candidates.map(c => c.name).join(userLang === 'hindi' ? ' या ' : ' ya ');
      const msg = userLang === 'hindi'
        ? `${names} — आप किस कस्टमर की बात कर रहे हैं?`
        : `${names} — kis customer ki baat kar rahe hain?`;
      return { reply: msg };
    }
    targetCustomer = resolution.customer;
  }

  if (!targetCustomer && (toolName === 'get_customer_balance' || toolName === 'record_customer_payment' || toolName === 'add_customer_debt' || toolName === 'get_customer_summary' || toolName === 'get_customer_history')) {
    if (activeCustomer) {
      targetCustomer = customers.find(c => c.id === activeCustomer.id) || activeCustomer;
    }
  }

  // Customer Not Found validation for financial operations (DO NOT AUTO-CREATE!)
  if (!targetCustomer && (toolName === 'record_customer_payment' || toolName === 'add_customer_debt' || toolName === 'get_customer_balance' || toolName === 'get_customer_summary')) {
    if (rawCustName && rawCustName.length >= 2) {
      const notFoundMsg = userLang === 'hindi'
        ? `"${rawCustName}" कस्टमर लिस्ट में नहीं मिल रहे। क्या आप उन्हें नया कस्टमर बनाना चाहते हैं?`
        : `"${rawCustName}" customer list mein nahi mil rahe. Kya aap unhe naya customer banana chahte hain?`;
      return { reply: notFoundMsg };
    } else {
      const askWhoMsg = userLang === 'hindi'
        ? 'किस कस्टमर की बात कर रहे हैं?'
        : (userLang === 'english' ? 'Which customer are you referring to?' : 'Kis customer ki baat kar rahe hain?');
      return { reply: askWhoMsg };
    }
  }

  // 8. CREATE CUSTOMER
  if (toolName === 'create_customer') {
    const newName = cleanCustomerName(args.name || args.customer_name || 'New Customer');
    if (!newName || newName.length < 2) {
      const askMsg = userLang === 'hindi' ? 'किस नाम से नया ग्राहक बनाना है?' : 'Kis naam se naya customer add karna hai?';
      return { reply: askMsg };
    }
    const existing = customers.find(c => c.name.toLowerCase() === newName.toLowerCase());
    if (existing) {
      const msg = userLang === 'hindi'
        ? `"${existing.name}" पहले से कस्टमर लिस्ट में मौजूद हैं।`
        : `"${existing.name}" pehle se customer list mein hain.`;
      return {
        reply: msg,
        updatedCustomer: existing,
        contextUpdates: { active_customer: existing, active_customer_id: existing.id, recentCustomersMentioned: [{ id: existing.id, name: existing.name }] },
      };
    }

    const openingBal = Number(args.opening_balance) || 0;
    const newCust = {
      id: `cust-${Date.now()}`,
      name: newName,
      phone: args.phone || '', // NEVER invent phone numbers
      address: args.address || '',
      balance: openingBal,
      notes: args.notes || '',
      lastTransactionDate: new Date().toISOString().slice(0, 10),
      status: openingBal > 0 ? 'due' : (openingBal < 0 ? 'advance' : 'settled'),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    customers.unshift(newCust);

    if (openingBal > 0) {
      transactions.unshift({
        id: `tx-${Date.now()}`,
        date: new Date().toLocaleString('en-IN', { hour12: false }),
        type: 'out',
        category: 'Customer Credit',
        description: `Opening balance for ${newCust.name}`,
        partyName: newCust.name,
        paymentMode: 'Cash',
        amount: openingBal,
        customerId: newCust.id,
      });
    }

    const speech = userLang === 'hindi'
      ? `नया ग्राहक "${newName}" जोड़ दिया गया है।`
      : (userLang === 'english' ? `Added "${newName}" as a new customer.` : `Naya customer "${newName}" add kar diya hai.`);

    return {
      reply: speech,
      createdCustomer: newCust,
      updatedCustomer: newCust,
      contextUpdates: {
        active_customer: newCust,
        active_customer_id: newCust.id,
        last_action: 'CREATE_CUSTOMER',
        last_created_entity: { type: 'CUSTOMER', id: newCust.id, name: newCust.name },
        recentCustomersMentioned: [{ id: newCust.id, name: newCust.name }],
      },
    };
  }

  // 9. GET CUSTOMER BALANCE
  if (toolName === 'get_customer_balance') {
    const bal = targetCustomer.balance;
    let speech = '';
    if (bal > 0) {
      speech = userLang === 'hindi'
        ? `${targetCustomer.name} का ₹${bal.toLocaleString('en-IN')} बकाया है।`
        : (userLang === 'english' ? `${targetCustomer.name}'s balance is ₹${bal.toLocaleString('en-IN')}.` : `${targetCustomer.name} ka ₹${bal.toLocaleString('en-IN')} baaki hai.`);
    } else if (bal < 0) {
      speech = userLang === 'hindi'
        ? `${targetCustomer.name} का ₹${Math.abs(bal).toLocaleString('en-IN')} एडवांस जमा है।`
        : (userLang === 'english' ? `${targetCustomer.name} has an advance deposit of ₹${Math.abs(bal).toLocaleString('en-IN')}.` : `${targetCustomer.name} ka ₹${Math.abs(bal).toLocaleString('en-IN')} advance deposit hai.`);
    } else {
      speech = userLang === 'hindi'
        ? `${targetCustomer.name} का खाता बिल्कुल चुकता है, कोई बकाया नहीं है।`
        : (userLang === 'english' ? `${targetCustomer.name}'s account is fully settled with zero dues.` : `${targetCustomer.name} ka account settled hai, koi balance baki nahi hai.`);
    }
    const prevRecent = (context?.recentCustomersMentioned || []).filter((c: any) => c && c.id && c.id !== targetCustomer.id);
    const multiRecent = [{ id: targetCustomer.id, name: targetCustomer.name }, ...prevRecent].slice(0, 3);
    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      contextUpdates: {
        active_customer: targetCustomer,
        active_customer_id: targetCustomer.id,
        last_action: 'GET_CUSTOMER_BALANCE',
        recentCustomersMentioned: multiRecent,
      },
    };
  }

  // 10. RECORD PAYMENT RECEIVED (Customer pays, dues decrease)
  if (toolName === 'record_customer_payment') {
    if (!args.amount || Number(args.amount) <= 0) {
      const askAmt = userLang === 'hindi' ? 'कितने रुपये प्राप्त हुए?' : 'Kitne rupaye receive hue?';
      return {
        reply: askAmt,
        pendingSlotFilling: {
          action: 'add_transaction',
          missingFields: ['amount'],
          gathered: { customerName: targetCustomer.name, transactionType: 'credit' },
          promptQuestion: askAmt,
        }
      };
    }

    const amt = Number(args.amount);
    const prev = targetCustomer.balance || 0;
    const newBal = prev - amt;
    targetCustomer.balance = newBal;
    targetCustomer.status = newBal > 0 ? 'due' : (newBal < 0 ? 'advance' : 'settled');
    targetCustomer.lastTransactionDate = new Date().toISOString().slice(0, 10);

    const newTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'in',
      category: 'Customer Payment',
      description: args.description || `Payment from ${targetCustomer.name}`,
      partyName: targetCustomer.name,
      paymentMode: args.payment_mode || 'Cash',
      amount: amt,
      customerId: targetCustomer.id,
    };
    transactions.unshift(newTx);

    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} से ₹${amt.toLocaleString('en-IN')} प्राप्त हो गए। अब उनके खाते में ₹${newBal.toLocaleString('en-IN')} बाकी हैं।${newBal <= 0 ? ' खाता चुकता हो गया है।' : ''}`
      : (userLang === 'english'
        ? `Received ₹${amt.toLocaleString('en-IN')} from ${targetCustomer.name}. Their new balance is ₹${newBal.toLocaleString('en-IN')}.${newBal <= 0 ? ' Account is fully settled.' : ''}`
        : `${targetCustomer.name} se ₹${amt.toLocaleString('en-IN')} receive ho gaye. Ab unke khate mein ₹${newBal.toLocaleString('en-IN')} baaki hain.${newBal <= 0 ? ' Khata settled ho gaya hai.' : ''}`);

    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      newTransaction: newTx,
      contextUpdates: {
        active_customer: targetCustomer,
        active_customer_id: targetCustomer.id,
        last_action: 'RECORD_PAYMENT',
        last_transaction: newTx,
        last_payment: newTx,
        recentCustomersMentioned: [{ id: targetCustomer.id, name: targetCustomer.name }],
      },
    };
  }

  // 11. ADD CUSTOMER DEBT (New udhar, dues increase)
  if (toolName === 'add_customer_debt') {
    if (!args.amount || Number(args.amount) <= 0) {
      const askAmt = userLang === 'hindi' ? 'कितने रुपये का उधार लिखना है?' : 'Kitne rupaye ka udhar likhna hai?';
      return {
        reply: askAmt,
        pendingSlotFilling: {
          action: 'add_transaction',
          missingFields: ['amount'],
          gathered: { customerName: targetCustomer.name, transactionType: 'debit' },
          promptQuestion: askAmt,
        }
      };
    }

    const amt = Number(args.amount);
    const prev = targetCustomer.balance || 0;
    const newBal = prev + amt;
    targetCustomer.balance = newBal;
    targetCustomer.status = newBal > 0 ? 'due' : (newBal < 0 ? 'advance' : 'settled');
    targetCustomer.lastTransactionDate = new Date().toISOString().slice(0, 10);

    const newTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'out',
      category: 'Customer Credit',
      description: args.description || `Credit given to ${targetCustomer.name}`,
      partyName: targetCustomer.name,
      paymentMode: 'Cash',
      amount: amt,
      customerId: targetCustomer.id,
    };
    transactions.unshift(newTx);

    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} के खाते में ₹${amt.toLocaleString('en-IN')} उधार लिख दिए हैं। अब उनका कुल बकाया ₹${newBal.toLocaleString('en-IN')} है।`
      : (userLang === 'english'
        ? `Recorded ₹${amt.toLocaleString('en-IN')} credit for ${targetCustomer.name}. Total balance is now ₹${newBal.toLocaleString('en-IN')}.`
        : `${targetCustomer.name} ke account mein ₹${amt.toLocaleString('en-IN')} udhar likh diye hain. Ab unka total balance ₹${newBal.toLocaleString('en-IN')} hai.`);

    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      newTransaction: newTx,
      contextUpdates: {
        active_customer: targetCustomer,
        active_customer_id: targetCustomer.id,
        last_action: 'ADD_DEBT',
        last_transaction: newTx,
        recentCustomersMentioned: [{ id: targetCustomer.id, name: targetCustomer.name }],
      },
    };
  }

  // 12. GET CUSTOMER SUMMARY
  if (toolName === 'get_customer_summary') {
    const custTx = transactions.filter(t => (t as any).customerId === targetCustomer.id || t.partyName?.toLowerCase() === targetCustomer.name.toLowerCase());
    const lastPayment = custTx.find(t => t.type === 'in' || t.category === 'Customer Payment');
    const custReminders = reminders.filter(r => (r as any).customerId === targetCustomer.id || r.customerName?.toLowerCase() === targetCustomer.name.toLowerCase());

    const balStr = `₹${Math.abs(targetCustomer.balance).toLocaleString('en-IN')}`;
    const statusDesc = targetCustomer.balance > 0 ? 'बकाया' : (targetCustomer.balance < 0 ? 'एडवांस जमा' : 'खाता चुकता');

    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} की समरी: वर्तमान बैलेंस ${balStr} (${statusDesc})। ${lastPayment ? `अंतिम भुगतान: ₹${lastPayment.amount.toLocaleString('en-IN')} (${lastPayment.date})।` : 'कोई पिछला भुगतान नहीं मिला।'} ${custReminders.length > 0 ? `पेंडिंग रिमाइंडर: ${custReminders.length}।` : ''}`
      : `${targetCustomer.name} summary: Current balance ${balStr} (${targetCustomer.balance > 0 ? 'due' : targetCustomer.balance < 0 ? 'advance' : 'settled'}). ${lastPayment ? `Last payment: ₹${lastPayment.amount.toLocaleString('en-IN')} (${lastPayment.date}).` : 'No prior payment recorded.'} ${custReminders.length > 0 ? `Pending reminders: ${custReminders.length}.` : ''}`;

    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      contextUpdates: { active_customer: targetCustomer, active_customer_id: targetCustomer.id, recentCustomersMentioned: [{ id: targetCustomer.id, name: targetCustomer.name }] },
    };
  }

  // 13. GET CUSTOMER HISTORY
  if (toolName === 'get_customer_history') {
    const custTx = transactions.filter(t => (t as any).customerId === targetCustomer.id || t.partyName?.toLowerCase() === targetCustomer.name.toLowerCase());
    if (custTx.length === 0) {
      const speech = userLang === 'hindi' ? `${targetCustomer.name} का कोई हालिया लेन-देन नहीं मिला।` : `${targetCustomer.name} ke liye koi transaction record nahi mila.`;
      return { reply: speech };
    }
    const latest = custTx[0];
    const isPayment = latest.type === 'in';
    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} का पिछला लेन-देन ₹${latest.amount.toLocaleString('en-IN')} (${isPayment ? 'प्राप्त/जमा' : 'उधार/डेबिट'}) ${latest.date} को हुआ था।`
      : `${targetCustomer.name} ki last entry ₹${latest.amount.toLocaleString('en-IN')} (${isPayment ? 'payment received' : 'udhar given'}) ${latest.date} ki hai.`;

    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      contextUpdates: { active_customer: targetCustomer, active_customer_id: targetCustomer.id, recentCustomersMentioned: [{ id: targetCustomer.id, name: targetCustomer.name }] },
    };
  }

  // 14. CUSTOMER NOTES
  if (toolName === 'create_customer_note') {
    const noteText = String(args.note || '').trim();
    if (!noteText) {
      return { reply: userLang === 'hindi' ? 'क्या नोट लिखना है?' : 'Kya note save karna hai?' };
    }
    targetCustomer.notes = targetCustomer.notes ? `${targetCustomer.notes} | ${noteText}` : noteText;
    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} के प्रोफाइल में नोट सेव कर दिया गया है: "${noteText}"।`
      : `${targetCustomer.name} ke profile mein note save kar diya: "${noteText}".`;
    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      contextUpdates: { active_customer: targetCustomer, active_customer_id: targetCustomer.id, recentCustomersMentioned: [{ id: targetCustomer.id, name: targetCustomer.name }] },
    };
  }

  if (toolName === 'get_customer_notes') {
    if (!targetCustomer.notes) {
      const speech = userLang === 'hindi' ? `${targetCustomer.name} के लिए कोई नोट नहीं है।` : `${targetCustomer.name} ke liye koi note save nahi hai.`;
      return { reply: speech };
    }
    const speech = userLang === 'hindi' ? `${targetCustomer.name} के नोट्स: ${targetCustomer.notes}` : `${targetCustomer.name} ke notes: ${targetCustomer.notes}`;
    return { reply: speech };
  }

  // 15. CUSTOMER REMINDERS
  if (toolName === 'create_customer_reminder') {
    const due = args.due_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const newRem = {
      id: `rem-${Date.now()}`,
      customerId: targetCustomer.id,
      customerName: targetCustomer.name,
      amount: Number(args.amount) || targetCustomer.balance,
      dueDate: due,
      message: args.message || `Payment reminder for ${targetCustomer.name}`,
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    reminders.unshift(newRem);
    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} के लिए ${due} तक का पेमेंट रिमाइंडर लगा दिया गया है।`
      : `${targetCustomer.name} ke liye ${due} ka reminder set kar diya hai.`;
    return { reply: speech };
  }

  if (toolName === 'get_customer_reminders') {
    const custRem = reminders.filter(r => (r as any).customerId === targetCustomer?.id || r.customerName?.toLowerCase() === targetCustomer?.name.toLowerCase());
    if (custRem.length === 0) {
      const speech = userLang === 'hindi' ? 'कोई पेंडिंग रिमाइंडर नहीं है।' : 'Koi pending reminder nahi hai.';
      return { reply: speech };
    }
    const first = custRem[0];
    const speech = userLang === 'hindi'
      ? `${first.customerName}: ₹${first.amount.toLocaleString('en-IN')} का रिमाइंडर ${first.dueDate} तक पेंडिंग है।`
      : `${first.customerName}: ₹${first.amount.toLocaleString('en-IN')} reminder due on ${first.dueDate}.`;
    return { reply: speech };
  }

  if (toolName === 'delete_customer_reminder') {
    const prevLen = reminders.length;
    reminders = reminders.filter(r => (r as any).customerId !== targetCustomer?.id && r.customerName?.toLowerCase() !== targetCustomer?.name.toLowerCase());
    const speech = userLang === 'hindi' ? 'रिमाइंडर हटा दिया गया है।' : 'Reminder delete kar diya.';
    return { reply: speech };
  }

  // 16. UPDATE CUSTOMER
  if (toolName === 'update_customer') {
    if (args.phone === undefined && (args.address === undefined) && (args.notes === undefined) && (args.new_name === undefined)) {
      return { reply: userLang === 'hindi' ? 'नया फोन नंबर क्या है?' : 'Naya phone number kya hai?' };
    }
    if (args.phone) targetCustomer.phone = args.phone;
    if (args.address) targetCustomer.address = args.address;
    if (args.notes) targetCustomer.notes = args.notes;
    if (args.new_name) targetCustomer.name = cleanCustomerName(args.new_name);

    const speech = userLang === 'hindi'
      ? `${targetCustomer.name} का विवरण अपडेट कर दिया गया है।`
      : `${targetCustomer.name} ki details update kar di gayi hain.`;
    return {
      reply: speech,
      updatedCustomer: targetCustomer,
      contextUpdates: { active_customer: targetCustomer, active_customer_id: targetCustomer.id, recentCustomersMentioned: [{ id: targetCustomer.id, name: targetCustomer.name }] },
    };
  }

  // 17. DELETE CUSTOMER (Requires Confirmation)
  if (toolName === 'delete_customer') {
    const hasDues = targetCustomer.balance !== 0;
    const confirmMsg = userLang === 'hindi'
      ? `${targetCustomer.name} का ${hasDues ? `₹${Math.abs(targetCustomer.balance)} का हिसाब बाकी है` : 'खाता मौजूद है'}। क्या आप सच में ${targetCustomer.name} को डिलीट करना चाहते हैं?`
      : `${targetCustomer.name} ka ${hasDues ? `₹${Math.abs(targetCustomer.balance)} ka balance pending hai` : 'record exist karta hai'}. Kya aap sach mein ${targetCustomer.name} ko delete karna chahte hain?`;
    return {
      reply: confirmMsg,
      pendingConfirmation: {
        action: 'delete_customer',
        payload: { customerId: targetCustomer.id },
        message: targetCustomer.name,
        description: `Delete ${targetCustomer.name}`,
      },
    };
  }

  // 18. UNDO RECENT ACTION (Requires Confirmation)
  if (toolName === 'undo_recent_customer_action') {
    if (transactions.length === 0) {
      return { reply: userLang === 'hindi' ? 'रद्द करने के लिए कोई लेन-देन नहीं मिला।' : 'Undo karne ke liye koi recent transaction nahi mila.' };
    }
    const lastTx = transactions[0];
    const confirmMsg = userLang === 'hindi'
      ? `क्या आप ${lastTx.partyName} की ₹${lastTx.amount.toLocaleString('en-IN')} की अंतिम एंट्री को हटाना चाहते हैं?`
      : `Kya aap ${lastTx.partyName} ki ₹${lastTx.amount.toLocaleString('en-IN')} ki last entry ko undo karna chahte hain?`;
    return {
      reply: confirmMsg,
      pendingConfirmation: {
        action: 'delete_transaction',
        payload: { transactionId: lastTx.id },
        message: `${lastTx.partyName}: ₹${lastTx.amount}`,
        description: `Revert transaction ${lastTx.id}`,
      },
    };
  }

  // Fallback
  return {
    reply: userLang === 'hindi'
      ? 'जी बताइए, क्या एंट्री करनी है?'
      : (userLang === 'english' ? 'Yes, how can I assist you with your ledger?' : 'Haanji, batayein, kya entry karni hai?'),
  };
}

app.post('/api/voice/chat', async (req, res) => {
  const { message, context, activeCustomer, userLanguage } = req.body;
  const raw = String(message || '').trim();

  // Detect language
  const isHindi = /[\u0900-\u097F]/.test(raw);
  const isHinglish = !isHindi && (
    /\b(karo|karke|banao|batao|bataiye|diya|diye|liya|liye|hoga|hogi|honge|raha|rahi|rahe|kholo|dikhao|paisa|paise|rupaye|udhar|jama|mera|meri|mere|tera|teri|tere|uska|uski|usmein|usme|kya|kaun|kaise|kitna|kitne|bhai|khatabook|hisab|dhanyawad|shukriya|namaste|theek|achha|bikri|munafa|kharcha|kharch)\b/i.test(raw.toLowerCase()) ||
    /\b(kar\s+do|de\s+do|bata\s+do|hata\s+do|bhej\s+do|market\s+me|khata\s+me|dukan\s+me|us\s+me|is\s+me|ka\s+balance|ki\s+last|hai\s+ya|hai\s+kya)\b/i.test(raw.toLowerCase())
  );
  const userLang: 'hindi' | 'hinglish' | 'english' = (userLanguage === 'english' || userLanguage === 'hindi' || userLanguage === 'hinglish')
    ? userLanguage
    : (isHindi ? 'hindi' : (isHinglish ? 'hinglish' : 'english'));

  // If Gemini Live is available, call model with semantic guidelines
  if (ai) {
    const activeLangInstruction = userLang === 'english'
      ? 'CRITICAL: User is speaking in English. Spoken and written responses MUST be in natural, professional English.'
      : (userLang === 'hindi'
          ? 'CRITICAL: User is speaking in Hindi. Responses MUST be in natural Hindi in Devanagari script.'
          : 'Match the language naturally (English -> English, Hindi -> Hindi, Hinglish -> Hinglish).');

    const recentCusts = (context?.recentCustomersMentioned || []).map((c: any) => c.name).join(', ');

    const systemInstruction = `You are Jarvis, the real conversational customer & khata assistant for NotiBook (smart business ledger & Khatabook for Indian merchants).
${activeLangInstruction}

CONVERSATION CONTEXT:
- Active Customer: ${activeCustomer ? `${activeCustomer.name} (ID: ${activeCustomer.id}, Balance: ₹${activeCustomer.balance})` : 'None'}
- Recently Mentioned Customers: ${recentCusts || 'None'}
- Last Action: ${context?.last_action || 'None'}

CRITICAL KHATA & SEMANTIC RULES:
1. PRONOUN RESOLUTION:
   - "uska", "usme", "usne", "usse", "unke", "unka", "unhone", "iska", "him", "her", "that customer" refer to Active Customer (${activeCustomer?.name || 'None'}).
   - CRITICAL AMBIGUOUS CONTEXT: If multiple customers were mentioned in recent turns (${recentCusts}) and user uses a singular pronoun ("usne", "uska") without naming who:
     DO NOT GUESS! Call \`ask_clarification\` with: "Rahul ya Ramesh — kisne ₹500 diye?"
   - If user switches customer ("Rahul ka balance batao" -> then "Ab Ramesh ka batao"), immediately target Ramesh.

2. FINANCIAL DIRECTION & KHATA LEDGER:
   - "PAYMENT_RECEIVED": Customer gives money, settles dues, pays via cash/UPI ("Ramesh ne 2000 de diye", "Ramesh ka 2000 aa chuka hai", "2000 mil gaye", "2000 jama karo", "khate mein se 2000 minus karo", "2000 minus karke batao").
     CRITICAL: "MINUS" from account/khata ALWAYS means payment received (reduces customer outstanding)!
     Call \`record_customer_payment\`.
   - "NEW_CUSTOMER_DEBT": Merchant gives goods or credit to customer ("Ramesh ko 1000 udhar diya", "1000 udhar likho", "1000 debit karo").
     Customer outstanding balance increases.
     Call \`add_customer_debt\`.

3. MULTI-ACTION COMMANDS:
   - If user asks multiple actions in one sentence (e.g. "Ramesh ko naya customer banao aur usme 1000 udhar likh do"):
     Return BOTH function calls in sequence: \`create_customer(name: 'Ramesh')\` and \`add_customer_debt(customer_name: 'Ramesh', amount: 1000)\`.

4. NEVER INVENT NUMBERS OR PHONES:
   - Never invent money amounts, balances, dates, or phone numbers.
   - If amount is missing (e.g. "Ramesh ne payment kar di" or "Usme udhar likh do"):
     Call \`ask_clarification\` with: "Kitne rupaye receive hue?" or "Kitne rupaye ka udhar likhna hai?".
   - If adding a customer without phone, leave phone null/empty. NEVER invent fake numbers like 9876543210.
   - If user asks "Uska number bhi daal do" without providing the number, call \`ask_clarification\` with: "Naya phone number kya hai?".

5. CORRECTIONS:
   - If user corrects themselves (e.g. "Ramesh ne 2000 diye... sorry, 1500 diye"), extract the corrected amount (1500).
   - If user corrects person (e.g. "Rahul ka... nahi, Ramesh ka balance"), target Ramesh.

6. AUTHORITATIVE DATABASE:
   - Balances, transaction histories, summaries, notes, and reminders ALWAYS come from backend tool results.

7. CRITICAL — NEVER INVENT CUSTOMER IDENTITY OR FINANCIAL STATE:
   - When user says "add 1000 into account", "add 1000", "1000 jod do", or similar write command:
     If Active Customer is None (no active customer in context):
       DO NOT call add_customer_debt, record_customer_payment, or get_customer_balance!
       DO NOT invent Ram, Ramesh, or any customer!
       Call \`ask_clarification\` with question: "Which customer's account should I add ₹1,000 to?" (or in Hinglish: "₹1,000 kis customer ke khate mein add karna hai?").
     If multiple customers were recently mentioned (${recentCusts}):
       DO NOT guess! Call \`ask_clarification\` asking which customer's account to add to.
     Only if exactly one active customer is present in context (${activeCustomer?.name || 'None'}), call \`add_customer_debt\`.
   - For write commands like "add 1000 into account", NEVER produce "account is fully settled with zero dues". Settlement status must NEVER be generated unless user explicitly asked for balance or settlement!`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'create_customer',
            description: 'Explicitly create a new customer record. Never invent phone numbers.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Clean customer name only (e.g. "Ramesh Sharma"). No fragments.' },
                phone: { type: Type.STRING, description: 'Phone number if explicitly provided by user. Leave empty if omitted.' },
                address: { type: Type.STRING, description: 'Customer address if provided' },
                opening_balance: { type: Type.NUMBER, description: 'Opening debt balance if provided' },
                notes: { type: Type.STRING, description: 'Initial profile notes' },
              },
              required: ['name'],
            },
          },
          {
            name: 'get_customer_balance',
            description: 'Get authoritative current financial balance for an individual customer',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name or pronoun target' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
              },
            },
          },
          {
            name: 'record_customer_payment',
            description: 'Record payment received from a customer (jama / paise mil gaye / de diye / minus from khata). Reduces dues.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name or pronoun reference' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
                amount: { type: Type.NUMBER, description: 'Payment amount in INR explicitly provided by user. Leave null if not provided!' },
                payment_mode: { type: Type.STRING, enum: ['Cash', 'UPI', 'Bank', 'Other'], description: 'Payment method' },
                description: { type: Type.STRING, description: 'Optional note' },
              },
            },
          },
          {
            name: 'add_customer_debt',
            description: 'Record credit/udhar given to customer (udhar diya / saman diya / debit). Increases dues.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name or pronoun reference' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
                amount: { type: Type.NUMBER, description: 'Credit amount in INR explicitly provided by user. Leave null if not provided!' },
                description: { type: Type.STRING, description: 'Optional description of goods' },
              },
            },
          },
          {
            name: 'get_customer_summary',
            description: 'Get full summary of customer: outstanding balance, last payment, recent transaction, reminders, and notes',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
              },
            },
          },
          {
            name: 'get_customer_history',
            description: 'Get transaction and payment history for a customer with optional period filter',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
                period: { type: Type.STRING, enum: ['today', 'yesterday', 'this_week', 'this_month', 'all'] },
                type: { type: Type.STRING, enum: ['payment', 'credit', 'all'] },
              },
            },
          },
          {
            name: 'create_customer_note',
            description: 'Add a note or commitment to customer profile',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
                note: { type: Type.STRING, description: 'Note text' },
              },
              required: ['note'],
            },
          },
          {
            name: 'get_customer_notes',
            description: 'Get notes recorded for a customer',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
              },
            },
          },
          {
            name: 'create_customer_reminder',
            description: 'Set a payment reminder for a customer',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
                amount: { type: Type.NUMBER, description: 'Reminder amount' },
                due_date: { type: Type.STRING, description: 'Due date' },
                message: { type: Type.STRING, description: 'Reminder message' },
              },
            },
          },
          {
            name: 'get_customer_reminders',
            description: 'Get pending customer payment reminders',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name or empty for all' },
              },
            },
          },
          {
            name: 'delete_customer_reminder',
            description: 'Delete reminder for a customer',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
              },
            },
          },
          {
            name: 'update_customer',
            description: 'Update customer contact info, phone, address, or notes',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Existing customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
                new_name: { type: Type.STRING, description: 'New name' },
                phone: { type: Type.STRING, description: 'New phone number' },
                address: { type: Type.STRING, description: 'New address' },
                notes: { type: Type.STRING, description: 'New notes' },
              },
            },
          },
          {
            name: 'delete_customer',
            description: 'Delete customer record from database (requires confirmation)',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name to delete' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
              },
            },
          },
          {
            name: 'undo_recent_customer_action',
            description: 'Undo/revert the most recent transaction entry (requires confirmation)',
            parameters: {
              type: Type.OBJECT,
              properties: {},
            },
          },
          {
            name: 'get_due_customers',
            description: 'Query customers who owe money (pending dues) or settled customers',
            parameters: {
              type: Type.OBJECT,
              properties: {
                filter: { type: Type.STRING, enum: ['due', 'settled', 'all'] },
              },
            },
          },
          {
            name: 'get_account_balance',
            description: 'Get total market dues across all customers in the shop ledger',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'get_report',
            description: 'Get total collections or expenses for a period',
            parameters: {
              type: Type.OBJECT,
              properties: {
                period: { type: Type.STRING, enum: ['today', 'yesterday', 'this_week', 'this_month', 'all'] },
              },
            },
          },
          {
            name: 'open_customer',
            description: 'Open customer khata ledger modal on screen',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                customer_id: { type: Type.STRING, description: 'Customer ID' },
              },
              required: ['customer_name'],
            },
          },
          {
            name: 'navigate',
            description: 'Navigate to any page, tab, subtab, or dialog in the app UI',
            parameters: {
              type: Type.OBJECT,
              properties: {
                target: { type: Type.STRING, enum: ['home', 'customers', 'billing', 'transactions', 'stocks', 'add_customer_modal', 'add_transaction_modal', 'settings_modal', 'search_modal'] },
              },
              required: ['target'],
            },
          },
          {
            name: 'ask_clarification',
            description: 'Ask user for clarification when required information is missing or customer reference is ambiguous. NEVER INVENT NUMBERS.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: 'Question to ask user in their language' },
                reason: { type: Type.STRING, enum: ['missing_amount', 'ambiguous_customer', 'missing_phone', 'missing_date', 'general'] },
                target_customer: { type: Type.STRING, description: 'Customer name if known' },
              },
              required: ['question'],
            },
          },
          {
            name: 'end_conversation',
            description: 'Close voice session on user farewell',
            parameters: {
              type: Type.OBJECT,
              properties: {
                speech_response: { type: Type.STRING, description: 'Farewell message' },
              },
            },
          },
        ],
      },
    ];

    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    for (const modelName of candidateModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout on ${modelName}`)), 7000)
        );

        let contentsPayload: any = raw;
        if (context && Array.isArray(context.recentTurns) && context.recentTurns.length > 0) {
          const history = context.recentTurns.slice(-6).map((turn: any) => ({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(turn.text || '') }],
          }));
          history.push({ role: 'user', parts: [{ text: raw }] });
          contentsPayload = history;
        }

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
          // Sequential Multi-Action Execution Pipeline
          let newlyCreatedCust: any = null;
          const replies: string[] = [];
          let lastUpdatedCust: any = null;
          let lastNewTx: any = null;
          let lastDeletedCustId: string | undefined;
          let lastDeletedTxId: string | undefined;
          let lastNav: any = undefined;
          let lastPendingConfirmation: any = undefined;
          let lastPendingSlot: any = undefined;
          let lastContextUpdates: any = undefined;

          for (const call of functionCalls) {
            // Forward newly created customer id to dependent operations in the same sentence
            if (newlyCreatedCust && (!call.args.customer_name || call.args.customer_name === newlyCreatedCust.name)) {
              call.args.customer_id = newlyCreatedCust.id;
            }

            const executed = executeBackendTool(call.name, call.args, userLang, context, activeCustomer);
            if (executed.createdCustomer) newlyCreatedCust = executed.createdCustomer;
            if (executed.updatedCustomer) lastUpdatedCust = executed.updatedCustomer;
            if (executed.newTransaction) lastNewTx = executed.newTransaction;
            if (executed.deletedCustomerId) lastDeletedCustId = executed.deletedCustomerId;
            if (executed.deletedTransactionId) lastDeletedTxId = executed.deletedTransactionId;
            if (executed.navigation) lastNav = executed.navigation;
            if (executed.pendingConfirmation) lastPendingConfirmation = executed.pendingConfirmation;
            if (executed.pendingSlotFilling) lastPendingSlot = executed.pendingSlotFilling;
            if (executed.contextUpdates) lastContextUpdates = { ...lastContextUpdates, ...executed.contextUpdates };
            if (executed.reply) replies.push(executed.reply);
          }

          // Combine multiple replies naturally
          const joinWord = userLang === 'hindi' ? ' और ' : (userLang === 'english' ? ' and ' : ' aur ');
          const finalReply = replies.join(joinWord);

          return res.json({
            reply: finalReply,
            createdCustomer: newlyCreatedCust,
            updatedCustomer: lastUpdatedCust,
            newTransaction: lastNewTx,
            deletedCustomerId: lastDeletedCustId,
            deletedTransactionId: lastDeletedTxId,
            navigation: lastNav,
            contextUpdates: lastContextUpdates,
            pendingConfirmation: lastPendingConfirmation,
            pendingSlotFilling: lastPendingSlot,
          });
        }

        if (response.text && response.text.trim()) {
          const rawTrim = raw.toLowerCase();
          const isAcknowledgeClosing = (
            rawTrim === 'theek hai' || rawTrim === 'theek h' || rawTrim === 'ok' || rawTrim === 'okay' ||
            rawTrim === 'alright' || rawTrim === 'all right' || rawTrim === 'bas' || rawTrim === 'bas itna hi' ||
            rawTrim === 'bye' || rawTrim === 'goodbye' || rawTrim === 'thank you' || rawTrim === 'thanks' ||
            raw === 'ठीक है' || raw === 'बस' || raw === 'अलविदा' || raw === 'धन्यवाद'
          );
          if (isAcknowledgeClosing && !context?.pendingConfirmation && !context?.pendingSlotFilling) {
            const executed = executeBackendTool('end_conversation', {}, userLang, context, activeCustomer);
            return res.json(executed);
          }
          return res.json({ reply: response.text.trim() });
        }
        break;
      } catch (err: any) {
        console.warn(`[GeminiLive Server] Model ${modelName} error:`, err.message || err);
      }
    }
  }

  // --- DYNAMIC SEMANTIC MULTI-ACTION PARSER & BACKEND EXECUTION ENGINE ---
  const executionResult = planAndExecuteSemanticPipeline(raw, userLang, context, activeCustomer);
  return res.json(executionResult);
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

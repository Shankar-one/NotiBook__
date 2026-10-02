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
  text = text.replace(/^(?:अरे|भाई|सुनो|जार्विस|jarvis|hey\s+jarvis|please|zara|ek|naya|new)\s+/i, '');
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

function resolveCustomerInServer(input: string, activeCust?: any): {
  status: 'EXACT' | 'AMBIGUOUS' | 'NOT_FOUND' | 'PRONOUN' | 'NO_NAME';
  customer?: any;
  candidates?: any[];
  searchedName?: string;
} {
  if (!input || !input.trim()) return { status: 'NO_NAME' };
  const inputLower = input.toLowerCase().trim();

  // 1. Check pronouns ("usne", "uska", "uske", "usmein", "unhone", "unka", "woh")
  const isPronoun = /\b(usne|usmein|usme|uski|uska|uske|usse|unhone|unka|unki|unke|unhe|unko|unse|isme|ismein|iska|woh)\b|उसने|उन्होंने|उसमें|उसका|उसकी|उसके|उनका/i.test(inputLower);
  if (isPronoun && activeCust) {
    const cust = customers.find(c => c.id === activeCust.id) || activeCust;
    return { status: 'PRONOUN', customer: cust, searchedName: cust.name };
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

function detectServerFinancialIntent(raw: string): {
  intent: 'PAYMENT_RECEIVED' | 'ADD_CUSTOMER_DEBT' | 'GET_CUSTOMER_BALANCE' | 'GET_ACCOUNT_BALANCE' | 'CREATE_CUSTOMER' | 'GET_TRANSACTIONS' | 'NAVIGATE' | 'END_CONVERSATION' | 'UNKNOWN';
  amount?: number;
  hasAmount: boolean;
  target?: string;
} {
  const lower = raw.toLowerCase().trim();

  // 1. Closing
  const isClosing = 
    lower === 'theek hai' || lower === 'theek h' || lower === 'ok' || lower === 'okay' ||
    lower === 'alright' || lower === 'all right' || lower === 'bas' || lower === 'bas itna hi' ||
    lower === 'that is all' || lower === 'thats all' || lower === 'bye' || lower === 'goodbye' ||
    lower === 'bye jarvis' || lower.includes('alvida') || raw === 'ठीक है' || raw === 'बस' || raw === 'अलविदा' || raw === 'धन्यवाद';
  if (isClosing) {
    return { intent: 'END_CONVERSATION', hasAmount: false };
  }

  // 2. Navigation
  if (lower.includes('setting') || raw.includes('सेटिंग')) return { intent: 'NAVIGATE', target: 'settings_modal', hasAmount: false };
  if (lower.includes('search') || raw.includes('सर्च')) return { intent: 'NAVIGATE', target: 'search_modal', hasAmount: false };
  if (lower.includes('add customer') && (lower.includes('modal') || lower.includes('form'))) return { intent: 'NAVIGATE', target: 'add_customer_modal', hasAmount: false };
  if (lower.includes('add transaction') || lower.includes('entry form') || lower.includes('cash in') || lower.includes('cash out')) return { intent: 'NAVIGATE', target: 'add_transaction_modal', hasAmount: false };
  if (lower.includes('add product') || lower.includes('product form')) return { intent: 'NAVIGATE', target: 'add_product_modal', hasAmount: false };
  if (lower.includes('invoice') || lower.includes('receipt') || raw.includes('रसीद')) return { intent: 'NAVIGATE', target: 'invoice_modal', hasAmount: false };
  if (lower.includes('sidebar') || raw.includes('साइडबार')) return { intent: 'NAVIGATE', target: 'toggle_sidebar', hasAmount: false };
  if (lower.includes('ledger') || lower.includes('khata kholo') || raw.includes('खाता खोलो') || raw.includes('लेजर खोलो')) return { intent: 'NAVIGATE', target: 'customer_ledger_modal', hasAmount: false };
  if (lower.includes('customer page') || lower.includes('customers kholo') || raw.includes('कस्टमर्स खोलो')) return { intent: 'NAVIGATE', target: 'customers', hasAmount: false };
  if (lower.includes('transaction page') || lower.includes('transactions kholo') || raw.includes('लेनदेन खोलो')) return { intent: 'NAVIGATE', target: 'transactions', hasAmount: false };
  if (lower.includes('billing') || raw.includes('बिलिंग खोलो')) return { intent: 'NAVIGATE', target: 'billing', hasAmount: false };
  if (lower.includes('stock') || raw.includes('स्टॉक खोलो') || lower.includes('inventory')) return { intent: 'NAVIGATE', target: 'stocks', hasAmount: false };
  if (lower.includes('home') || lower.includes('dashboard') || raw.includes('होम') || raw.includes('डैशबोर्ड')) return { intent: 'NAVIGATE', target: 'home', hasAmount: false };

  // 3. Amount extraction
  const amtMatch = raw.match(/(?:₹|rs\.?|inr|रुपये|रुपए)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:₹|rs\.?|inr|रुपये|रुपए)?/i);
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : undefined;
  const hasAmount = amount !== undefined && !isNaN(amount) && amount > 0;

  // 4. Explicit Customer Creation
  const isCreateCust = 
    /(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i.test(lower) ||
    /(?:customer\s+banao|customer\s+add\s+karo|naya\s+customer\s+add\s+karo|naya\s+customer\s+banao)/i.test(lower) ||
    /([a-zA-Z\s\u0900-\u097F]+?)\s*(?:ko|karke)?\s*(?:customer|ग्राहक)\s*(?:banao|bana\s*do|add\s*karo|add\s*kar\s*do|जोड़ो|बनाओ)/i.test(lower) ||
    /^(?:new\s+customer|naya\s+customer|नया\s+ग्राहक|नया\s+कस्टमर)\s+[a-zA-Z\u0900-\u097F]+/i.test(lower) ||
    /^(?:customer\s+banao|naya\s+customer\s+banao|add\s+customer|create\s+customer)$/i.test(lower);
  if (isCreateCust) {
    return { intent: 'CREATE_CUSTOMER', hasAmount: false };
  }

  // 5. Account balance
  const isAccountBal = 
    /\b(total\s+udhar|market\s+udhar|market\s+me|baki\s+paisa|sabka\s+udhar|kul\s+udhar|kul\s+bakaya|pending\s+dues|total\s+dues|lena\s+hai)\b/i.test(lower) ||
    /कुल\s*उधारी|बाकी\s*पैसा|कुल\s*बकाया|मार्केट\s*में|लेना\s*है|सबका\s*उधार/i.test(raw);
  if (isAccountBal) {
    return { intent: 'GET_ACCOUNT_BALANCE', hasAmount: false };
  }

  // 6. Minus reduction -> ALWAYS PAYMENT_RECEIVED
  const isMinus = 
    /\b(minus\s*karke\s*batao|minus\s*karo|minus\s*kar\s*do|minus|kam\s*karo|kam\s*kar\s*do|khate\s*mein\s*se\s*minus)\b/i.test(lower) ||
    /माइनस\s*करके\s*बताओ|माइनस\s*करो|माइनस\s*कर\s*दो|माइनस|कम\s*करो/i.test(raw);
  if (isMinus) {
    return { intent: 'PAYMENT_RECEIVED', amount, hasAmount };
  }

  // 7. Payment received
  const isPayment = 
    /\b(?:ne\s+\d+|ne\s+payment|ka\s+\d+\s+aa|ka\s+\d+\s+mil|se\s+\d+\s+receive|se\s+payment)\b/i.test(lower) ||
    /\b(aa\s*chuka\s*hai|aa\s*chuka|aa\s*gaya|aa\s*gayi|aaye|aaya|mil\s*gaya|mil\s*gaye|mile|receive\s*hua|receive\s*hue|received|de\s*diye|pay\s*kar\s*diye|pay\s*kiya|pay\s*kar\s*di|payment\s*kar\s*di|payment\s*aayi|wapas\s*kar\s*diye|wapas\s*diye|jama|jama\s*karo|jama\s*likho|jama\s*kar\s*do)\b/i.test(lower) ||
    /आ\s*चुका\s*है|आ\s*चुका|आ\s*गया|आ\s*गई|आए|आया|मिल\s*गया|मिल\s*गए|मिले|प्राप्त\s*हुए|पेमेंट\s*कर\s*दी|पेमेंट\s*आई|दे\s*दिए|वापस\s*कर\s*दिए|जमा|जमा\s*करो|जमा\s*लिखो/i.test(raw);
  if (isPayment) {
    return { intent: 'PAYMENT_RECEIVED', amount, hasAmount };
  }

  // 8. Credit given (udhar, debit)
  const isDebt = 
    /\b(udhar|udhari|debit|le\s*gaya|samaan\s*diya|udhar\s*likho|udhar\s*likh\s*do|udhar\s*chadha\s*do|udhar\s*diya)\b/i.test(lower) ||
    /उधार|उधर|उधारी|डेबिट|सामान\s*दिया|उधार\s*लिखो|उधार\s*लिख\s*दो|उधार\s*चढ़ा\s*दो|उधार\s*दिया/i.test(raw);
  if (isDebt) {
    return { intent: 'ADD_CUSTOMER_DEBT', amount, hasAmount };
  }

  // Check "ne ... diye" vs "ko ... diye"
  if (/\bne\b/i.test(lower) && /\b(diye|diya|de\s*diye)\b/i.test(lower)) {
    return { intent: 'PAYMENT_RECEIVED', amount, hasAmount };
  }
  if (/\bko\b/i.test(lower) && /\b(udhar|udhari|diye|diya)\b/i.test(lower)) {
    return { intent: 'ADD_CUSTOMER_DEBT', amount, hasAmount };
  }

  // 9. Balance query
  const isBal = 
    /\b(balance|baki\s*hai|kitna\s*hai|kitna\s*baki|dues|hisab\s*batao)\b/i.test(lower) ||
    /बैलेंस|कितना\s*बाकी|बकाया|हिसाब\s*बताओ/i.test(raw);
  if (isBal && !lower.includes('add') && !lower.includes('likh')) {
    return { intent: 'GET_CUSTOMER_BALANCE', hasAmount: false };
  }

  return { intent: 'UNKNOWN', amount, hasAmount };
}

// Authoritative Backend Execution Engine
function handleSemanticIntent(
  intent: string,
  params: { customer_name?: string; is_pronoun?: boolean; amount?: number; transaction_type?: string; phone?: string; target?: string; period?: string; speech_response?: string },
  userLang: 'hindi' | 'hinglish' | 'english',
  context?: any,
  activeCustomer?: any
): { reply: string; toolCall?: any; updatedCustomer?: any; newTransaction?: any } {
  const normIntent = intent === 'add_transaction'
    ? (params.transaction_type === 'debit' ? 'ADD_CUSTOMER_DEBT' : 'PAYMENT_RECEIVED')
    : (intent === 'record_payment' ? 'PAYMENT_RECEIVED' : intent);

  // 1. END CONVERSATION
  if (normIntent === 'end_conversation' || normIntent === 'END_CONVERSATION') {
    const farewell = userLang === 'hindi'
      ? 'ठीक है, आपका बहुत धन्यवाद! आपका दिन शुभ हो।'
      : (userLang === 'hinglish' ? 'Theek hai, dhanyawad! Have a great day.' : 'Alright, thank you! Have a great day.');
    return {
      reply: farewell,
      toolCall: { name: 'end_conversation', args: { speech_response: farewell } }
    };
  }

  // 2. NAVIGATION
  if (normIntent === 'navigate' || normIntent === 'NAVIGATE') {
    const target = params.target || 'home';
    const speech = userLang === 'hindi'
      ? `${target} खोल दिया गया है।`
      : (userLang === 'hinglish' ? `${target} open kar diya hai.` : `Opening ${target}.`);
    return {
      reply: speech,
      toolCall: { name: 'navigate', args: { target, speech_response: speech } }
    };
  }

  // 3. GET ACCOUNT BALANCE (Total market dues)
  if (normIntent === 'get_account_balance' || normIntent === 'GET_ACCOUNT_BALANCE') {
    const total = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
    const speech = userLang === 'hindi'
      ? `मार्केट में कुल बकाया ₹${total.toLocaleString('en-IN')} लेना है।`
      : (userLang === 'hinglish' ? `Market me total ₹${total.toLocaleString('en-IN')} baaki hai.` : `Total market receivables are ₹${total.toLocaleString('en-IN')}.`);
    return {
      reply: speech,
      toolCall: { name: 'get_account_balance', args: { speech_response: speech } }
    };
  }

  // 4. REPORTS
  if (normIntent === 'get_report' || normIntent === 'GET_REPORT') {
    const period = params.period || 'today';
    const moneyIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    const moneyOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    const speech = userLang === 'hindi'
      ? `आज की कुल बिक्री ₹${moneyIn.toLocaleString('en-IN')} और खर्चे ₹${moneyOut.toLocaleString('en-IN')} हैं।`
      : (userLang === 'hinglish' ? `Aaj ka total collection ₹${moneyIn.toLocaleString('en-IN')} aur kharcha ₹${moneyOut.toLocaleString('en-IN')} hai.` : `Today's collections are ₹${moneyIn.toLocaleString('en-IN')} and expenses are ₹${moneyOut.toLocaleString('en-IN')}.`);
    return {
      reply: speech,
      toolCall: { name: 'get_report', args: { period, speech_response: speech } }
    };
  }

  // 5. CUSTOMER RESOLUTION AGAINST DATABASE
  const rawCustomerName = params.customer_name || '';
  const resolution = resolveCustomerInServer(rawCustomerName, activeCustomer);

  // Check Ambiguity (e.g. 2 customers named "Ravi")
  if (resolution.status === 'AMBIGUOUS' && resolution.candidates && resolution.candidates.length > 1) {
    const candidateNames = resolution.candidates.map(c => c.name).join(userLang === 'hindi' ? ' या ' : (userLang === 'english' ? ' or ' : ' ya '));
    const displayName = resolution.searchedName || rawCustomerName;
    const msg = userLang === 'hindi'
      ? `${displayName} नाम के ${resolution.candidates.length} कस्टमर्स मिल रहे हैं (${candidateNames})। आप किस ${displayName} की बात कर रहे हैं?`
      : (userLang === 'english'
        ? `Found ${resolution.candidates.length} customers matching "${displayName}" (${candidateNames}). Which one do you mean?`
        : `${displayName} naam ke ${resolution.candidates.length} customers mil rahe hain (${candidateNames}). Kis ${displayName} ki baat kar rahe hain?`);
    return { reply: msg };
  }

  // Customer Not Found for Financial Actions: DO NOT CREATE A CUSTOMER AUTOMATICALLY!
  if (!resolution.customer && (normIntent === 'PAYMENT_RECEIVED' || normIntent === 'ADD_CUSTOMER_DEBT' || normIntent === 'GET_CUSTOMER_BALANCE' || normIntent === 'get_balance')) {
    const cleanName = cleanCustomerName(rawCustomerName);
    if (cleanName && cleanName.length >= 2) {
      const msg = userLang === 'hindi'
        ? `"${cleanName}" कस्टमर लिस्ट में नहीं मिल रहे। क्या आप उन्हें नया कस्टमर बनाना चाहते हैं?`
        : (userLang === 'english'
          ? `"${cleanName}" was not found in the customer list. Would you like to add them as a new customer?`
          : `"${cleanName}" customer list mein nahi mil rahe. Kya aap unhe naya customer banana chahte hain?`);
      return { reply: msg };
    }
  }

  const targetCustomer = resolution.customer;

  // 6. CREATE CUSTOMER (Only on explicit request)
  if (normIntent === 'create_customer' || normIntent === 'CREATE_CUSTOMER' || normIntent === 'add_customer') {
    const cleanName = cleanCustomerName(rawCustomerName || params.customer_name || 'New Customer');
    if (!cleanName || cleanName.length < 2) {
      const askMsg = userLang === 'hindi' ? 'किस नाम से नया ग्राहक बनाना है?' : (userLang === 'english' ? 'What is the name for the new customer?' : 'Kis naam se naya customer add karna hai?');
      return { reply: askMsg };
    }
    const existing = customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      const msg = userLang === 'hindi'
        ? `"${existing.name}" पहले से कस्टमर लिस्ट में मौजूद हैं।`
        : (userLang === 'english' ? `"${existing.name}" already exists in the customer list.` : `"${existing.name}" pehle se customer list mein hain.`);
      return { reply: msg };
    }

    const newCust = {
      id: `cust-${Date.now()}`,
      name: cleanName,
      phone: params.phone || '', // NEVER invent fake phone numbers!
      address: '',
      balance: 0,
      lastTransactionDate: new Date().toISOString().slice(0, 10),
      status: 'settled',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    customers.unshift(newCust);

    const speech = userLang === 'hindi'
      ? `नया ग्राहक "${cleanName}" जोड़ दिया गया है।`
      : (userLang === 'english' ? `Added "${cleanName}" as a new customer.` : `Naya customer "${cleanName}" add kar diya hai.`);
    return {
      reply: speech,
      toolCall: { name: 'add_customer', args: { name: cleanName, speech_response: speech } },
      updatedCustomer: newCust,
    };
  }

  // 7. GET CUSTOMER BALANCE (Real database value)
  if (normIntent === 'get_customer_balance' || normIntent === 'GET_CUSTOMER_BALANCE' || normIntent === 'get_balance') {
    if (!targetCustomer) {
      const msg = userLang === 'hindi'
        ? 'किस कस्टमर का बैलेंस जानना है?'
        : (userLang === 'english' ? 'Which customer balance would you like to check?' : 'Kis customer ka balance janna hai?');
      return { reply: msg };
    }
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
    return {
      reply: speech,
      toolCall: { name: 'get_balance', args: { customer_name: targetCustomer.name, speech_response: speech } },
      updatedCustomer: targetCustomer,
    };
  }

  // 8. TRANSACTIONS (Payment Received vs Credit Given)
  if (normIntent === 'PAYMENT_RECEIVED' || normIntent === 'ADD_CUSTOMER_DEBT') {
    const isPayment = normIntent === 'PAYMENT_RECEIVED';

    // Missing amount validation
    if (!params.amount || params.amount <= 0) {
      const msg = userLang === 'hindi'
        ? (isPayment ? 'कितने रुपये प्राप्त हुए?' : 'कितने रुपये का उधार लिखना है?')
        : (userLang === 'english'
          ? (isPayment ? 'How much was received?' : 'How much credit to record?')
          : (isPayment ? 'Kitne rupaye receive hue?' : 'Kitne rupaye ka udhar likhna hai?'));
      return {
        reply: msg,
        toolCall: {
          name: 'add_transaction',
          args: {
            customer_name: targetCustomer?.name,
            transaction_type: isPayment ? 'credit' : 'debit',
          }
        }
      };
    }

    const amt = Number(params.amount);
    const activeTarget = targetCustomer || { id: 'cust-walkin', name: cleanCustomerName(rawCustomerName) || 'Walk-In Customer', balance: 0 };
    const prev = activeTarget.balance || 0;
    const newBal = isPayment ? prev - amt : prev + amt;

    activeTarget.balance = newBal;
    activeTarget.status = newBal > 0 ? 'due' : (newBal < 0 ? 'advance' : 'settled');
    activeTarget.lastTransactionDate = new Date().toISOString().slice(0, 10);

    const newTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: isPayment ? 'in' : 'out',
      category: isPayment ? 'Customer Payment' : 'Customer Credit',
      description: isPayment ? `Payment from ${activeTarget.name}` : `Credit given to ${activeTarget.name}`,
      partyName: activeTarget.name,
      paymentMode: 'Cash',
      amount: amt,
      customerId: activeTarget.id,
    };
    transactions.unshift(newTx);

    let speech = '';
    if (isPayment) {
      speech = userLang === 'hindi'
        ? `${activeTarget.name} से ₹${amt.toLocaleString('en-IN')} प्राप्त हो गए। अब उनके खाते में ₹${newBal.toLocaleString('en-IN')} बाकी हैं।${newBal <= 0 ? ' खाता चुकता हो गया है।' : ''}`
        : (userLang === 'english'
          ? `Received ₹${amt.toLocaleString('en-IN')} from ${activeTarget.name}. Their new balance is ₹${newBal.toLocaleString('en-IN')}.${newBal <= 0 ? ' Account is fully settled.' : ''}`
          : `${activeTarget.name} se ₹${amt.toLocaleString('en-IN')} receive ho gaye. Ab unke khate mein ₹${newBal.toLocaleString('en-IN')} baaki hain.${newBal <= 0 ? ' Khata settled ho gaya hai.' : ''}`);
    } else {
      speech = userLang === 'hindi'
        ? `${activeTarget.name} के खाते में ₹${amt.toLocaleString('en-IN')} उधार लिख दिए हैं। अब उनका कुल बकाया ₹${newBal.toLocaleString('en-IN')} है।`
        : (userLang === 'english'
          ? `Recorded ₹${amt.toLocaleString('en-IN')} credit for ${activeTarget.name}. Total balance is now ₹${newBal.toLocaleString('en-IN')}.`
          : `${activeTarget.name} ke account mein ₹${amt.toLocaleString('en-IN')} udhar likh diye hain. Ab unka total balance ₹${newBal.toLocaleString('en-IN')} hai.`);
    }

    return {
      reply: speech,
      toolCall: {
        name: 'add_transaction',
        args: {
          customer_name: activeTarget.name,
          amount: amt,
          transaction_type: isPayment ? 'credit' : 'debit',
          speech_response: speech,
        }
      },
      updatedCustomer: activeTarget,
      newTransaction: newTx,
    };
  }

  // Fallback conversational prompt
  const fallbackReply = userLang === 'hindi'
    ? 'जी बताइए, क्या एंट्री करनी है?'
    : (userLang === 'english' ? 'Yes, how can I assist you with your ledger?' : 'Haanji, batayein, kya update karna hai?');
  return { reply: fallbackReply };
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

    const systemInstruction = `You are Jarvis, the intelligent conversational voice assistant for NotiBook (smart business ledger & Khatabook for Indian merchants).
${activeLangInstruction}

CRITICAL SEMANTIC INTENT & KHATA RULES:
1. "PAYMENT_RECEIVED":
   - When customer pays or settles dues ("Rahul Sharma ka 2000 aa chuka hai to khate mein se 2000 minus karke batao", "Rahul ne 2000 diye", "Rahul ka 2000 mil gaya", "Rahul se 2000 receive hue", "2000 jama karo", "khate mein se 2000 minus karo", "2000 minus karke batao").
   - CRITICAL: "MINUS" from khata or account ALWAYS means PAYMENT_RECEIVED (reduces outstanding, NOT debit!).
   - "diye" when customer gives means payment received!
   - Result: Customer outstanding balance DECREASES.
2. "ADD_CUSTOMER_DEBT":
   - When merchant gives goods or credit to customer ("Rahul ko 2000 udhar diya", "2000 udhar likho", "2000 debit karo").
   - Result: Customer outstanding balance INCREASES.
3. "GET_CUSTOMER_BALANCE": "Rahul ka balance batao", "kitna baki hai".
4. "GET_ACCOUNT_BALANCE": "Total udhar kitna hai", "Market me kitna lena hai".
5. "CREATE_CUSTOMER": ONLY explicit requests like "Rahul ko customer add karo", "New customer Rahul". NEVER create customer from payment sentences.
6. ENTITY EXTRACTION:
   - Extract the customer name entity ONLY (e.g. "Rahul Sharma"). NEVER include sentence fragments like "aa chuka hai to khate mein" or "minus karke batao" in customer_name!
   - Pronouns like "usne", "uska", "uske", "usmein", "unhone", "woh" refer to activeCustomer: ${activeCustomer ? activeCustomer.name : 'None'}. Set is_pronoun: true.
7. NEVER INVENT NUMBERS:
   - Never invent amounts, balances, or phone numbers. If amount is missing (e.g. "Rahul ne payment kar di"), leave amount null!

Tools:
- add_transaction: customer_name (string), amount (number), transaction_type ('credit' = payment received/jama/minus, 'debit' = udhar/given)
- get_balance: customer_name (string)
- get_account_balance: ()
- add_customer: name (string), phone (string)
- navigate: target (string)
- end_conversation: ()`;

    const tools = [
      {
        functionDeclarations: [
          {
            name: 'add_transaction',
            description: 'Record a payment received (credit/jama/minus) or credit given (debit/udhar) for a customer',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Clean customer name entity only. NEVER include sentence fragments.' },
                amount: { type: Type.NUMBER, description: 'Exact amount provided by user. Leave null if not provided.' },
                transaction_type: { type: Type.STRING, enum: ['credit', 'debit'], description: 'credit = payment received/jama/minus from khata, debit = credit given/udhar' },
                is_pronoun: { type: Type.BOOLEAN, description: 'True if customer was referred to via pronoun (usne, uska, etc.)' },
              },
              required: ['transaction_type'],
            },
          },
          {
            name: 'get_balance',
            description: 'Get individual customer balance',
            parameters: {
              type: Type.OBJECT,
              properties: {
                customer_name: { type: Type.STRING, description: 'Customer name' },
                is_pronoun: { type: Type.BOOLEAN, description: 'True if referred to via pronoun' },
              },
              required: ['customer_name'],
            },
          },
          {
            name: 'get_account_balance',
            description: 'Get total market dues across all customers',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'add_customer',
            description: 'Explicitly add a new customer (only when explicitly requested)',
            parameters: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Customer name' },
                phone: { type: Type.STRING, description: 'Customer phone if provided' },
              },
              required: ['name'],
            },
          },
          {
            name: 'navigate',
            description: 'Open any page, tab, subtab, or modal dialog',
            parameters: {
              type: Type.OBJECT,
              properties: {
                target: { type: Type.STRING, description: 'home, customers, billing, transactions, stocks, add_customer_modal, add_transaction_modal, customer_ledger_modal, settings_modal, search_modal' },
              },
              required: ['target'],
            },
          },
          {
            name: 'end_conversation',
            description: 'Close session on user farewell or completion acknowledgment',
            parameters: { type: Type.OBJECT, properties: {} },
          },
        ],
      },
    ];

    const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
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
          const call = functionCalls[0];
          // Execute through authoritative backend handler so real database values and checks apply
          const executed = handleSemanticIntent(call.name, call.args, userLang, context, activeCustomer);
          return res.json(executed);
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
            const executed = handleSemanticIntent('end_conversation', {}, userLang, context, activeCustomer);
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

  // --- DYNAMIC SEMANTIC PARSER & BACKEND EXECUTION FALLBACK ---
  const detected = detectServerFinancialIntent(raw);
  const resolvedCustResult = resolveCustomerInServer(raw, activeCustomer);

  const customerName = resolvedCustResult.customer?.name || (resolvedCustResult.status === 'NOT_FOUND' ? resolvedCustResult.searchedName : undefined);
  const isPronoun = resolvedCustResult.status === 'PRONOUN';

  const executionResult = handleSemanticIntent(
    detected.intent,
    {
      customer_name: customerName,
      is_pronoun: isPronoun,
      amount: detected.amount,
      target: detected.target,
    },
    userLang,
    context,
    activeCustomer
  );

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

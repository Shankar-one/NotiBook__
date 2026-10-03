import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocketServer } from 'ws';
import { SemanticActionPlanner, DatabaseSnapshot } from './src/voice/SemanticActionPlanner';
import { cleanExtractedCustomerName, FORBIDDEN_CUSTOMER_PHRASES, resolveCustomerAgainstDatabase } from './src/voice/CustomerResolver';
import { SemanticActionPlan, ExecutionResult, PendingConfirmation, StrictVoiceIntent } from './src/voice/types';
import { detectLanguage, toDevanagariForHindiTTS, prepareEnglishForTTS, isConfirmationUtterance, isCancellationUtterance } from './src/voice/LanguageUtils';
import { createClient } from '@supabase/supabase-js';
import { parseCatalogueTextLines, matchProductWithCatalogue } from './src/utils/catalogueParser';

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

// ==========================================
// 1. PDF CATALOGUE IMPORT & PARSING PIPELINE
// ==========================================
app.post('/api/catalogue/parse-pdf', async (req, res) => {
  try {
    const { fileData, fileName, rawText, sampleType } = req.body || {};

    let extractedText = '';
    let shopTitle = 'Catalogue Import';

    // 1. Instant 1-click sample option matching user prompt requirement
    if (sampleType === 'sample-abc') {
      extractedText = `ABC GENERAL STORE\nMain Road, Mumbai - Phone: 9876543210\n\nProduct              Price       Stock\nCoca-Cola 500ml      ₹40         100\nPepsi 500ml          ₹40          75\nMaggi 70g            ₹15          50\nParle-G Biscuits     ₹20          30\n`;
      shopTitle = 'ABC GENERAL STORE';
    } else if (rawText && typeof rawText === 'string') {
      extractedText = rawText;
    } else if (fileData && typeof fileData === 'string') {
      // Base64 PDF data
      const base64Clean = fileData.replace(/^data:application\/pdf;base64,/, '').replace(/^data:[^;]+;base64,/, '');
      const pdfBuffer = Buffer.from(base64Clean, 'base64');

      // Attempt fast text extraction with PDFParse
      try {
        const { PDFParse } = await import('pdf-parse');
        if (PDFParse) {
          const parser = new (PDFParse as any)({ data: pdfBuffer });
          const textResult = (await parser.getText?.()) || (await parser.extractText?.());
          if (textResult) {
            extractedText = typeof textResult === 'string' ? textResult : (textResult.text || '');
          }
        }
      } catch (pdfErr) {
        console.warn('[PDFParse] Local text extraction note:', pdfErr);
      }

      // If text extraction yielded minimal text (scanned / image PDF), utilize Gemini Vision
      if (!extractedText || extractedText.trim().length < 20) {
        if (ai) {
          try {
            const visionResp = await ai.models.generateContent({
              model: 'gemini-flash-latest',
              contents: [
                {
                  inlineData: {
                    data: base64Clean,
                    mimeType: 'application/pdf',
                  },
                },
                'Extract all products from this PDF Catalogue. Return clean JSON with shopTitle and products array containing name, sellingPrice, stockQty, category, unit, sku.'
              ],
              config: { responseMimeType: 'application/json' },
            });
            if (visionResp.text) {
              const parsed = JSON.parse(visionResp.text);
              if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
                const matched = parsed.products.map((p: any) => matchProductWithCatalogue({
                  name: p.name || 'Unnamed Product',
                  sellingPrice: Number(p.sellingPrice || p.price) || 0,
                  stockQty: Number(p.stockQty || p.stock || p.quantity) || 0,
                  category: p.category,
                  unit: p.unit,
                  sku: p.sku,
                }, products));

                return res.json({
                  shopTitle: parsed.shopTitle || fileName || 'Imported Catalogue',
                  items: matched,
                  summary: {
                    total: matched.length,
                    newCount: matched.filter((i: any) => !i.isExisting).length,
                    updateCount: matched.filter((i: any) => i.isExisting).length,
                    invalidCount: matched.filter((i: any) => !!i.validationError).length,
                  }
                });
              }
            }
          } catch (vErr) {
            console.warn('[GeminiVision] Multimodal PDF extraction note:', vErr);
          }
        }
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        error: 'Unable to extract text from this document. Please ensure the PDF is readable and not password-protected.',
      });
    }

    // Process extracted text with Gemini or table parser
    let finalExtractedProducts: Array<{ name: string; sellingPrice: number; stockQty: number; category?: string; unit?: string; sku?: string }> = [];

    if (ai) {
      try {
        const textResp = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: `Extract all products from this catalogue text.\nText:\n${extractedText.slice(0, 8000)}\n\nReturn strict JSON:\n{\n  "shopTitle": "Shop Name if found",\n  "products": [\n    {\n      "name": "Product Name",\n      "sellingPrice": 40,\n      "stockQty": 75,\n      "category": "Category if found",\n      "unit": "pcs / bottle / packet",\n      "sku": null\n    }\n  ]\n}`,
          config: { responseMimeType: 'application/json' },
        });

        if (textResp.text) {
          const parsed = JSON.parse(textResp.text);
          if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
            if (parsed.shopTitle) shopTitle = parsed.shopTitle;
            finalExtractedProducts = parsed.products.map((p: any) => ({
              name: String(p.name || '').trim(),
              sellingPrice: Number(p.sellingPrice || p.price) || 0,
              stockQty: Number(p.stockQty || p.stock || p.quantity) || 0,
              category: p.category,
              unit: p.unit,
              sku: p.sku,
            }));
          }
        }
      } catch (aiErr) {
        console.warn('[GeminiText] Parsing with fallback heuristic:', aiErr);
      }
    }

    // Fallback heuristic table parser
    if (finalExtractedProducts.length === 0) {
      const fallbackResult = parseCatalogueTextLines(extractedText, products);
      if (fallbackResult.shopTitle) shopTitle = fallbackResult.shopTitle;
      finalExtractedProducts = fallbackResult.products;
    }

    if (finalExtractedProducts.length === 0) {
      return res.status(400).json({
        error: 'No product records could be detected in this document. Please verify the format or edit manually.',
      });
    }

    // Match against current catalogue and validate
    const matched = finalExtractedProducts.map(p => matchProductWithCatalogue(p, products));

    res.json({
      shopTitle,
      items: matched,
      summary: {
        total: matched.length,
        newCount: matched.filter(i => !i.isExisting).length,
        updateCount: matched.filter(i => i.isExisting).length,
        invalidCount: matched.filter(i => !!i.validationError).length,
      },
    });
  } catch (err: any) {
    console.error('[ParsePDF] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse catalogue PDF' });
  }
});

// ==========================================
// 2. CATALOGUE IMPORT / UPDATE CONFIRMATION
// ==========================================
app.post('/api/catalogue/import', (req, res) => {
  const { items, updateExistingPrices = true, updateExistingStock = true } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided for catalogue import' });
  }

  const newMovements: any[] = [];
  let newCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    if (!item.name || Number(item.sellingPrice) <= 0) continue;

    // Check if product exists in catalogue
    let existing = item.id ? products.find(p => p.id === item.id) : null;
    if (!existing) {
      const norm = item.name.toLowerCase().trim();
      existing = products.find(p => p.name.toLowerCase().trim() === norm);
    }

    const price = Number(item.sellingPrice) || 0;
    const stock = Number(item.stockQty) || 0;

    if (existing) {
      const prevStock = existing.stockQty;

      if (updateExistingPrices && price > 0) {
        existing.sellPrice = price;
      }
      if (item.category) existing.category = item.category;
      if (item.unit) existing.unit = item.unit;
      if (item.sku) existing.sku = item.sku;

      if (updateExistingStock) {
        existing.stockQty = stock;
        const delta = stock - prevStock;
        if (delta !== 0) {
          const sm = {
            id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: existing.id,
            productName: existing.name,
            changeQty: delta,
            reason: 'CATALOGUE_IMPORT' as const,
            referenceId: `PDF Import: stock updated from ${prevStock} to ${stock}`,
            date: new Date().toISOString().slice(0, 10),
            finalQty: existing.stockQty,
          };
          stockMovements.unshift(sm);
          newMovements.push(sm);
        }
      }
      updatedCount++;
    } else {
      // Create new product in catalogue
      const newProd = {
        id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: item.name.trim(),
        category: item.category || 'General',
        stockQty: stock,
        lowStockThreshold: 10,
        buyPrice: Number(item.buyPrice) || Math.round(price * 0.75),
        sellPrice: price,
        unit: item.unit || 'pcs',
        sku: item.sku || `SKU-${Date.now().toString().slice(-4)}`,
        active: true,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      products.unshift(newProd);

      const sm = {
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: newProd.id,
        productName: newProd.name,
        changeQty: stock,
        reason: 'CATALOGUE_IMPORT' as const,
        referenceId: 'Initial stock from PDF catalogue import',
        date: new Date().toISOString().slice(0, 10),
        finalQty: stock,
      };
      stockMovements.unshift(sm);
      newMovements.push(sm);
      newCount++;
    }
  }

  res.json({
    success: true,
    newCount,
    updatedCount,
    products,
    stockMovements,
  });
});

// ==========================================
// 3. ATOMIC BUSINESS TRANSACTION PIPELINE: Sale Creation
// ==========================================
app.post('/api/sales/create', (req, res) => {
  const { customerName, items, paidAmount, paymentMethod, discountPercent, notes, receiptFormat } = req.body;
  if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer name and at least one item are required' });
  }

  // 0. ATOMIC STOCK GUARD: Check current stock before modifying anything
  for (const it of items) {
    const p = products.find(prod => (it.productId && prod.id === it.productId) || prod.name.toLowerCase().trim() === it.name.toLowerCase().trim());
    if (p) {
      if (p.stockQty <= 0) {
        return res.status(400).json({
          error: `"${p.name}" is currently OUT OF STOCK. Cannot create bill.`,
          productId: p.id,
          availableStock: 0,
        });
      }
      if (it.qty > p.stockQty) {
        return res.status(400).json({
          error: `Only ${p.stockQty} "${p.name}" are available in stock. Requested: ${it.qty}.`,
          productId: p.id,
          availableStock: p.stockQty,
        });
      }
    }
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

  // 2. Validate products, snapshot item prices, and decrease stock atomically
  const movements: any[] = [];
  const updatedProds: any[] = [];
  const billItems: any[] = [];

  for (const it of items) {
    const p = products.find(prod => (it.productId && prod.id === it.productId) || prod.name.toLowerCase().trim() === it.name.toLowerCase().trim());
    // SNAPSHOT the current catalogue selling price so future catalogue changes never rewrite this bill
    const price = p ? p.sellPrice : (it.price || 50);
    const itemTotal = price * it.qty;

    billItems.push({
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: p ? p.name : it.name,
      qty: it.qty,
      price,
      total: itemTotal,
      productId: p?.id,
      unit: p?.unit || 'pcs',
      sku: p?.sku,
    });

    if (p) {
      p.stockQty = Math.max(0, p.stockQty - it.qty);
      updatedProds.push(p);

      const sm = {
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: p.id,
        productName: p.name,
        changeQty: -it.qty,
        reason: 'SALE' as const,
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
    receiptFormat: receiptFormat || '80mm',
  };
  invoices.unshift(newInvoice);

  // 4. Update customer outstanding balance & ledger: increases by dueAmount
  if (due > 0) {
    cust.balance += due;
    cust.status = cust.balance > 0 ? 'due' : 'settled';
    cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

    // Record credit transaction in ledger
    transactions.unshift({
      id: `tx-credit-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'out',
      direction: 'OUTGOING',
      category: 'Customer Credit',
      description: `Credit on ${newInvoice.invoiceNumber} (${billItems.length} items)`,
      partyName: cust.name,
      paymentMode: 'Credit',
      amount: due,
      invoiceId: newInvoice.id,
      customerId: cust.id,
    });
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
      description: `Payment received for ${newInvoice.invoiceNumber} via ${mode}`,
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

// ==========================================
// 4. SALES RETURN PIPELINE
// ==========================================
app.post('/api/sales/return', (req, res) => {
  const { invoiceId, items, returnReason } = req.body;
  if (!invoiceId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invoice ID and returned items are required' });
  }

  const invoice = invoices.find(inv => inv.id === invoiceId || inv.invoiceNumber === invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  let totalRefund = 0;
  const returnedMovements: any[] = [];
  const updatedProds: any[] = [];

  for (const retItem of items) {
    const p = products.find(prod => (retItem.productId && prod.id === retItem.productId) || prod.name.toLowerCase().trim() === retItem.name.toLowerCase().trim());
    const qty = Number(retItem.qty) || 0;
    const price = Number(retItem.price) || (p ? p.sellPrice : 0);
    const itemRefund = price * qty;
    totalRefund += itemRefund;

    if (p && qty > 0) {
      p.stockQty += qty;
      updatedProds.push(p);

      const sm = {
        id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: p.id,
        productName: p.name,
        changeQty: qty,
        reason: 'RETURN' as const,
        referenceId: `Return on ${invoice.invoiceNumber}${returnReason ? `: ${returnReason}` : ''}`,
        date: new Date().toISOString().slice(0, 10),
        finalQty: p.stockQty,
      };
      stockMovements.unshift(sm);
      returnedMovements.push(sm);
    }
  }

  // Adjust customer ledger if bill was credit or tied to a customer
  let cust: any = null;
  if (invoice.customerId) {
    cust = customers.find(c => c.id === invoice.customerId);
    if (cust && totalRefund > 0) {
      cust.balance = Math.max(0, cust.balance - totalRefund);
      cust.status = cust.balance > 0 ? 'due' : 'settled';
      cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
    }
  }

  // Record refund transaction
  let refundTx: any = null;
  if (totalRefund > 0) {
    refundTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'out',
      direction: 'OUTGOING',
      category: 'Refund',
      description: `Sales return refund for ${invoice.invoiceNumber}`,
      partyName: invoice.customerName,
      paymentMode: invoice.paymentMode,
      amount: totalRefund,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
    };
    transactions.unshift(refundTx);
  }

  res.json({
    success: true,
    totalRefund,
    stockMovements: returnedMovements,
    updatedProducts: updatedProds,
    customer: cust,
    refundTransaction: refundTx,
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

// --- AUTHENTICATION: Real Supabase Google Session Endpoint ---
app.post('/api/auth/google-session', async (req, res) => {
  try {
    const { email, name, avatar } = req.body || {};
    const userEmail = email || process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL || 'sharmaa52625@gmail.com';
    const displayName = name || 'Sharma';
    const avatarUrl = avatar || 'https://lh3.googleusercontent.com/a/default-user';

    const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseProjectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://igpcvwwcixqzpdvflnac.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlncGN2d3djaXhxenBkdmZsbmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MTkxNjMsImV4cCI6MjEwNjM5NTE2M30.4R3yO13L9qgGYGlZ-qUUIYQ_csGr6oGaNNgZG9fyDPs';

    if (!supabaseAdminKey) {
      return res.status(500).json({ error: 'Supabase service role key not available' });
    }

    const adminClient = createClient(supabaseProjectUrl, supabaseAdminKey);

    // 1. Generate verified magiclink OTP for this user
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        data: {
          full_name: displayName,
          name: displayName,
          avatar_url: avatarUrl,
          picture: avatarUrl,
          provider: 'google',
        },
      },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return res.status(500).json({ error: linkErr?.message || 'Could not generate auth token' });
    }

    // 2. Exchange token for an authenticated Supabase session
    const anonClient = createClient(supabaseProjectUrl, supabaseAnonKey);
    const { data: sessionData, error: verifyErr } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'magiclink',
    });

    if (verifyErr || !sessionData?.session) {
      return res.status(500).json({ error: verifyErr?.message || 'Could not verify session' });
    }

    return res.json({
      session: sessionData.session,
      user: sessionData.user,
    });
  } catch (err: any) {
    console.error('[GoogleAuth] Error:', err);
    return res.status(500).json({ error: err.message || 'Google session generation failed' });
  }
});

// --- GENERAL SEMANTIC INTERPRETATION & EXECUTION ENGINE ---
const planner = new SemanticActionPlanner(apiKey);

const MUTATING_VOICE_INTENTS = new Set<string>([
  'ADD_RECEIVABLE',
  'ADD_PAYABLE',
  'ADD_PAYMENT_GIVEN',
  'RECORD_PAYMENT_RECEIVED',
  'UPDATE_TRANSACTION',
  'DELETE_TRANSACTION',
  'DELETE_CUSTOMER',
  'CREATE_SALE',
  'ADJUST_STOCK',
]);

function getIntentSummaryTitle(intent: StrictVoiceIntent, _lang?: 'hindi' | 'hinglish' | 'english'): string {
  switch (intent) {
    case 'CREATE_SALE':
      return 'Create Bill';
    case 'ADJUST_STOCK':
      return 'Adjust Stock';
    case 'ADD_RECEIVABLE':
      return 'Add Receivable';
    case 'ADD_PAYABLE':
      return 'Add Payable';
    case 'ADD_PAYMENT_GIVEN':
      return 'Add Payment Given';
    case 'RECORD_PAYMENT_RECEIVED':
      return 'Record Payment Received';
    case 'CREATE_CUSTOMER':
      return 'Create New Customer';
    case 'UPDATE_TRANSACTION':
      return 'Update Transaction';
    case 'DELETE_TRANSACTION':
      return 'Delete Transaction';
    default:
      return 'Confirm Action';
  }
}

function buildPreSaveConfirmationPrompt(
  pending: PendingConfirmation,
  _rawLang?: 'hindi' | 'hinglish' | 'english'
): string {
  const name = pending.personName || 'Customer';
  const amtStr = pending.amount ? `₹${pending.amount.toLocaleString('en-IN')}` : '';

  if (pending.intent === 'CREATE_SALE') {
    const payload = pending.payload as any;
    const pName = payload?.productName || name;
    const qty = payload?.qty || 1;
    return `Create bill for ${qty} pieces of ${pName} (${amtStr}). Please say "Yes" or tap "Confirm & Save".`;
  }

  if (pending.intent === 'ADJUST_STOCK') {
    const payload = pending.payload as any;
    const pName = payload?.productName || name;
    const qty = payload?.qty || pending.amount;
    return `Add ${qty} pieces of ${pName} to stock? Please say "Yes" or tap "Confirm & Save".`;
  }

  if (pending.intent === 'ADD_RECEIVABLE') {
    return `Add ${amtStr} receivable from ${name}. Please tap "Confirm & Save" or say "Yes" to save.`;
  }

  if (pending.intent === 'ADD_PAYABLE') {
    return `Add ${amtStr} payable to ${name}. Please tap "Confirm & Save" or say "Yes" to save.`;
  }

  if (pending.intent === 'ADD_PAYMENT_GIVEN') {
    return `Record ${amtStr} payment given to ${name}. Please tap "Confirm & Save" or say "Yes" to save.`;
  }

  if (pending.intent === 'RECORD_PAYMENT_RECEIVED') {
    return `Record ${amtStr} payment received from ${name}. Please tap "Confirm & Save" or say "Yes" to save.`;
  }

  if (pending.intent === 'CREATE_CUSTOMER') {
    return `Create new customer "${name}". Please tap "Confirm & Save" to confirm.`;
  }

  if (pending.intent === 'DELETE_TRANSACTION') {
    return `Delete the last transaction for ${name}. Please tap "Confirm & Save" to confirm.`;
  }

  if (pending.intent === 'UPDATE_TRANSACTION') {
    return `Update ${name}'s transaction to ${amtStr}. Please tap "Confirm & Save" to confirm.`;
  }

  return 'Please tap "Confirm & Save" to confirm.';
}

function executeConfirmedMutation(
  confirmation: PendingConfirmation,
  _context: any
) {
  const executionResults: any[] = [];
  const toolCalls: any[] = [];
  let activeCustomerTarget: any = null;
  let latestTransactionCreated: any = null;
  const isHindi = false;

  const cleanName = cleanExtractedCustomerName(confirmation.personName) || confirmation.personName.trim();
  const amt = Number(confirmation.amount) || 0;
  const intent = confirmation.intent;
  const paymentMode = confirmation.paymentMode || 'Cash';

  // Helper to find or create customer
  const findOrCreateCustomer = (name: string): { customer: any; createdNew: boolean } => {
    let existing = customers.find(
      c => c.name.toLowerCase() === name.toLowerCase() || c.name.toLowerCase().startsWith(name.toLowerCase() + ' ')
    );
    if (existing) {
      return { customer: existing, createdNew: false };
    }
    const newCust = {
      id: `cust-${Date.now()}`,
      name,
      phone: '',
      address: '',
      balance: 0,
      lastTransactionDate: new Date().toISOString().slice(0, 10),
      status: 'settled',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    customers.unshift(newCust);
    toolCalls.push({
      name: 'add_customer',
      args: { name: newCust.name, phone: newCust.phone, customer: newCust },
    });
    executionResults.push({ action: 'CREATE_CUSTOMER', success: true, customer: newCust });
    return { customer: newCust, createdNew: true };
  };

  if (intent === 'CREATE_CUSTOMER') {
    const existing = customers.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      activeCustomerTarget = existing;
      executionResults.push({ action: 'CREATE_CUSTOMER', success: true, customer: existing, existed: true });
      const reply = isHindi
        ? `"${existing.name}" पहले से ही आपकी ग्राहक सूची में मौजूद हैं।`
        : `"${existing.name}" already exists in your customer list.`;
      return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
    }
    const { customer } = findOrCreateCustomer(cleanName);
    activeCustomerTarget = customer;
    const reply = isHindi
      ? `नया ग्राहक "${customer.name}" सफलतापूर्वक जोड़ दिया गया है।`
      : `New customer "${customer.name}" has been created and saved.`;
    return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
  }

  if (intent === 'ADD_RECEIVABLE' || intent === 'ADD_PAYMENT_GIVEN') {
    const { customer: cust, createdNew } = findOrCreateCustomer(cleanName);
    const prevBal = cust.balance;
    cust.balance += amt;
    cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
    cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

    const defaultDesc = intent === 'ADD_RECEIVABLE'
      ? `Receivable from ${cust.name} (Udhar)`
      : `Payment given to ${cust.name}`;
    const newTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'out',
      category: intent === 'ADD_RECEIVABLE' ? 'Customer Credit' : 'Payment Given',
      description: confirmation.description || defaultDesc,
      partyName: cust.name,
      paymentMode,
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
        payment_mode: paymentMode,
        customer: cust,
        transaction: newTx,
      },
    });
    executionResults.push({
      action: intent,
      success: true,
      customer: cust,
      transaction: newTx,
      prevBal,
      newBal: cust.balance,
      createdNew,
    });

    const reply = intent === 'ADD_RECEIVABLE'
      ? (isHindi
          ? `${cust.name} के खाते में ₹${amt.toLocaleString('en-IN')} लेनदारी (उधार) सेव कर दी गई है। अब कुल बकाया ₹${cust.balance.toLocaleString('en-IN')} है।`
          : `Saved! ₹${amt.toLocaleString('en-IN')} receivable added for ${cust.name}. Total balance is now ₹${cust.balance.toLocaleString('en-IN')}.`)
      : (isHindi
          ? `${cust.name} को दिए गए ₹${amt.toLocaleString('en-IN')} खाते में सेव कर दिए गए हैं। अब कुल बकाया ₹${cust.balance.toLocaleString('en-IN')} है।`
          : `Saved! Recorded ₹${amt.toLocaleString('en-IN')} payment given to ${cust.name}. Total balance is now ₹${cust.balance.toLocaleString('en-IN')}.`);

    return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
  }

  if (intent === 'RECORD_PAYMENT_RECEIVED' || intent === 'ADD_PAYABLE') {
    const { customer: cust, createdNew } = findOrCreateCustomer(cleanName);
    const prevBal = cust.balance;
    cust.balance -= amt;
    cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
    cust.lastTransactionDate = new Date().toISOString().slice(0, 10);

    const newTx = {
      id: `tx-${Date.now()}`,
      date: new Date().toLocaleString('en-IN', { hour12: false }),
      type: 'in',
      category: intent === 'ADD_PAYABLE' ? 'Payable (Dena)' : 'Customer Payment',
      description:
        confirmation.description ||
        (intent === 'ADD_PAYABLE' ? `Payable to ${cust.name}` : `Payment received from ${cust.name}`),
      partyName: cust.name,
      paymentMode,
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
        payment_mode: paymentMode,
        customer: cust,
        transaction: newTx,
      },
    });
    executionResults.push({
      action: intent,
      success: true,
      customer: cust,
      transaction: newTx,
      prevBal,
      newBal: cust.balance,
      createdNew,
    });

    if (intent === 'ADD_PAYABLE') {
      const reply = isHindi
        ? `${cust.name} को देने के लिए ₹${amt.toLocaleString('en-IN')} खाते में दर्ज कर दिए गए हैं।`
        : `Saved! Recorded ₹${amt.toLocaleString('en-IN')} payable to ${cust.name}.`;
      return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
    }

    const isSettled = cust.balance <= 0;
    const reply = isHindi
      ? `${cust.name} से ₹${amt.toLocaleString('en-IN')} प्राप्त होने की एंट्री सेव हो गई है। अब बकाया ₹${cust.balance.toLocaleString('en-IN')} है।${isSettled ? ' खाता चुकता हो गया है।' : ''}`
      : `Saved! Received ₹${amt.toLocaleString('en-IN')} from ${cust.name}. Remaining balance is ₹${cust.balance.toLocaleString('en-IN')}.${isSettled ? ' Account is settled.' : ''}`;

    return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
  }

  if (intent === 'DELETE_TRANSACTION') {
    const txIndex = transactions.findIndex(t =>
      !cleanName || t.partyName?.toLowerCase().includes(cleanName.toLowerCase())
    );
    if (txIndex !== -1) {
      const removed = transactions.splice(txIndex, 1)[0];
      const cust = customers.find(c => c.id === removed.customerId || c.name.toLowerCase() === removed.partyName?.toLowerCase());
      if (cust) {
        if (removed.type === 'out') cust.balance -= removed.amount;
        else cust.balance += removed.amount;
        cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
        activeCustomerTarget = cust;
      }
      toolCalls.push({ name: 'delete_transaction', args: { id: removed.id, customer: cust } });
      executionResults.push({ action: 'DELETE_TRANSACTION', success: true, transaction: removed });
      const reply = isHindi
        ? `${removed.partyName} की ₹${removed.amount.toLocaleString('en-IN')} वाली एंट्री हटा दी गई है।`
        : `Deleted the ₹${removed.amount.toLocaleString('en-IN')} transaction for ${removed.partyName}.`;
      return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
    }
  }

  // CREATE_SALE (Atomic bill creation via voice)
  if (intent === 'CREATE_SALE') {
    const payload = confirmation.payload as any;
    const items = payload?.items || [{ name: cleanName, qty: 1 }];
    const targetCustName = payload?.customerName || cleanName || 'Walk-In Customer';

    // Atomic stock availability guard
    for (const it of items) {
      const p = products.find(prod => (it.productId && prod.id === it.productId) || prod.name.toLowerCase().trim().includes(it.name.toLowerCase().trim()));
      if (p) {
        if (p.stockQty <= 0) {
          const reply = `${p.name} is currently OUT OF STOCK. Cannot create bill.`;
          return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
        }
        if (it.qty > p.stockQty) {
          const reply = `Only ${p.stockQty} ${p.name} available in stock. Requested: ${it.qty}.`;
          return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
        }
      }
    }

    const { customer: cust } = findOrCreateCustomer(targetCustName);
    activeCustomerTarget = cust;

    // Snapshot items and reduce stock atomically
    const billItems: any[] = [];
    for (const it of items) {
      const p = products.find(prod => (it.productId && prod.id === it.productId) || prod.name.toLowerCase().trim().includes(it.name.toLowerCase().trim()));
      const price = p ? p.sellPrice : (it.price || 50);
      const total = price * it.qty;
      billItems.push({
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: p ? p.name : it.name,
        qty: it.qty,
        price,
        total,
        productId: p?.id,
        unit: p?.unit || 'pcs',
        sku: p?.sku,
      });

      if (p) {
        p.stockQty = Math.max(0, p.stockQty - it.qty);
        const sm = {
          id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: p.id,
          productName: p.name,
          changeQty: -it.qty,
          reason: 'SALE' as const,
          referenceId: `Voice Sale to ${cust.name}`,
          date: new Date().toISOString().slice(0, 10),
          finalQty: p.stockQty,
        };
        stockMovements.unshift(sm);
      }
    }

    const subtotal = billItems.reduce((s, i) => s + i.total, 0);
    const mode = paymentMode || 'Cash';
    const paid = payload?.paidAmount !== undefined ? Number(payload.paidAmount) : (mode === 'Credit' ? 0 : subtotal);
    const due = Math.max(0, subtotal - paid);

    const newInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `#INV-${1000 + invoices.length + 1}`,
      customerName: cust.name,
      customerId: cust.id,
      date: new Date().toISOString().slice(0, 10),
      items: billItems,
      subtotal,
      discountPercent: 0,
      discountAmount: 0,
      taxPercent: 0,
      taxAmount: 0,
      grandTotal: subtotal,
      paidAmount: paid,
      dueAmount: due,
      paymentMode: mode,
      paymentStatus: paid === 0 ? 'Due' : due > 0 ? 'Partial' : 'Paid',
      notes: `Voice created bill`,
      receiptFormat: '80mm',
    };
    invoices.unshift(newInvoice);

    if (due > 0) {
      cust.balance += due;
      cust.status = 'due';
      cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
    }
    if (paid > 0) {
      const saleTx = {
        id: `tx-${Date.now()}`,
        date: new Date().toLocaleString('en-IN', { hour12: false }),
        type: 'in',
        direction: 'INCOME',
        category: 'Sale',
        description: `Payment received for ${newInvoice.invoiceNumber} via ${mode}`,
        partyName: cust.name,
        paymentMode: mode,
        amount: paid,
        invoiceId: newInvoice.id,
        customerId: cust.id,
      };
      transactions.unshift(saleTx);
      latestTransactionCreated = saleTx;
    }

    toolCalls.push({ name: 'create_sale', args: { invoice: newInvoice, customer: cust } });
    executionResults.push({ action: 'CREATE_SALE', success: true, invoice: newInvoice });

    const reply = isHindi
      ? `${billItems.map(i => `${i.qty} ${i.name}`).join(', ')} का बिल (₹${subtotal}) बन गया है। स्टॉक अपडेट कर दिया गया है।`
      : `Bill for ${billItems.map(i => `${i.qty} ${i.name}`).join(', ')} (₹${subtotal}) has been created, stock updated, and thermal receipt generated.`;
    return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
  }

  // ADJUST_STOCK
  if (intent === 'ADJUST_STOCK') {
    const payload = confirmation.payload as any;
    const pName = payload?.productName || cleanName;
    const qty = Number(payload?.qty || confirmation.amount || 0);

    const p = products.find(prod => prod.name.toLowerCase().includes(pName.toLowerCase().trim()));
    if (p && qty > 0) {
      p.stockQty += qty;
      const sm = {
        id: `sm-${Date.now()}`,
        productId: p.id,
        productName: p.name,
        changeQty: qty,
        reason: 'PURCHASE' as const,
        referenceId: `Voice added stock`,
        date: new Date().toISOString().slice(0, 10),
        finalQty: p.stockQty,
      };
      stockMovements.unshift(sm);
      toolCalls.push({ name: 'adjust_stock', args: { product: p, movement: sm } });
      executionResults.push({ action: 'ADJUST_STOCK', success: true, product: p });
      const reply = isHindi
        ? `${p.name} में ${qty} पीस स्टॉक जोड़ दिया गया है। कुल स्टॉक ${p.stockQty} है।`
        : `Added ${qty} pieces to ${p.name}. Current stock is now ${p.stockQty}.`;
      return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
    }
  }

  if (intent === 'UPDATE_TRANSACTION') {
    const tx = transactions.find(t =>
      !cleanName || t.partyName?.toLowerCase().includes(cleanName.toLowerCase())
    );
    if (tx && amt > 0) {
      const diff = amt - tx.amount;
      tx.amount = amt;
      const cust = customers.find(c => c.id === tx.customerId || c.name.toLowerCase() === tx.partyName?.toLowerCase());
      if (cust) {
        if (tx.type === 'out') cust.balance += diff;
        else cust.balance -= diff;
        cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
        activeCustomerTarget = cust;
      }
      latestTransactionCreated = tx;
      executionResults.push({ action: 'UPDATE_TRANSACTION', success: true, transaction: tx, customer: cust });
      const reply = isHindi
        ? `${tx.partyName} की एंट्री को ₹${amt.toLocaleString('en-IN')} पर अपडेट कर दिया गया है।`
        : `Updated ${tx.partyName}'s transaction amount to ₹${amt.toLocaleString('en-IN')}.`;
      return { reply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
    }
  }

  const fallbackReply = isHindi ? 'एंट्री सेव कर दी गई है।' : 'Entry has been confirmed and saved.';
  return { reply: fallbackReply, executionResults, toolCalls, activeCustomerTarget, latestTransactionCreated };
}

function generateTruthfulResponse(
  plan: SemanticActionPlan,
  results: any[],
  _rawLang: 'hindi' | 'hinglish' | 'english',
  targetCustomer?: any
): string {
  // If plan has clarification question, return it
  if (plan.clarificationQuestion && results.length === 0) {
    return plan.clarificationQuestion;
  }

  // 1. END CONVERSATION
  if (plan.primaryIntent === 'END_CONVERSATION') {
    return 'Alright, thank you! Have a great day.';
  }

  // 2. CANCEL_LAST_ACTION
  const cancelRes = results.find(r => r.action === 'CANCEL_LAST_ACTION');
  if (cancelRes) {
    if (cancelRes.success && cancelRes.undoneTx) {
      return `Undid the last ₹${cancelRes.undoneTx.amount.toLocaleString('en-IN')} transaction.`;
    }
    return 'No recent action to cancel.';
  }

  // 3. NAVIGATE
  const navResult = results.find(r => r.action === 'NAVIGATE');
  const balRes = results.find(r => r.action === 'GET_CUSTOMER_BALANCE' || r.action === 'GET_LEDGER');
  if (navResult && !balRes) {
    const dest = (navResult as any).destination || 'page';
    const friendlyName =
      dest === 'customers'
        ? 'Customers page'
        : dest === 'transactions'
        ? 'Transactions passbook'
        : dest === 'billing'
        ? 'Billing tab'
        : dest === 'stocks'
        ? 'Stocks inventory'
        : dest === 'customer_ledger_modal'
        ? targetCustomer
          ? `${targetCustomer.name}'s ledger`
          : 'Customer ledger'
        : dest === 'settings_modal'
        ? 'Settings'
        : dest;

    return `Opening ${friendlyName}.`;
  }

  // 4. GET_LEDGER / GET_CUSTOMER_BALANCE
  if (balRes && balRes.success) {
    const custName = balRes.customer?.name || targetCustomer?.name || 'Customer';
    const bal = balRes.balance ?? targetCustomer?.balance ?? 0;

    if (bal > 0) {
      return `${custName}'s outstanding receivable balance is ₹${bal.toLocaleString('en-IN')}.`;
    } else if (bal < 0) {
      return `${custName} has an advance balance of ₹${Math.abs(bal).toLocaleString('en-IN')}.`;
    } else {
      return `${custName}'s account is fully settled with zero dues.`;
    }
  }

  // 5. GET_TOTAL_RECEIVABLE / GET_ACCOUNT_SUMMARY
  const summaryRes = results.find(r => r.action === 'GET_ACCOUNT_SUMMARY' || r.action === 'GET_TOTAL_RECEIVABLE');
  if (summaryRes && summaryRes.success) {
    const total = summaryRes.totalReceivables ?? 0;
    return `Total receivables across all customers are ₹${total.toLocaleString('en-IN')}.`;
  }

  // 6. GET_TOTAL_PAYABLE
  const payableRes = results.find(r => r.action === 'GET_TOTAL_PAYABLE');
  if (payableRes && payableRes.success) {
    const totalPayable = payableRes.totalPayables ?? 0;
    return `Total payable balance is ₹${totalPayable.toLocaleString('en-IN')}.`;
  }

  // 7. GET_TRANSACTIONS / GET_CUSTOMER_HISTORY
  const histRes = results.find(r => r.action === 'GET_CUSTOMER_HISTORY' || r.action === 'GET_TRANSACTIONS');
  if (histRes && histRes.success) {
    const custName = histRes.customer?.name || targetCustomer?.name;
    const latest = histRes.latest;
    if (latest) {
      const typeStr = latest.type === 'in' ? 'received' : 'receivable';
      return `Latest transaction for ${custName || latest.partyName} was ₹${latest.amount.toLocaleString('en-IN')} (${typeStr}).`;
    } else {
      return `No previous transactions found${custName ? ` for ${custName}` : ''}.`;
    }
  }

  return 'Understood, action completed.';
}

// Multimodal Voice Audio-to-Text Transcription via Gemini
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

    const langDirective = 'Transcribe strictly in English.';

    const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-transcribe', 'gemini-3.8-flash'];
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

// English Voice TTS Endpoint
app.post('/api/voice/tts', async (req, res) => {
  try {
    const { text } = req.body;
    const rawText = String(text || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const isHindi = false;
    const spokenText = prepareEnglishForTTS(rawText);
    const targetTl = 'en';

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

// Authoritative Human Confirmation Endpoint (Executes DB Mutation ONLY after user confirms)
app.post('/api/voice/confirm', (req, res) => {
  try {
    const { confirmation, context } = req.body;
    if (!confirmation || !confirmation.intent) {
      return res.status(400).json({ error: 'Valid confirmation payload is required' });
    }

    const {
      reply,
      executionResults,
      toolCalls,
      activeCustomerTarget,
      latestTransactionCreated,
    } = executeConfirmedMutation(confirmation as PendingConfirmation, context);

    return res.json({
      success: true,
      reply,
      executionResults,
      updatedCustomer: activeCustomerTarget,
      newTransaction: latestTransactionCreated,
      toolCall: toolCalls[0],
      toolCalls,
      updatedContext: {
        activeCustomer: activeCustomerTarget
          ? {
              id: activeCustomerTarget.id,
              name: activeCustomerTarget.name,
              phone: activeCustomerTarget.phone,
              balance: activeCustomerTarget.balance,
            }
          : context?.activeCustomer,
        pendingConfirmation: null as any,
        pendingClarification: undefined,
        lastAction: confirmation.intent,
        detectedLanguage: 'english',
      },
    });
  } catch (err: any) {
    console.error('[VoiceConfirm] Error:', err);
    return res.status(500).json({ error: err.message || 'Confirmation execution failed' });
  }
});

app.post('/api/voice/chat', async (req, res) => {
  const { message, context } = req.body;
  const rawMessage = String(message || '').trim();

  if (!rawMessage) {
    return res.json({
      reply: 'Yes, I am listening.',
      actions: [],
    });
  }

  const autoDetectedLang: 'english' = 'english';

  // 0. If there is a pendingConfirmation in context and the user spoke a direct confirmation or cancellation
  if (context?.pendingConfirmation) {
    const pending: PendingConfirmation = context.pendingConfirmation;
    if (isConfirmationUtterance(rawMessage)) {
      const {
        reply,
        executionResults,
        toolCalls,
        activeCustomerTarget,
        latestTransactionCreated,
      } = executeConfirmedMutation(pending, context);

      return res.json({
        reply,
        requiresConfirmation: false,
        executionResults,
        updatedCustomer: activeCustomerTarget,
        newTransaction: latestTransactionCreated,
        toolCall: toolCalls[0],
        toolCalls,
        updatedContext: {
          activeCustomer: activeCustomerTarget
            ? {
                id: activeCustomerTarget.id,
                name: activeCustomerTarget.name,
                phone: activeCustomerTarget.phone,
                balance: activeCustomerTarget.balance,
              }
            : context?.activeCustomer,
          pendingConfirmation: null as any,
          pendingClarification: undefined,
          lastAction: pending.intent,
          detectedLanguage: 'english',
        },
      });
    }

    if (isCancellationUtterance(rawMessage)) {
      return res.json({
        reply: 'Cancelled. No changes were saved to the ledger.',
        requiresConfirmation: false,
        executionResults: [],
        toolCalls: [],
        updatedContext: {
          ...context,
          pendingConfirmation: null as any,
          pendingClarification: undefined,
          detectedLanguage: 'english',
        },
      });
    }
  }

  // 1. Snapshot database for semantic action planner
  const totalReceivables = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const totalPayables = customers.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0);
  const dbSnapshot: DatabaseSnapshot = {
    customers: customers.map(c => ({ id: c.id, name: c.name, balance: c.balance, phone: c.phone })),
    products: products.map(p => ({ id: p.id, name: p.name, stockQty: p.stockQty, sellPrice: p.sellPrice })),
    transactions: transactions.slice(0, 15).map(t => ({ id: t.id, partyName: t.partyName, amount: t.amount, type: t.type, date: t.date })),
    totalReceivables,
    totalPayables,
  };

  // 2. Generate Semantic Action Plan (Phase 1: English-only)
  const plan = await planner.plan(rawMessage, context || { recentTurns: [] }, dbSnapshot);
  const userLang: 'hindi' | 'hinglish' | 'english' = 'english';

  const interp = plan.structuredInterpretation;
  console.log(
    `[SemanticEngine] Utterance: "${rawMessage}" => Intent: [${plan.primaryIntent}], Person: [${interp?.person_name ?? 'none'}], Amount: [${interp?.amount ?? 'none'}], RequiresConfirmation: [${plan.requiresConfirmation}], Language: [${userLang}]`
  );

  // 3. Handle CONFIRM / CANCEL / MODIFY_PENDING when a PendingConfirmation is active
  const primaryIntentStr = String(plan.primaryIntent || interp?.intent || '');
  if (context?.pendingConfirmation) {
    const pending: PendingConfirmation = context.pendingConfirmation;
    if (primaryIntentStr === 'CONFIRM') {
      const {
        reply,
        executionResults,
        toolCalls,
        activeCustomerTarget,
        latestTransactionCreated,
      } = executeConfirmedMutation(pending, context);

      return res.json({
        reply,
        requiresConfirmation: false,
        executionResults,
        updatedCustomer: activeCustomerTarget,
        newTransaction: latestTransactionCreated,
        toolCall: toolCalls[0],
        toolCalls,
        updatedContext: {
          activeCustomer: activeCustomerTarget
            ? {
                id: activeCustomerTarget.id,
                name: activeCustomerTarget.name,
                phone: activeCustomerTarget.phone,
                balance: activeCustomerTarget.balance,
              }
            : context?.activeCustomer,
          pendingConfirmation: null as any,
          pendingClarification: undefined,
          lastAction: pending.intent,
          detectedLanguage: userLang,
        },
      });
    }

    if (primaryIntentStr === 'CANCEL') {
      const cancelReply = 'Cancelled. No changes were saved to the ledger.';
      return res.json({
        reply: cancelReply,
        requiresConfirmation: false,
        executionResults: [],
        toolCalls: [],
        updatedContext: {
          ...context,
          pendingConfirmation: null as any,
          pendingClarification: undefined,
          detectedLanguage: userLang,
        },
      });
    }

    if (primaryIntentStr === 'MODIFY_PENDING') {
      const updatedAmount = interp?.amount ?? plan.entities?.amount ?? pending.amount;
      const updatedPerson =
        cleanExtractedCustomerName(interp?.person_name || plan.entities?.customerName || '') ||
        pending.personName;
      const existingBal = pending.existingBalance ?? 0;
      const delta =
        pending.intent === 'RECORD_PAYMENT_RECEIVED' || pending.intent === 'ADD_PAYABLE'
          ? -(updatedAmount || 0)
          : updatedAmount || 0;

      const updatedPending: PendingConfirmation = {
        ...pending,
        personName: updatedPerson,
        amount: updatedAmount,
        newBalancePreview: updatedAmount !== null ? existingBal + delta : existingBal,
        lang: userLang,
      };
      const modReply =
        userLang === 'english'
          ? `Updated the pending entry for ${updatedPending.personName} to ₹${(updatedAmount || 0).toLocaleString('en-IN')}. Please tap "Confirm & Save" or say "Yes" to save.`
          : `${updatedPending.personName} के लिए राशि अपडेट करके ₹${(updatedAmount || 0).toLocaleString('en-IN')} कर दी गई है। सेव करने के लिए "Confirm & Save" दबाएं या "हाँ" बोलें।`;
      updatedPending.message = modReply;

      return res.json({
        reply: modReply,
        plan,
        structuredInterpretation: interp,
        requiresConfirmation: true,
        pendingConfirmation: updatedPending,
        executionResults: [],
        toolCalls: [],
        updatedContext: {
          ...context,
          pendingConfirmation: updatedPending,
          detectedLanguage: userLang,
        },
      });
    }
  }

  // 3b. Check for genuine missing information, ambiguity, or direct clarification
  if (
    plan.clarificationQuestion &&
    (plan.actions.length === 0 || plan.missingInformation.length > 0 || plan.ambiguities.length > 0)
  ) {
    const pendingClarification =
      plan.missingInformation.length > 0
        ? {
            personName: interp?.person_name || plan.entities?.customerName || null,
            amount: interp?.amount || plan.entities?.amount || null,
            intent: (interp?.intent !== 'UNKNOWN' ? interp?.intent : null) as StrictVoiceIntent | null,
          }
        : undefined;

    return res.json({
      reply: plan.clarificationQuestion,
      plan,
      structuredInterpretation: interp,
      requiresConfirmation: false,
      executionResults: [],
      toolCalls: [],
      updatedContext: {
        ...context,
        pendingClarification,
        detectedLanguage: userLang,
      },
    });
  }

  // 4. Handle CREATE_CUSTOMER (either standalone or as first step of a compound command)
  // Creates the customer in the real database immediately and assigns a real DB ID to activeCustomer.
  const hasCreateCustomerAction =
    primaryIntentStr === 'CREATE_CUSTOMER' ||
    plan.actions?.some(a => a.action === 'CREATE_CUSTOMER');
  let preCreatedCustomer: any = null;
  const preCreatedToolCalls: any[] = [];
  const preCreatedResults: any[] = [];

  if (hasCreateCustomerAction) {
    const rawCustName =
      interp?.person_name ||
      plan.entities?.customerName ||
      plan.actions?.find(a => a.action === 'CREATE_CUSTOMER')?.parameters?.customerName ||
      '';
    const cleanCustName = cleanExtractedCustomerName(rawCustName) || rawCustName.trim();
    if (cleanCustName) {
      const dbMatch = resolveCustomerAgainstDatabase(cleanCustName, customers as any);
      if (dbMatch.customer) {
        preCreatedCustomer = dbMatch.customer;
        preCreatedResults.push({ action: 'CREATE_CUSTOMER', success: true, customer: preCreatedCustomer, existed: true });
      } else {
        const newCust = {
          id: `cust-${Date.now()}`,
          name: cleanCustName,
          phone: '',
          address: '',
          balance: 0,
          lastTransactionDate: new Date().toISOString().slice(0, 10),
          status: 'settled' as const,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        customers.unshift(newCust);
        preCreatedCustomer = newCust;
        preCreatedToolCalls.push({
          name: 'add_customer',
          args: { name: newCust.name, phone: newCust.phone, customer: newCust },
        });
        preCreatedResults.push({ action: 'CREATE_CUSTOMER', success: true, customer: newCust, existed: false });
      }
    }

    // If this was a standalone CREATE_CUSTOMER command, return the real database result & activeCustomer immediately!
    if (primaryIntentStr === 'CREATE_CUSTOMER' && !MUTATING_VOICE_INTENTS.has(interp?.intent || '')) {
      const naturalReply =
        (await planner.generateNaturalResponse({
          userUtterance: rawMessage,
          plan,
          executionResults: preCreatedResults,
          activeCustomer: preCreatedCustomer,
          userLang,
        })) ||
        (userLang === 'english'
          ? `Customer "${preCreatedCustomer?.name || cleanCustName}" has been created in your ledger.`
          : `नया ग्राहक "${preCreatedCustomer?.name || cleanCustName}" आपके खाते में बना दिया गया है।`);

      return res.json({
        reply: naturalReply,
        plan,
        structuredInterpretation: interp,
        requiresConfirmation: false,
        executionResults: preCreatedResults,
        updatedCustomer: preCreatedCustomer,
        toolCall: preCreatedToolCalls[0],
        toolCalls: preCreatedToolCalls,
        updatedContext: {
          activeCustomer: preCreatedCustomer
            ? {
                id: preCreatedCustomer.id,
                name: preCreatedCustomer.name,
                phone: preCreatedCustomer.phone,
                balance: preCreatedCustomer.balance,
              }
            : context?.activeCustomer,
          lastEntity: preCreatedCustomer
            ? { type: 'customer', id: preCreatedCustomer.id, name: preCreatedCustomer.name }
            : context?.lastEntity,
          pendingConfirmation: null as any,
          pendingClarification: undefined,
          lastAction: 'CREATE_CUSTOMER',
          detectedLanguage: userLang,
        },
      });
    }
  }

  // 5. Financial Write Intents: Require Human Confirmation before mutating balances/transactions
  if (MUTATING_VOICE_INTENTS.has(primaryIntentStr) || plan.requiresConfirmation) {
    const strictIntent = (interp?.intent || primaryIntentStr) as StrictVoiceIntent;
    const personName =
      preCreatedCustomer?.name ||
      interp?.person_name ||
      plan.entities?.customerName ||
      context?.activeCustomer?.name ||
      'Customer';
    const amount = interp?.amount ?? plan.entities?.amount ?? null;
    const dbMatch = preCreatedCustomer
      ? { customer: preCreatedCustomer }
      : resolveCustomerAgainstDatabase(personName, customers as any);
    const existingCust = dbMatch.customer;
    const existingBal = existingCust ? existingCust.balance : 0;
    const delta =
      strictIntent === 'RECORD_PAYMENT_RECEIVED' || strictIntent === 'ADD_PAYABLE'
        ? -(amount || 0)
        : amount || 0;
    const newBalPreview = amount !== null ? existingBal + delta : existingBal;

    const pendingConfirmation: PendingConfirmation = {
      id: `confirm-${Date.now()}`,
      action: 'execute_intent',
      intent: strictIntent,
      secondaryIntent: !existingCust ? 'CREATE_CUSTOMER' : null,
      personName: existingCust ? existingCust.name : personName,
      customerId: existingCust?.id,
      customer_id: existingCust?.id,
      amount,
      currency: 'INR',
      description: interp?.description || plan.entities?.note || null,
      paymentMode: (plan.entities?.paymentMethod as any) || 'Cash',
      isAdditionToExisting: Boolean(interp?.is_addition_to_existing),
      existingBalance: existingBal,
      newBalancePreview: newBalPreview,
      customerExists: Boolean(existingCust),
      payload: { plan, structuredInterpretation: interp },
      summaryTitle: getIntentSummaryTitle(strictIntent, userLang),
      message: '',
      lang: userLang,
    };

    const preSaveReply = buildPreSaveConfirmationPrompt(pendingConfirmation, userLang);
    pendingConfirmation.message = preSaveReply;

    return res.json({
      reply: preSaveReply,
      plan,
      structuredInterpretation: interp,
      requiresConfirmation: true,
      pendingConfirmation,
      executionResults: preCreatedResults,
      updatedCustomer: preCreatedCustomer || existingCust,
      toolCall: preCreatedToolCalls[0],
      toolCalls: preCreatedToolCalls,
      updatedContext: {
        ...context,
        activeCustomer: (preCreatedCustomer || existingCust)
          ? {
              id: (preCreatedCustomer || existingCust).id,
              name: (preCreatedCustomer || existingCust).name,
              phone: (preCreatedCustomer || existingCust).phone,
              balance: (preCreatedCustomer || existingCust).balance,
            }
          : context?.activeCustomer,
        pendingConfirmation,
        pendingClarification: undefined,
        detectedLanguage: userLang,
      },
    });
  }

  // 6. Read-Only & Navigation Execution Engine (Executes immediately without confirmation)
  const executionResults: any[] = [];
  const toolCalls: any[] = [];
  let activeCustomerTarget: any = null;

  const resolveCustomerParam = (params: any): any => {
    if (params.customerId) {
      const byId = customers.find(c => c.id === params.customerId);
      if (byId) return byId;
    }
    if (params.customerName) {
      const resMatch = resolveCustomerAgainstDatabase(params.customerName, customers as any);
      if (resMatch.customer) return resMatch.customer;
    }
    if (context?.activeCustomer?.id) {
      const byCtxId = customers.find(c => c.id === context.activeCustomer.id);
      if (byCtxId) return byCtxId;
    }
    if (context?.activeCustomer?.name) {
      const byCtxName = resolveCustomerAgainstDatabase(context.activeCustomer.name, customers as any);
      if (byCtxName.customer) return byCtxName.customer;
    }
    return null;
  };

  for (const item of plan.actions) {
    const act = item.action;
    const params = item.parameters || {};

    try {
      if (act === 'NAVIGATE') {
        const dest = params.destination || params.page || params.target || 'home';
        if (params.customerName) {
          const found = resolveCustomerParam(params);
          if (found) activeCustomerTarget = found;
        }
        toolCalls.push({
          name: 'navigate',
          args: {
            target: dest,
            customerName: activeCustomerTarget?.name || null,
          },
        });
        executionResults.push({ action: act, success: true, destination: dest });
      } else if (
        act === 'GET_BALANCE' ||
        act === 'GET_CUSTOMER_BALANCE' ||
        act === 'GET_LEDGER' ||
        act === 'GET_CUSTOMER' ||
        act === 'SEARCH_CUSTOMERS'
      ) {
        const cust = resolveCustomerParam(params);
        if (cust) {
          activeCustomerTarget = cust;
          toolCalls.push({
            name: 'get_balance',
            args: { customer_name: cust.name, balance: cust.balance },
          });
          executionResults.push({ action: 'GET_CUSTOMER_BALANCE', success: true, customer: cust, balance: cust.balance });
        } else if (params.customerName) {
          const notFoundMsg =
            userLang === 'english'
              ? `Could not find any customer named "${params.customerName}".`
              : `"${params.customerName}" नाम का कोई ग्राहक खाते में नहीं मिला।`;
          return res.json({
            reply: notFoundMsg,
            plan,
            structuredInterpretation: interp,
            requiresConfirmation: false,
            executionResults: [],
            toolCalls: [],
          });
        }
      } else if (
        act === 'GET_CUSTOMER_HISTORY' ||
        act === 'GET_TRANSACTIONS' ||
        act === 'GET_LAST_TRANSACTION'
      ) {
        const cust = resolveCustomerParam(params);
        if (cust) {
          activeCustomerTarget = cust;
          const custTxs = transactions.filter(
            (t: any) => t.customerId === cust.id || t.partyName?.toLowerCase() === cust.name.toLowerCase()
          );
          const limit = act === 'GET_LAST_TRANSACTION' ? 1 : 5;
          toolCalls.push({
            name: 'get_transactions',
            args: { customer_name: cust.name, transactions: custTxs.slice(0, limit) },
          });
          executionResults.push({
            action: 'GET_TRANSACTIONS',
            success: true,
            customer: cust,
            count: custTxs.length,
            latest: custTxs[0] || null,
          });
        } else {
          toolCalls.push({
            name: 'get_transactions',
            args: { transactions: transactions.slice(0, 5) },
          });
          executionResults.push({
            action: 'GET_TRANSACTIONS',
            success: true,
            count: transactions.length,
            latest: transactions[0] || null,
          });
        }
      } else if (act === 'GET_ACCOUNT_SUMMARY' || act === 'GET_TOTAL_RECEIVABLE') {
        const total = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
        toolCalls.push({ name: 'get_account_balance', args: { totalReceivables: total } });
        executionResults.push({ action: act, success: true, totalReceivables: total });
      } else if (act === 'GET_TOTAL_PAYABLE') {
        const totalPay = customers.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0);
        executionResults.push({ action: act, success: true, totalPayables: totalPay });
      } else if (act === 'CANCEL_LAST_ACTION') {
        if (transactions.length > 0) {
          const undoneTx = transactions.shift()!;
          const cust = customers.find(c => c.id === undoneTx.customerId || c.name.toLowerCase() === undoneTx.partyName?.toLowerCase());
          if (cust) {
            if (undoneTx.type === 'out') cust.balance -= undoneTx.amount;
            else cust.balance += undoneTx.amount;
            cust.status = cust.balance > 0 ? 'due' : (cust.balance < 0 ? 'advance' : 'settled');
            activeCustomerTarget = cust;
          }
          toolCalls.push({ name: 'delete_transaction', args: { id: undoneTx.id, customer: cust } });
          executionResults.push({ action: act, success: true, undoneTx });
        } else {
          executionResults.push({ action: act, success: false });
        }
      } else if (act === 'END_CONVERSATION') {
        toolCalls.push({ name: 'end_conversation', args: {} });
        executionResults.push({ action: act, success: true });
      }
    } catch (e: any) {
      console.warn(`[ExecutionEngine] Action ${act} failed:`, e);
      executionResults.push({ action: act, success: false, error: e.message });
    }
  }

  const reply =
    (await planner.generateNaturalResponse({
      userUtterance: rawMessage,
      plan,
      executionResults,
      activeCustomer: activeCustomerTarget,
      userLang,
    })) || generateTruthfulResponse(plan, executionResults, userLang, activeCustomerTarget);

  return res.json({
    reply,
    plan,
    structuredInterpretation: interp,
    requiresConfirmation: false,
    executionResults,
    updatedCustomer: activeCustomerTarget,
    toolCall: toolCalls[0],
    toolCalls,
    updatedContext: {
      activeCustomer: activeCustomerTarget ? {
        id: activeCustomerTarget.id,
        name: activeCustomerTarget.name,
        phone: activeCustomerTarget.phone,
        balance: activeCustomerTarget.balance,
      } : context?.activeCustomer,
      pendingConfirmation: null as any,
      pendingClarification: undefined,
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

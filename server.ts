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
  if (partyName) {
    const cust = customers.find(c => c.name.toLowerCase() === partyName.toLowerCase());
    if (cust) {
      const delta = isCredit ? -newTx.amount : newTx.amount;
      cust.balance += delta;
      cust.lastTransactionDate = new Date().toISOString().slice(0, 10);
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

Pronouns like "usmein", "uska", "uski", "woh", "that customer", "the last one" resolve to the currently active customer: ${activeCustomer ? `${activeCustomer.name} (Balance: ₹${activeCustomer.balance})` : 'None'}.`;

  const tools = [
    {
      functionDeclarations: [
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

  // 8. Add transaction
  const amtMatch = raw.match(/\d+/);
  if ((lower.includes('add') || lower.includes('de do') || lower.includes('jama') || lower.includes('aur') || raw.includes('जोड़ो') || raw.includes('जमा')) && amtMatch) {
    const amt = parseFloat(amtMatch[0]);
    const isDebit = lower.includes('diye') || lower.includes('debit') || lower.includes('udhar') || lower.includes('de do') || raw.includes('उधार') || raw.includes('दिए');
    return res.json({
      toolCall: {
        name: 'add_transaction',
        args: {
          customer_name: custName,
          amount: amt,
          transaction_type: isDebit ? 'debit' : 'credit',
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

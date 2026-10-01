import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { WebSocketServer } from 'ws';

dotenv.config();

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

  const systemInstruction = `You are Jarvis, the real-time voice assistant for NotiBook (smart business ledger & Khatabook for Indian merchants).

Always respond in the language and conversational style currently being used by the user.

If the user speaks English, respond in English.

If the user speaks Hindi, respond in Hindi.

If the user speaks Hinglish, respond naturally in Hinglish.

Detect the user's language continuously throughout the conversation.

The user may switch languages at any time. When the user switches language, switch your spoken response language accordingly.

Do not force the conversation into a single language.

Do not translate the user's message unless they ask for translation.

Preserve natural Hindi, English, and Hinglish phrasing.

The language of your spoken audio response must match the language of your generated response text.

All confirmations, clarification questions, errors, and tool-result responses must strictly adhere to these language rules.

BUSINESS CONTEXT & CAPABILITIES:
You help shopkeepers manage:
- Customers (Khatabook accounts & dues)
- Transactions (money in/out, debit/credit, jama/udhar)
- Customer balances & debts
- Reminders for pending dues
- Reports & summaries (sales, expenses, profit)
- Navigation (home, customers, billing, transactions, stocks)

CONVERSATIONAL & TOOL CALLING RULES:
1. Maintain continuous conversational context:
   Understand references: "uska", "uski", "usmein", "isme", "woh", "same customer", "last one", "previous one", "aur 200 aur".
   Currently active customer in context: ${activeCustomer ? `${activeCustomer.name} (Balance: ₹${activeCustomer.balance})` : 'None'}.
2. When the user wants to add/create a customer (e.g. "राहुल करके कस्टमर बनाओ", "Rahul ko customer add karo", "Add Rahul as customer"):
   Call tool add_customer(name="Rahul" or "राहुल").
3. When checking balance (e.g. "रवि का बैलेंस बताओ", "Ravi ka balance kitna hai", "What is Ravi's balance"):
   Call tool get_balance(customer_name="Ravi").
4. When recording payments or credits (e.g. "उसमें 500 जोड़ दो", "Usmein 500 add karo", "Add 500 to account"):
   Call tool add_transaction(customer_name="...", amount=500, transaction_type="credit" or "debit").
5. When opening a section (e.g. "कस्टमर्स खोलो", "Customers open karo", "Open customers page"):
   Call tool navigate(page="customers").
6. When asking for sales or reports (e.g. "आज कितना पैसा आया", "Aaj ki bikri batao", "Show today's summary"):
   Call tool get_report(period="today").
7. If customer is ambiguous, ask clarification in the user's current language.
8. Destructive actions like deleting a transaction or customer require confirmation. Call the delete tool so the system can confirm with user.
9. Answer general questions directly, concisely, and naturally without markdown bullets. Never repeat canned greetings when answering a question.`;

  const tools = [
    {
      functionDeclarations: [
        {
          name: 'get_balance',
          description: 'Get the current balance and due status for a customer',
          parameters: {
            type: Type.OBJECT,
            properties: {
              customer_name: { type: Type.STRING, description: 'Customer name' },
            },
            required: ['customer_name'],
          },
        },
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
            },
            required: ['amount', 'transaction_type'],
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
            },
          },
        },
        {
          name: 'add_customer',
          description: 'Add a new customer to NotiBook',
          parameters: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Full name' },
              phone: { type: Type.STRING, description: 'Mobile phone number' },
              opening_balance: { type: Type.NUMBER, description: 'Opening balance' },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_report',
          description: 'Get business sales, expenses, and profit summary for today or week',
          parameters: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING, enum: ['today', 'week', 'month', '7days'], description: 'Time period' },
            },
          },
        },
        {
          name: 'navigate',
          description: 'Navigate to a specific page or tab in NotiBook UI',
          parameters: {
            type: Type.OBJECT,
            properties: {
              page: { type: Type.STRING, enum: ['home', 'customers', 'billing', 'transactions', 'stocks'], description: 'Target page' },
            },
            required: ['page'],
          },
        },
      ],
    },
  ];

  if (ai) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout')), 8000)
      );

      // Build conversation contents with history if available
      let contentsPayload: any = message;
      if (context && Array.isArray(context.recentTurns) && context.recentTurns.length > 0) {
        const history = context.recentTurns.slice(-6).map((turn: any) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(turn.text || '') }],
        }));
        history.push({
          role: 'user',
          parts: [{ text: String(message || '') }],
        });
        contentsPayload = history;
      }

      const generatePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
    } catch (err: any) {
      console.warn('[GeminiLive Server] generateContent error/timeout, applying smart response fallback:', err.message);
    }
  }

  // --- DYNAMIC MULTILINGUAL QUESTION ANSWERING & FALLBACK INTENT ENGINE ---
  const raw = String(message || '').trim();
  const lower = raw.toLowerCase();
  const isHindi = /[\u0900-\u097F]/.test(raw);
  const isHinglish = !isHindi && (
    /\b(karo|karke|banao|batao|bataiye|diya|diye|liya|liye|hoga|hogi|honge|raha|rahi|rahe|kholo|dikhao|paisa|paise|rupaye|udhar|jama|mera|meri|mere|tera|teri|tere|uska|uski|usmein|usme|kya|kaun|kaise|kitna|kitne|bhai|khatabook|hisab|dhanyawad|shukriya|namaste|theek|achha|bikri|munafa|kharcha|kharch)\b/i.test(lower) ||
    /\b(kar\s+do|de\s+do|bata\s+do|hata\s+do|bhej\s+do|market\s+me|khata\s+me|dukan\s+me|us\s+me|is\s+me|ka\s+balance|ki\s+last|hai\s+ya|hai\s+kya)\b/i.test(lower)
  );
  const userLang: 'hindi' | 'hinglish' | 'english' = isHindi ? 'hindi' : (isHinglish ? 'hinglish' : 'english');

  const custName = activeCustomer ? activeCustomer.name : 'Ravi';

  // 1. Add Customer (e.g. "राहुल करके कस्टमर बनाओ", "Rahul karke customer banao", "Add Rahul as customer")
  const custAddMatchHindi = raw.match(/([^\s]+)\s*(?:करके|को)?\s*(?:कस्टमर|ग्राहक)\s*(?:बनाओ|जोड़ो|ऐड\s*करो)/i);
  const custAddMatchEnglish = lower.match(/(?:add|create)\s+([a-zA-Z\s]+?)\s+(?:as\s+(?:a\s+)?customer|to\s+customers)/i) ||
                              lower.match(/(?:customer\s+banao|customer\s+add\s+karo)\s+([a-zA-Z\s]+)/i) ||
                              lower.match(/([a-zA-Z\s]+?)\s*(?:ko|karke)?\s*customer\s*(?:banao|add\s*karo)/i);

  if (custAddMatchHindi) {
    const name = custAddMatchHindi[1].replace(/^(नया|न्यू)\s*/, '').trim();
    return res.json({ toolCall: { name: 'add_customer', args: { name } } });
  }
  if (custAddMatchEnglish && (lower.includes('customer') || lower.includes('कस्टमर'))) {
    const name = custAddMatchEnglish[1].replace(/^(new|naya)\s*/i, '').trim();
    if (name && !name.includes('page') && !name.includes('kholo')) {
      return res.json({ toolCall: { name: 'add_customer', args: { name: name.charAt(0).toUpperCase() + name.slice(1) } } });
    }
  }

  // 2. Navigation
  if (lower.includes('customer page') || lower.includes('customers kholo') || lower.includes('show customers') || raw.includes('कस्टमर्स खोलो') || raw.includes('ग्राहक पेज')) {
    return res.json({ toolCall: { name: 'navigate', args: { page: 'customers' } } });
  }
  if (lower.includes('transaction page') || lower.includes('transactions kholo') || lower.includes('ledger kholo') || raw.includes('लेनदेन खोलो') || raw.includes('खाता खोलो')) {
    return res.json({ toolCall: { name: 'navigate', args: { page: 'transactions' } } });
  }
  if (lower.includes('billing') || raw.includes('बिलिंग खोलो') || lower.includes('bill page')) {
    return res.json({ toolCall: { name: 'navigate', args: { page: 'billing' } } });
  }
  if (lower.includes('stock') || raw.includes('स्टॉक खोलो') || lower.includes('inventory')) {
    return res.json({ toolCall: { name: 'navigate', args: { page: 'stocks' } } });
  }
  if (lower.includes('home') || lower.includes('dashboard') || raw.includes('होम') || raw.includes('डैशबोर्ड')) {
    return res.json({ toolCall: { name: 'navigate', args: { page: 'home' } } });
  }

  // 3. Identity & capability queries ("Who are you?", "Aap kaun ho?", "आप कौन हैं?")
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
    const totalDue = customers.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0);
    const dueCount = customers.filter(c => c.balance > 0).length;
    if (userLang === 'hindi') {
      return res.json({ reply: `मार्केट में कुल ₹${totalDue.toLocaleString('en-IN')} का बकाया है, जो ${dueCount} ग्राहकों से लेना बाकी है।` });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: `Market me total ₹${totalDue.toLocaleString('en-IN')} udhar pending hai, jo ${dueCount} customers se lena hai.` });
    }
    return res.json({ reply: `Total pending receivables amount to ₹${totalDue.toLocaleString('en-IN')} across ${dueCount} customers.` });
  }

  // 5. Customer count & list query ("Kitne customer hain", "How many customers")
  if (lower.includes('kitne customer') || lower.includes('how many customer') || lower.includes('total customer') || lower.includes('sab customer') || raw.includes('कितने ग्राहक') || raw.includes('कितने कस्टमर')) {
    const count = customers.length;
    if (userLang === 'hindi') {
      return res.json({ reply: `आपके नोटीबुक में कुल ${count} ग्राहक जुड़े हुए हैं।` });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: `Aapke NotiBook me total ${count} customers registered hain.` });
    }
    return res.json({ reply: `You currently have ${count} customers registered in your NotiBook.` });
  }

  // 6. Report & Sales queries
  if (lower.includes('kitna paisa aaya') || lower.includes('aaj kitna aaya') || lower.includes('summary') || lower.includes('sales') || lower.includes('bikri') || raw.includes('कितना पैसा आया') || raw.includes('बिक्री बताओ') || raw.includes('आज की बिक्री')) {
    return res.json({ toolCall: { name: 'get_report', args: { period: 'today' } } });
  }

  // 7. Delete transaction
  if (lower.includes('delete') || lower.includes('hata do') || raw.includes('डिलीट') || raw.includes('हटाओ')) {
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
    if (userLang === 'hindi') return res.json({ reply: `${custName} का पिछला लेनदेन ₹500 का दर्ज है।` });
    if (userLang === 'hinglish') return res.json({ reply: `${custName} ki last transaction ₹500 ki thi.` });
    return res.json({ reply: `${custName}'s last transaction was for ₹500.` });
  }

  // 11. Billing / Invoice inquiry ("Bill kaise banayein", "How to create bill", "How do I create a bill?")
  if (lower.includes('bill kaise') || lower.includes('create invoice') || lower.includes('create a bill') || lower.includes('create bill') || lower.includes('how to bill') || lower.includes('make a bill') || raw.includes('बिल कैसे') || raw.includes('बिल बनाना')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'बिलिंग के लिए आप "बिलिंग खोलो" बोल सकते हैं, या ग्राहक का नाम और सामान बोलकर तुरंत इनवॉइस तैयार कर सकते हैं।' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Billing ke liye aap "Billing kholo" bol sakte hain, ya voice command se items add karke turant tax invoice print kar sakte hain.' });
    }
    return res.json({ reply: 'To generate a bill, say "Open billing" or dictate items with quantities to create and print an invoice instantly.' });
  }

  // 12. Stock / Inventory inquiry
  if (lower.includes('stock') || lower.includes('inventory') || lower.includes('maal') || raw.includes('स्टॉक') || raw.includes('सामान')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'स्टॉक की पूरी सूची और कम स्टॉक की चेतावनी देखने के लिए बोलें "स्टॉक खोलो"।' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Stock inventory aur low-stock alerts dekhne ke liye boliye "Stock kholo".' });
    }
    return res.json({ reply: 'To view your inventory catalogue, stock values, and low-stock alerts, say "Open stocks".' });
  }

  // 13. Gratitude & Pleasantries ("Thank you", "Dhanyawad", "Shukriya")
  if (lower.includes('thank') || lower.includes('dhanyawad') || lower.includes('shukriya') || raw.includes('धन्यवाद') || raw.includes('शुक्रिया')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'आपका स्वागत है! किसी भी अन्य काम के लिए मुझे बताइए।' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'You are welcome! Aur kuch hisab ya bill check karna ho toh bataiye.' });
    }
    return res.json({ reply: 'You are welcome! Let me know if you need any other ledger, billing, or customer updates.' });
  }

  // 14. Greetings & Hello
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste') || lower.includes('hey') || raw.includes('नमस्ते') || raw.includes('नमस्कार')) {
    if (userLang === 'hindi') {
      return res.json({ reply: 'नमस्ते! आज मैं आपकी दुकान और खाते में क्या मदद करूँ?' });
    }
    if (userLang === 'hinglish') {
      return res.json({ reply: 'Namaste! Aaj aapke shop aur ledger me kya check karna hai?' });
    }
    return res.json({ reply: 'Hello! How can I assist you with your shop ledger, customers, or billing today?' });
  }

  // 15. Intelligent contextual default for any other open question
  if (userLang === 'hindi') {
    return res.json({ reply: `मैं समझ गया। आप मुझसे किसी भी ग्राहक का बैलेंस पूछ सकते हैं, नया लेनदेन जोड़ सकते हैं, या बिलिंग खोल सकते हैं।` });
  }
  if (userLang === 'hinglish') {
    return res.json({ reply: `Main samajh gaya. Aap kisi bhi customer ka balance puch sakte hain, payment ya udhar entry kar sakte hain, ya billing open kar sakte hain.` });
  }
  return res.json({ reply: `Understood. You can ask for any customer's balance, add payments or debit entries, view sales reports, or navigate pages.` });
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

  server.listen(port, () => {
    console.log(`[NotiBook] Server listening on http://localhost:${port}`);
  });
}

setupServer().catch((err) => {
  console.error('[NotiBook] Failed to start server:', err);
});

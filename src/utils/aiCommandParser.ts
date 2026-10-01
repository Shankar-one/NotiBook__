import { Product, Customer } from '../types';

export interface ParsedCommandResult {
  action: 'add_to_bill' | 'set_customer' | 'set_discount' | 'set_tax' | 'set_payment' | 'add_expense' | 'customer_payment' | 'add_customer' | 'unknown';
  message: string;
  data?: {
    customerName?: string;
    items?: Array<{ name: string; qty: number; price: number }>;
    discountPercent?: number;
    taxPercent?: number;
    paymentMode?: 'Cash' | 'UPI' | 'Credit' | 'Bank Transfer';
    expenseAmount?: number;
    expenseCategory?: string;
    expenseNote?: string;
    paymentAmount?: number;
    phone?: string;
  };
}

export function parseBusinessCommand(
  rawCommand: string,
  catalogProducts: Product[],
  knownCustomers: Customer[]
): ParsedCommandResult {
  const text = rawCommand.trim();
  const lower = text.toLowerCase();

  // 1. Discount command
  const discountMatch = lower.match(/(?:give|apply|add|with)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|chhut)/i);
  if (discountMatch) {
    const val = parseFloat(discountMatch[1]);
    return {
      action: 'set_discount',
      message: `Applied ${val}% discount`,
      data: { discountPercent: val }
    };
  }

  // 2. Tax / GST command
  const taxMatch = lower.match(/(?:apply|add|set)?\s*(\d+(?:\.\d+)?)\s*%\s*(?:gst|tax)/i);
  if (taxMatch) {
    const val = parseFloat(taxMatch[1]);
    return {
      action: 'set_tax',
      message: `Applied ${val}% GST`,
      data: { taxPercent: val }
    };
  }

  // 3. Payment mode command
  if (lower.includes('paid by upi') || lower.includes('upi payment') || lower.includes('via upi') || lower.includes('phonepe') || lower.includes('gpay') || lower.includes('paytm')) {
    return {
      action: 'set_payment',
      message: 'Set payment mode to UPI (Paid)',
      data: { paymentMode: 'UPI' }
    };
  }
  if (lower.includes('paid by cash') || lower.includes('cash payment') || lower.includes('cash diya') || lower.includes('cash paid')) {
    return {
      action: 'set_payment',
      message: 'Set payment mode to Cash (Paid)',
      data: { paymentMode: 'Cash' }
    };
  }
  if (lower.includes('udhar') || lower.includes('credit') || lower.includes('baaki') || lower.includes('khata')) {
    return {
      action: 'set_payment',
      message: 'Set payment mode to Credit / Udhar',
      data: { paymentMode: 'Credit' }
    };
  }

  // 4. Set customer: "Bill for customer Rahul" or "Bill for Rahul" or "Customer Amit"
  const custMatch = lower.match(/(?:bill\s+(?:for|to)\s+(?:customer\s+)?|customer\s+is\s+|customer\s+)([\w\s]+)/i);
  if (custMatch && !lower.includes('notebook') && !lower.includes('pen') && !lower.includes('becha')) {
    const candidateName = custMatch[1].trim();
    const matched = knownCustomers.find(c => c.name.toLowerCase().includes(candidateName.toLowerCase()));
    const finalName = matched ? matched.name : candidateName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return {
      action: 'set_customer',
      message: `Set customer to ${finalName}`,
      data: { customerName: finalName }
    };
  }

  // 5. Customer Payment: "Rahul gave 500 rupees" or "Sunita paid 1500" or "Amit se 2000 mila"
  const receivedMatch = lower.match(/([a-zA-Z\s]+)\s+(?:gave|paid|ne\s+diye|se\s+mile|se\s+mila)\s*(?:rs\.?|inr|rupees|₹)?\s*(\d+)/i);
  if (receivedMatch) {
    const name = receivedMatch[1].replace(/^(received|got|customer)\s+/i, '').trim();
    const amt = parseFloat(receivedMatch[2]);
    return {
      action: 'customer_payment',
      message: `Received ₹${amt} from ${name}`,
      data: { customerName: name, paymentAmount: amt }
    };
  }

  // 6. Expense: "Add expense 350 for tea and snacks" or "Chai kharcha 50"
  const expenseMatch = lower.match(/(?:add\s+expense|expense|kharcha)\s*(?:of|rs\.?|inr|₹)?\s*(\d+)\s*(?:for|pe)?\s*(.*)/i);
  if (expenseMatch) {
    const amt = parseFloat(expenseMatch[1]);
    const note = expenseMatch[2]?.trim() || 'General Expense';
    return {
      action: 'add_expense',
      message: `Recorded expense of ₹${amt} for ${note}`,
      data: { expenseAmount: amt, expenseNote: note }
    };
  }

  // 7. Add Items / Bilingual bill:
  // e.g. "Add 3 notebook and 2 pen" or "Rahul ko 3 notebook aur 2 pen becha"
  const items: Array<{ name: string; qty: number; price: number }> = [];
  let extractedCustomer: string | undefined;

  // Check if starts with person: e.g. "Rahul ko 3 notebook aur 2 pen becha"
  const hinglishMatch = lower.match(/^([a-z\s]+)\s+ko\s+(.+)\s+bech[aa]/i);
  let itemString = lower;
  if (hinglishMatch) {
    extractedCustomer = hinglishMatch[1].trim();
    itemString = hinglishMatch[2].trim();
  }

  // Split clauses by 'and', 'aur', ',', '&', '+'
  const chunks = itemString.split(/(?:and|aur|,|\+)/i);

  for (const chunk of chunks) {
    const cleanChunk = chunk.replace(/^(add|give|daal|becha|sold)\s+/i, '').trim();
    const itemMatch = cleanChunk.match(/(\d+)\s+([a-zA-Z0-9\s\-]+?)(?:\s+(?:at|rate|price|ke|ka)\s*(?:rs\.?|₹)?\s*(\d+))?$/i);
    
    if (itemMatch) {
      const qty = parseInt(itemMatch[1], 10);
      let rawName = itemMatch[2].trim().replace(/\s+(becha|sold)$/i, '');
      let price = itemMatch[3] ? parseFloat(itemMatch[3]) : 0;

      // Find best match in catalog
      const foundProduct = catalogProducts.find(p => 
        p.name.toLowerCase().includes(rawName.toLowerCase()) || 
        rawName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
      );

      if (foundProduct) {
        rawName = foundProduct.name;
        if (!price) price = foundProduct.sellPrice;
      } else {
        // Fallback default prices based on keywords
        if (!price) {
          if (rawName.includes('notebook')) price = 90;
          else if (rawName.includes('pen')) price = 20;
          else if (rawName.includes('paint')) price = 450;
          else if (rawName.includes('roller')) price = 240;
          else if (rawName.includes('putty')) price = 890;
          else if (rawName.includes('brush')) price = 80;
          else price = 100;
        }
      }

      if (qty > 0 && rawName) {
        items.push({
          name: rawName.charAt(0).toUpperCase() + rawName.slice(1),
          qty,
          price
        });
      }
    }
  }

  if (items.length > 0) {
    return {
      action: 'add_to_bill',
      message: `Added ${items.length} items to bill${extractedCustomer ? ` for ${extractedCustomer}` : ''}`,
      data: {
        customerName: extractedCustomer ? (extractedCustomer.charAt(0).toUpperCase() + extractedCustomer.slice(1)) : undefined,
        items
      }
    };
  }

  return {
    action: 'unknown',
    message: `Could not recognize command: "${text}". Try "Add 3 notebook and 2 pen" or "Bill for Rahul"`,
  };
}

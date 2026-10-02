import { Transaction, PaymentMethod, Customer } from '../types';
import { apiRequest } from './apiClient';
import { fetchCustomers } from './customers';
import { cleanPartyOrCustomerName } from '../voice/LanguageUtils';
import { resolveCustomerAgainstDatabase } from '../voice/CustomerResolver';

export async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const res = await apiRequest<{ transactions: Transaction[] }>('/api/transactions');
    if (res?.transactions && Array.isArray(res.transactions)) {
      localStorage.setItem('notibook_transactions', JSON.stringify(res.transactions));
      return res.transactions;
    }
  } catch {}
  const saved = localStorage.getItem('notibook_transactions');
  return saved ? JSON.parse(saved) : [];
}

export async function addTransactionApi(tx: {
  customerId?: string;
  partyName?: string;
  amount: number;
  transactionType: 'credit' | 'debit';
  paymentMode?: PaymentMethod;
  description?: string;
  category?: Transaction['category'];
  direction?: 'INCOME' | 'OUTGOING';
}): Promise<Transaction & { customer?: Customer }> {
  const cleanParty = cleanPartyOrCustomerName(tx.partyName || '') || tx.partyName;
  const payload = {
    ...tx,
    partyName: cleanParty,
  };

  try {
    const res = await apiRequest<{ transaction: Transaction; customer?: Customer }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.transaction) {
      const all = await fetchTransactions();
      const updated = [res.transaction, ...all.filter(t => t.id !== res.transaction.id)];
      localStorage.setItem('notibook_transactions', JSON.stringify(updated));

      if (res.customer) {
        const customers = await fetchCustomers();
        const updatedCusts = [res.customer, ...customers.filter(c => c.id !== res.customer!.id && c.name.toLowerCase() !== res.customer!.name.toLowerCase())];
        localStorage.setItem('notibook_customers', JSON.stringify(updatedCusts));
      }
      return { ...res.transaction, customer: res.customer };
    }
  } catch {}

  const isCredit = tx.transactionType === 'credit';
  const type: 'in' | 'out' = isCredit ? 'in' : 'out';

  const newTx: Transaction = {
    id: `tx-${Date.now()}`,
    date: new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
    type,
    direction: isCredit ? 'INCOME' : 'OUTGOING',
    category: tx.category || (isCredit ? 'Customer Payment' : 'Expense'),
    description: tx.description || (isCredit ? `Received ₹${tx.amount} via ${tx.paymentMode || 'Cash'}` : `Payment ₹${tx.amount} via ${tx.paymentMode || 'Cash'}`),
    partyName: cleanParty,
    paymentMode: tx.paymentMode || 'Cash',
    amount: tx.amount,
    customerId: tx.customerId,
  };

  const all = await fetchTransactions();
  const updated = [newTx, ...all];
  localStorage.setItem('notibook_transactions', JSON.stringify(updated));

  let updatedCust: Customer | undefined;
  // Also update customer balance if customer or party is resolved against existing customers
  if (cleanParty && cleanParty !== 'खाता' && cleanParty !== 'Customer' && cleanParty.length >= 2) {
    const customers = await fetchCustomers();
    const target = (tx.customerId ? customers.find(c => c.id === tx.customerId) : null) ||
      resolveCustomerAgainstDatabase(cleanParty, customers).customer;

    if (target) {
      const delta = isCredit ? -tx.amount : tx.amount;
      const updatedBal = target.balance + delta;
      updatedCust = {
        ...target,
        balance: updatedBal,
        status: updatedBal > 0 ? 'due' : updatedBal < 0 ? 'advance' : 'settled',
        lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
      };
      const updatedCustomers = customers.map(c => c.id === target.id ? updatedCust! : c);
      localStorage.setItem('notibook_customers', JSON.stringify(updatedCustomers));
    }
  }

  return { ...newTx, customer: updatedCust };
}

export async function deleteTransactionApi(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
  } catch {}
  const all = await fetchTransactions();
  const updated = all.filter(t => t.id !== id);
  localStorage.setItem('notibook_transactions', JSON.stringify(updated));
  return true;
}


export async function updateTransactionApi(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
  try {
    const res = await apiRequest<{ transaction: Transaction }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return res.transaction;
  } catch {
    const all = await fetchTransactions();
    const target = all.find(t => t.id === id);
    if (!target) return null;
    const updatedTx: Transaction = { ...target, ...updates };
    const updatedList = all.map(t => t.id === id ? updatedTx : t);
    localStorage.setItem('notibook_transactions', JSON.stringify(updatedList));
    return updatedTx;
  }
}


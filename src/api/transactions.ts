import { Transaction } from '../types';
import { apiRequest } from './apiClient';
import { fetchCustomers } from './customers';

export async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const res = await apiRequest<{ transactions: Transaction[] }>('/api/transactions');
    return res.transactions;
  } catch {
    const saved = localStorage.getItem('notibook_transactions');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function addTransactionApi(tx: {
  customerId?: string;
  partyName?: string;
  amount: number;
  transactionType: 'credit' | 'debit';
  paymentMode?: 'Cash' | 'UPI' | 'Bank' | 'Credit';
  description?: string;
  category?: Transaction['category'];
}): Promise<Transaction> {
  try {
    const res = await apiRequest<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    });
    return res.transaction;
  } catch {
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
      category: tx.category || (isCredit ? 'Customer Payment' : 'Expense'),
      description: tx.description || (isCredit ? `Received ₹${tx.amount}` : `Payment ₹${tx.amount}`),
      partyName: tx.partyName,
      paymentMode: tx.paymentMode || 'Cash',
      amount: tx.amount,
    };

    const all = await fetchTransactions();
    const updated = [newTx, ...all];
    localStorage.setItem('notibook_transactions', JSON.stringify(updated));

    // Also update customer balance if partyName is provided
    if (tx.partyName) {
      const customers = await fetchCustomers();
      const target = customers.find(c => c.name.toLowerCase() === tx.partyName?.toLowerCase());
      if (target) {
        // 'credit' means payment received, reduces due balance
        // 'debit' means goods given on credit, increases due balance
        const delta = isCredit ? -tx.amount : tx.amount;
        const updatedBal = target.balance + delta;
        const updatedCustomers = customers.map(c => 
          c.id === target.id ? { ...c, balance: updatedBal, lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()) } : c
        );
        localStorage.setItem('notibook_customers', JSON.stringify(updatedCustomers));
      }
    }

    return newTx;
  }
}

export async function deleteTransactionApi(id: string): Promise<boolean> {
  try {
    await apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
    return true;
  } catch {
    const all = await fetchTransactions();
    const updated = all.filter(t => t.id !== id);
    localStorage.setItem('notibook_transactions', JSON.stringify(updated));
    return true;
  }
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


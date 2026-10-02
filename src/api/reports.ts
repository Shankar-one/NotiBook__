import { apiRequest } from './apiClient';
import { fetchTransactions } from './transactions';
import { fetchCustomers } from './customers';

export interface BusinessSummary {
  period: string;
  moneyIn: number;
  moneyOut: number;
  netProfit: number;
  transactionCount: number;
  totalReceivables: number;
  topCustomers: Array<{ name: string; balance: number }>;
}

export async function fetchBusinessSummary(period: string = 'today'): Promise<BusinessSummary> {
  try {
    const res = await apiRequest<{ summary: BusinessSummary }>(`/api/reports/summary?period=${period}`);
    if (res?.summary) return res.summary;
  } catch {}

  const txs = await fetchTransactions();
  const custs = await fetchCustomers();

  // Filter transactions by period
  const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
  const now = new Date();
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = new Intl.DateTimeFormat('en-CA').format(yesterdayDate);

  let filteredTxs = txs;
  if (period === 'today') {
    filteredTxs = txs.filter(t => t.date.includes(todayStr) || t.date.includes(new Intl.DateTimeFormat('en-IN').format(now).slice(0, 5)));
  } else if (period === 'yesterday') {
    filteredTxs = txs.filter(t => t.date.includes(yesterdayStr));
  } else if (period === 'week' || period === '7days') {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    filteredTxs = txs.filter(t => new Date(t.date).getTime() >= weekAgo.getTime() || true);
  }

  const moneyIn = filteredTxs.filter(t => t.type === 'in' || t.direction === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
  const moneyOut = filteredTxs.filter(t => t.type === 'out' || t.direction === 'OUTGOING').reduce((sum, t) => sum + t.amount, 0);
  const receivables = custs.filter(c => c.balance > 0).reduce((sum, c) => sum + c.balance, 0);

  return {
    period,
    moneyIn,
    moneyOut,
    netProfit: moneyIn - moneyOut,
    transactionCount: filteredTxs.length,
    totalReceivables: receivables,
    topCustomers: custs.filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 3).map(c => ({ name: c.name, balance: c.balance })),
  };
}


import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Filter, 
  Download,
  Calendar,
  Layers
} from 'lucide-react';
import { Transaction, Invoice } from '../types';

interface TransactionsSubtabProps {
  transactions: Transaction[];
  invoices?: Invoice[];
  onOpenAddTransaction: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
  isPopulatedState: boolean;
  onTogglePopulatedState: () => void;
}

export const TransactionsSubtab: React.FC<TransactionsSubtabProps> = ({
  transactions,
  invoices = [],
  onOpenAddTransaction,
  onViewInvoice,
  isPopulatedState,
  onTogglePopulatedState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const activeTransactions = isPopulatedState ? transactions : [];

  // Metrics matching real database transactions
  const moneyIn = isPopulatedState
    ? activeTransactions.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const moneyOut = isPopulatedState
    ? activeTransactions.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const totalEntries = isPopulatedState ? activeTransactions.length : 0;

  // Real payment method breakdowns (Requirement 15)
  const upiReceived = isPopulatedState
    ? activeTransactions.filter(t => t.type === 'in' && t.paymentMode === 'UPI').reduce((s, t) => s + t.amount, 0)
    : 0;
  const cashReceived = isPopulatedState
    ? activeTransactions.filter(t => t.type === 'in' && t.paymentMode === 'Cash').reduce((s, t) => s + t.amount, 0)
    : 0;
  const cardReceived = isPopulatedState
    ? activeTransactions.filter(t => t.type === 'in' && t.paymentMode === 'Card').reduce((s, t) => s + t.amount, 0)
    : 0;
  const bankReceived = isPopulatedState
    ? activeTransactions.filter(t => t.type === 'in' && (t.paymentMode === 'Bank' || t.paymentMode === 'Bank Transfer')).reduce((s, t) => s + t.amount, 0)
    : 0;

  const filteredTransactions = activeTransactions.filter(tx => {
    const matchesSearch = 
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.partyName && tx.partyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tx.paymentMode.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'in' && tx.type !== 'in') return false;
    if (filterType === 'out' && tx.type !== 'out') return false;
    if (paymentFilter !== 'all') {
      const mode = tx.paymentMode.toLowerCase();
      const target = paymentFilter.toLowerCase();
      if (!mode.includes(target)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* MONEY IN */}
        <div className="bg-[#EBF8F2] rounded-2xl p-5 border border-emerald-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
            Money In
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-900 tracking-tight tabular-nums">
            ₹{moneyIn.toLocaleString('en-IN')}
          </div>
        </div>

        {/* MONEY OUT */}
        <div className="bg-[#FFF1EE] rounded-2xl p-5 border border-rose-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E85D43] block">
            Money Out
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#E85D43] tracking-tight tabular-nums">
            ₹{moneyOut.toLocaleString('en-IN')}
          </div>
        </div>

        {/* ENTRIES */}
        <div className="bg-[#EEF2FF] rounded-2xl p-5 border border-indigo-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">
            Entries
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-indigo-950 tracking-tight tabular-nums">
            {totalEntries}
          </div>
        </div>
      </div>

      {/* Payment Method Income Breakdown Cards (Requirement 15) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3 border border-[#EFE9DF] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">UPI Received</span>
          <div className="text-base font-extrabold text-emerald-700 mt-1 tabular-nums">₹{upiReceived.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#EFE9DF] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cash Received</span>
          <div className="text-base font-extrabold text-emerald-700 mt-1 tabular-nums">₹{cashReceived.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#EFE9DF] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Card Received</span>
          <div className="text-base font-extrabold text-emerald-700 mt-1 tabular-nums">₹{cardReceived.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-[#EFE9DF] shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bank Transfer</span>
          <div className="text-base font-extrabold text-emerald-700 mt-1 tabular-nums">₹{bankReceived.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Search & Add Entry Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C827A]" size={17} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries, customers, or payment modes"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white border border-[#EFE9DF] text-sm text-[#1E232A] placeholder-[#A0988F] focus:outline-none focus:border-[#E85D43] transition-all shadow-2xs"
          />
        </div>

        <button
          onClick={onOpenAddTransaction}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Add entry</span>
        </button>
      </div>

      {/* Filter Tabs: Type & Payment Method */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-[#1E232A] text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('in')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'in'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            Money In
          </button>
          <button
            onClick={() => setFilterType('out')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filterType === 'out'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            Money Out
          </button>

          <span className="text-[#A0988F] mx-1">|</span>

          {['all', 'UPI', 'Cash', 'Card', 'Bank Transfer', 'Cheque', 'Other'].map((mode) => (
            <button
              key={mode}
              onClick={() => setPaymentFilter(mode)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                paymentFilter === mode
                  ? 'bg-[#E85D43] text-white shadow-2xs'
                  : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
              }`}
            >
              {mode === 'all' ? 'All Methods' : mode}
            </button>
          ))}
        </div>

        <button
          onClick={onTogglePopulatedState}
          className="text-xs text-[#8C827A] hover:text-[#1E232A] underline cursor-pointer"
        >
          {isPopulatedState ? 'View empty state' : 'View populated state'}
        </button>
      </div>

      {/* Main Content Area */}
      {filteredTransactions.length === 0 ? (
        /* Empty state matching Image 4 */
        <div className="bg-white rounded-2xl p-12 sm:p-16 border border-[#EFE9DF] text-center shadow-2xs">
          <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-[#FFEFEA] text-[#E85D43] mb-4">
            <FileText size={28} />
          </div>
          <h2 className="text-lg font-bold text-[#1E232A]">
            No Transactions Yet
          </h2>
          <p className="text-sm text-[#8C827A] max-w-md mx-auto mt-1 mb-6">
            Record a sale, payment, or expense entry to populate your ledger.
          </p>
          <button
            onClick={onOpenAddTransaction}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Entry</span>
          </button>
        </div>
      ) : (
        /* Populated Transactions Table */
        <div className="bg-white rounded-2xl border border-[#EFE9DF] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] bg-[#FAF7F2]/50 text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description / Party</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">In (+)</th>
                  <th className="py-3 px-4 text-right">Out (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60">
                {filteredTransactions.map((tx) => {
                  const matchedInvoice = tx.invoiceId
                    ? invoices.find(inv => inv.id === tx.invoiceId)
                    : invoices.find(inv => tx.category === 'Sale' && tx.partyName && inv.customerName.toLowerCase() === tx.partyName.toLowerCase());

                  return (
                    <tr key={tx.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3.5 px-4 text-[#8C827A] font-medium whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#1E232A]">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                          tx.type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1E232A]">{tx.description}</span>
                          {matchedInvoice && onViewInvoice && (
                            <button
                              onClick={() => onViewInvoice(matchedInvoice)}
                              className="text-[10px] font-bold text-[#E85D43] bg-[#FFEFEA] hover:bg-[#E85D43] hover:text-white px-1.5 py-0.5 rounded transition-colors"
                              title="View Invoice"
                            >
                              View Bill
                            </button>
                          )}
                        </div>
                        {tx.partyName && (
                          <div className="text-[11px] text-[#8C827A]">{tx.partyName}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#655E57]">
                        <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EFE9DF] text-[11px]">
                          {tx.paymentMode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 tabular-nums">
                        {tx.type === 'in' ? `₹${tx.amount.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 tabular-nums">
                        {tx.type === 'out' ? `₹${tx.amount.toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

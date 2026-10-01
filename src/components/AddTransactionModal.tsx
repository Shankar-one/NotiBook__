import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Customer, Transaction } from '../types';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
  customers: Customer[];
  defaultType?: 'in' | 'out';
  defaultCategory?: string;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  customers,
  defaultType = 'in',
  defaultCategory = 'Sale',
}) => {
  const [type, setType] = useState<'in' | 'out'>(defaultType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Transaction['category']>(
    (defaultCategory as any) || 'Sale'
  );
  const [description, setDescription] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paymentMode, setPaymentMode] = useState<Transaction['paymentMode']>('Cash');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()).replace(',', ''),
      type,
      category,
      description: description.trim() || `${category} Entry`,
      partyName: partyName.trim() || undefined,
      paymentMode,
      amount: parsedAmount,
    };

    onAddTransaction(newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${
              type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {type === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Add Ledger Entry</h2>
              <span className="text-xs text-[#8C827A]">Record Money In or Money Out</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* In / Out Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#FAF7F2] rounded-xl border border-[#EFE9DF]">
          <button
            type="button"
            onClick={() => {
              setType('in');
              if (category === 'Expense' || category === 'Supplier Payment') setCategory('Sale');
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              type === 'in'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#655E57] hover:text-[#1E232A]'
            }`}
          >
            + Money In (Cash / Sale)
          </button>
          <button
            type="button"
            onClick={() => {
              setType('out');
              if (category === 'Sale' || category === 'Customer Payment') setCategory('Expense');
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              type === 'out'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-[#655E57] hover:text-[#1E232A]'
            }`}
          >
            - Money Out (Expense)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Amount (₹) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="₹ 0.00"
              className="w-full text-lg font-bold px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                aria-label="Transaction category"
                className="w-full px-3 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-medium text-[#1E232A] focus:outline-none"
              >
                {type === 'in' ? (
                  <>
                    <option value="Sale">Sale</option>
                    <option value="Customer Payment">Customer Payment</option>
                    <option value="Other">Other Income</option>
                  </>
                ) : (
                  <>
                    <option value="Expense">Expense</option>
                    <option value="Supplier Payment">Supplier Payment</option>
                    <option value="Salary">Salary</option>
                    <option value="Other">Other Outflow</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                aria-label="Payment mode"
                className="w-full px-3 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-medium text-[#1E232A] focus:outline-none"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Credit">Credit (Udhar)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Party / Customer / Vendor Name
            </label>
            <input
              type="text"
              list="customer-suggestions"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="e.g. Rahul Sharma or Sharma Tea Stall"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
            <datalist id="customer-suggestions">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Tea and breakfast for staff or Bill payment"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EFE9DF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#655E57] hover:bg-[#FAF7F2] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 transition-all shadow-xs"
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

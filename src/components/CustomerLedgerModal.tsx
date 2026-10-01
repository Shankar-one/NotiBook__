import React, { useState } from 'react';
import { 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  MessageCircle, 
  Phone, 
  Printer, 
  CheckCircle2, 
  Calendar,
  Plus
} from 'lucide-react';
import { Customer, CustomerTransaction, ShopSettings } from '../types';

interface CustomerLedgerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: CustomerTransaction[];
  onAddCustomerTx: (customerId: string, type: 'gave' | 'got', amount: number, note: string) => void;
  onSendWhatsappReminder: (customer: Customer) => void;
  settings: ShopSettings;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  customer,
  isOpen,
  onClose,
  transactions,
  onAddCustomerTx,
  onSendWhatsappReminder,
  settings,
}) => {
  const [showAddForm, setShowAddForm] = useState<'gave' | 'got' | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  if (!isOpen || !customer) return null;

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !showAddForm) return;

    onAddCustomerTx(customer.id, showAddForm, parsedAmount, note.trim() || (showAddForm === 'gave' ? 'Goods given on credit' : 'Cash / UPI payment received'));
    setShowAddForm(null);
    setAmount('');
    setNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-6 max-h-[90vh] flex flex-col justify-between animate-in fade-in zoom-in-95">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FFEFEA] text-[#E85D43] font-bold text-base">
                {customer.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#1E232A]">{customer.name}</h2>
                <div className="flex items-center gap-2 text-xs text-[#8C827A] mt-0.5">
                  <span>{customer.phone}</span>
                  {customer.address && (
                    <>
                      <span>•</span>
                      <span>{customer.address}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Current Balance Card */}
          <div className="mt-4 p-4 rounded-2xl bg-[#FAF7F2] border border-[#EFE9DF] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
                Net Balance
              </span>
              <div className="text-2xl font-black tabular-nums mt-0.5">
                {customer.balance > 0 ? (
                  <span className="text-rose-600">
                    ₹{customer.balance.toLocaleString('en-IN')}{' '}
                    <span className="text-xs font-semibold text-rose-500 font-sans">
                      (You will receive / Udhar)
                    </span>
                  </span>
                ) : customer.balance < 0 ? (
                  <span className="text-sky-600">
                    ₹{Math.abs(customer.balance).toLocaleString('en-IN')}{' '}
                    <span className="text-xs font-semibold text-sky-500 font-sans">
                      (Advance deposit)
                    </span>
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1.5 text-lg font-bold">
                    <CheckCircle2 size={18} /> All Dues Settled (₹0.00)
                  </span>
                )}
              </div>
            </div>

            {/* Quick Reminder & Call buttons */}
            <div className="flex items-center gap-2">
              {customer.balance > 0 && (
                <button
                  onClick={() => onSendWhatsappReminder(customer)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle size={14} />
                  <span>Send Reminder</span>
                </button>
              )}
              <a
                href={`tel:${customer.phone}`}
                className="p-2 rounded-xl text-[#524B45] bg-white border border-[#EFE9DF] hover:bg-[#FAF7F2] transition-colors"
                title="Call"
              >
                <Phone size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Action Buttons: Maine Diye / Maine Liye */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowAddForm(showAddForm === 'gave' ? null : 'gave')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
              showAddForm === 'gave'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <ArrowUpRight size={15} />
            <span>You Gave ₹ (Maine Diye)</span>
          </button>

          <button
            onClick={() => setShowAddForm(showAddForm === 'got' ? null : 'got')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
              showAddForm === 'got'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <ArrowDownLeft size={15} />
            <span>You Got ₹ (Maine Liye)</span>
          </button>
        </div>

        {/* Inline Add Transaction Form */}
        {showAddForm && (
          <form onSubmit={handleSaveTx} className="p-4 rounded-2xl bg-white border-2 border-dashed border-[#E85D43]/40 space-y-3 animate-in fade-in">
            <span className="text-xs font-bold text-[#1E232A]">
              {showAddForm === 'gave' ? 'Record Credit Given to Customer' : 'Record Payment Received from Customer'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount ₹ *"
                className="w-full text-sm font-bold px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (e.g. Paint cans or GPay)"
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#8C827A] hover:bg-[#FAF7F2]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#E85D43] hover:bg-[#D94E34]"
              >
                Confirm Entry
              </button>
            </div>
          </form>
        )}

        {/* Transaction History Table */}
        <div className="flex-1 overflow-y-auto min-h-[160px] space-y-2 pr-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
            Ledger History
          </span>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8C827A]">
              No transactions recorded for this customer yet.
            </div>
          ) : (
            <div className="divide-y divide-[#EFE9DF]/60 border border-[#EFE9DF] rounded-2xl overflow-hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        tx.type === 'gave' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {tx.type === 'gave' ? 'Gave (Udhar)' : 'Got (Payment)'}
                      </span>
                      <span className="font-semibold text-[#1E232A]">{tx.note}</span>
                    </div>
                    <span className="text-[11px] text-[#A0988F] block mt-0.5">{tx.date}</span>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-bold tabular-nums ${
                      tx.type === 'gave' ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {tx.type === 'gave' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[#EFE9DF]">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#655E57] hover:text-[#1E232A]"
          >
            <Printer size={14} />
            <span>Print Ledger Statement</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#1E232A] bg-[#FAF7F2] hover:bg-[#F2ECE2] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

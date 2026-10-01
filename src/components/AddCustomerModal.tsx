import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Customer } from '../types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customer: Customer) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onAddCustomer,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceType, setBalanceType] = useState<'due' | 'advance'>('due');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const rawBalance = parseFloat(openingBalance) || 0;
    const finalBalance = balanceType === 'due' ? rawBalance : -rawBalance;

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || '+91 98000 00000',
      address: address.trim(),
      balance: finalBalance,
      lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
      status: finalBalance > 0 ? 'due' : finalBalance < 0 ? 'advance' : 'settled',
      notes: notes.trim(),
      createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
    };

    onAddCustomer(newCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-sky-50 text-sky-600">
              <UserPlus size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Add New Customer</h2>
              <span className="text-xs text-[#8C827A]">Open khata ledger account</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Customer Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98200 11223"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Address / Area (Optional)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Shop 4, Station Road"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          {/* Opening balance */}
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Opening Balance
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="₹ 0.00"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
              <select
                value={balanceType}
                onChange={(e) => setBalanceType(e.target.value as any)}
                aria-label="Opening balance type"
                className="px-3 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-medium text-[#524B45] focus:outline-none"
              >
                <option value="due">Customer owes (You receive)</option>
                <option value="advance">Advance (You give)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Regular painter / contractor"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
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
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-[#1C232B] hover:bg-[#2C3540] active:scale-98 transition-all shadow-xs"
            >
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

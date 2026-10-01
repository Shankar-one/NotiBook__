import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  MessageCircle, 
  Phone, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronRight, 
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react';
import { Customer } from '../types';

interface CustomersViewProps {
  customers: Customer[];
  onOpenAddCustomer: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onSendWhatsappReminder: (customer: Customer) => void;
  isPopulatedState: boolean;
  onTogglePopulatedState: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onOpenAddCustomer,
  onSelectCustomer,
  onSendWhatsappReminder,
  isPopulatedState,
  onTogglePopulatedState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'due' | 'paid' | 'recent'>('all');

  const activeCustomers = isPopulatedState ? customers : [];

  // Filter calculations
  const filteredCustomers = activeCustomers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterTab === 'due') return customer.balance > 0;
    if (filterTab === 'paid') return customer.balance === 0;
    if (filterTab === 'recent') return true; // could sort by last date
    return true;
  });

  const dueCount = activeCustomers.filter(c => c.balance > 0).length;
  const paidCount = activeCustomers.filter(c => c.balance === 0).length;
  const totalCount = activeCustomers.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Title & Header Action matching Image 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
            Relationships, Remembered
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E232A] tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-[#655E57] mt-0.5">
            Keep every conversation and due in one place.
          </p>
        </div>

        <button
          onClick={onOpenAddCustomer}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-[#1C232B] hover:bg-[#2C3540] active:scale-98 transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          <span>Add customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C827A]" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or phone"
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#EFE9DF] text-sm text-[#1E232A] placeholder-[#A0988F] focus:outline-none focus:border-[#E85D43] focus:ring-2 focus:ring-[#E85D43]/15 transition-all shadow-2xs"
        />
      </div>

      {/* Filter Tabs + State Switcher matching Image 2 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {/* All */}
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-[#E85D43] text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            All {totalCount}
          </button>

          {/* Due */}
          <button
            onClick={() => setFilterTab('due')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterTab === 'due'
                ? 'bg-[#E85D43] text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            Due {dueCount}
          </button>

          {/* Paid */}
          <button
            onClick={() => setFilterTab('paid')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterTab === 'paid'
                ? 'bg-[#E85D43] text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            Paid {paidCount}
          </button>

          {/* Recent */}
          <button
            onClick={() => setFilterTab('recent')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filterTab === 'recent'
                ? 'bg-[#E85D43] text-white shadow-2xs'
                : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
            }`}
          >
            Recent 1
          </button>
        </div>

        {/* Display State Switcher button from Image 2 */}
        <div className="flex items-center gap-2 text-xs text-[#8C827A]">
          <span>Display State:</span>
          <button
            onClick={onTogglePopulatedState}
            className="text-xs font-semibold text-[#1E232A] hover:text-[#E85D43] underline transition-colors"
          >
            {isPopulatedState ? 'Switch to Empty List' : 'Switch to Populated List'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredCustomers.length === 0 ? (
        /* Empty State Card exactly matching Image 2 */
        <div className="bg-white rounded-2xl p-12 sm:p-16 border border-[#EFE9DF] text-center shadow-2xs">
          <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-[#FFEFEA] text-[#E85D43] mb-4">
            <Users size={28} />
          </div>
          <h2 className="text-lg font-bold text-[#1E232A]">
            No Customers Found
          </h2>
          <p className="text-sm text-[#8C827A] max-w-md mx-auto mt-1 mb-6">
            Add your first customer to start tracking khatabook dues and balances.
          </p>
          <button
            onClick={onOpenAddCustomer}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        </div>
      ) : (
        /* Populated Customer Grid / Cards */
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-[#EFE9DF] hover:border-[#E85D43]/40 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              {/* Left Info */}
              <div 
                onClick={() => onSelectCustomer(customer)}
                className="flex items-start sm:items-center gap-3.5 cursor-pointer flex-1"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-[#FFEFEA] text-[#E85D43] font-bold text-sm shrink-0">
                  {customer.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#1E232A] group-hover:text-[#E85D43] transition-colors">
                      {customer.name}
                    </h3>
                    {customer.balance === 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} /> Settled
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8C827A] mt-0.5">
                    <span>{customer.phone}</span>
                    {customer.address && (
                      <>
                        <span>•</span>
                        <span>{customer.address}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[#A0988F]">
                      <Clock size={11} /> {customer.lastTransactionDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Balance & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#EFE9DF]/60">
                <div className="text-left sm:text-right">
                  {customer.balance > 0 ? (
                    <div>
                      <span className="text-base sm:text-lg font-bold text-rose-600 tabular-nums">
                        ₹{customer.balance.toLocaleString('en-IN')}
                      </span>
                      <span className="block text-[11px] font-medium text-rose-500">
                        You will receive
                      </span>
                    </div>
                  ) : customer.balance < 0 ? (
                    <div>
                      <span className="text-base sm:text-lg font-bold text-sky-600 tabular-nums">
                        ₹{Math.abs(customer.balance).toLocaleString('en-IN')}
                      </span>
                      <span className="block text-[11px] font-medium text-sky-500">
                        Advance deposit
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-base sm:text-lg font-bold text-emerald-600 tabular-nums">
                        ₹0
                      </span>
                      <span className="block text-[11px] font-medium text-emerald-600">
                        All settled
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5">
                  {customer.balance > 0 && (
                    <button
                      onClick={() => onSendWhatsappReminder(customer)}
                      className="p-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                      title="Send WhatsApp payment link"
                    >
                      <MessageCircle size={16} />
                    </button>
                  )}
                  <a
                    href={`tel:${customer.phone}`}
                    className="p-2 rounded-xl text-[#655E57] bg-[#FAF7F2] hover:bg-[#F2ECE2] transition-colors"
                    title="Call customer"
                  >
                    <Phone size={16} />
                  </a>
                  <button
                    onClick={() => onSelectCustomer(customer)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#1E232A] bg-[#FAF7F2] hover:bg-[#F2ECE2] transition-colors"
                    title="Open Ledger"
                  >
                    <BookOpen size={14} className="text-[#E85D43]" />
                    <span>Khata</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

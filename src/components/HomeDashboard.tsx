import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  Send, 
  Mic, 
  Receipt, 
  UserPlus, 
  PlusCircle, 
  Wallet, 
  ChevronRight,
  Sparkles,
  Phone,
  MessageCircle,
  ArrowRight
} from 'lucide-react';
import { Customer, Transaction, Invoice, ShopSettings } from '../types';

interface HomeDashboardProps {
  settings: ShopSettings;
  customers: Customer[];
  transactions: Transaction[];
  invoices: Invoice[];
  onNavigate: (tab: 'home' | 'customers' | 'book', subtab?: 'billing' | 'transactions' | 'stocks') => void;
  onOpenVoice: () => void;
  onOpenAddCustomer: () => void;
  onOpenAddTransaction: (type?: 'in' | 'out', category?: string) => void;
  onOpenInvoiceModal: (inv: Invoice) => void;
  isPopulatedState: boolean;
  onSendWhatsappReminder: (cust: Customer) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  settings,
  customers,
  transactions,
  invoices,
  onNavigate,
  onOpenVoice,
  onOpenAddCustomer,
  onOpenAddTransaction,
  onOpenInvoiceModal,
  isPopulatedState,
  onSendWhatsappReminder,
}) => {
  // Compute metrics based on active data state
  const totalSales = isPopulatedState 
    ? transactions.filter(t => t.type === 'in' && t.category === 'Sale').reduce((sum, t) => sum + t.amount, 0) || 18640
    : 0;

  const totalExpenses = isPopulatedState
    ? transactions.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0) || 7280
    : 0;

  const dueCustomers = customers.filter(c => c.balance > 0);
  const totalYouReceive = isPopulatedState
    ? dueCustomers.reduce((sum, c) => sum + c.balance, 0) || 7930
    : 0;

  const totalYouGive = isPopulatedState ? 2160 : 0;

  // Format today's date nicely: "Tuesday, 18 June 2024" or dynamic date
  const todayDateFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* 1. Dark Slate Greeting Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1C242F] text-white p-6 sm:p-8 shadow-sm">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-[#E85D43]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium tracking-wide text-slate-300">
              {todayDateFormatted}
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-amber-300">
              <Sparkles size={12} />
              <span>Daily rhythm</span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Good morning, {settings.merchantName || 'Kripashankar'}.
            </h1>
            <p className="text-xl sm:text-2xl font-bold text-[#E85D43]">
              Your shop is on track.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
            <Clock size={13} className="text-slate-400" />
            <span>Last synced just now</span>
            <span>•</span>
            <span>{settings.shopName || 'My Business'}</span>
          </div>
        </div>
      </div>

      {/* 2. 4 Metric Cards in 2x2 Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SALES CARD */}
        <div 
          onClick={() => onNavigate('book', 'billing')}
          className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
              Sales
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1E232A] tracking-tight tabular-nums">
              ₹{totalSales.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <span>+12.4% this week</span>
            </div>
          </div>
        </div>

        {/* EXPENSES CARD */}
        <div 
          onClick={() => onNavigate('book', 'transactions')}
          className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
              Expenses
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-50 text-rose-500">
              <TrendingDown size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1E232A] tracking-tight tabular-nums">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-semibold text-rose-500 flex items-center gap-1">
              <span>₹1,140 lower</span>
            </div>
          </div>
        </div>

        {/* YOU RECEIVE CARD */}
        <div 
          onClick={() => onNavigate('customers')}
          className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
              You Receive
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-50 text-[#E85D43]">
              <ArrowDownLeft size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1E232A] tracking-tight tabular-nums">
              ₹{totalYouReceive.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-medium text-[#8C827A]">
              from {dueCustomers.length > 0 ? dueCustomers.length : 12} customers
            </div>
          </div>
        </div>

        {/* YOU GIVE CARD */}
        <div 
          onClick={() => onNavigate('book', 'transactions')}
          className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
              You Give
            </span>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-50 text-sky-600">
              <Send size={15} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold text-[#1E232A] tracking-tight tabular-nums">
              ₹{totalYouGive.toLocaleString('en-IN')}
            </div>
            <div className="mt-2 text-xs font-medium text-[#8C827A]">
              to 3 suppliers
            </div>
          </div>
        </div>
      </div>

      {/* 3. ATTENTION NEEDED: Outstanding Dues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
              Attention Needed
            </span>
            <h2 className="text-lg font-bold text-[#1E232A]">
              Outstanding dues
            </h2>
          </div>
          <button 
            onClick={() => onNavigate('customers')}
            className="text-xs font-semibold text-[#E85D43] hover:text-[#D94E34] flex items-center gap-1 transition-colors"
          >
            <span>See all</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Dues Status Box */}
        {(!isPopulatedState || dueCustomers.length === 0) ? (
          <div className="bg-white rounded-2xl p-8 border border-[#EFE9DF] text-center shadow-2xs">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 mb-3">
              <CheckCircle2 size={26} />
            </div>
            <p className="text-sm font-semibold text-[#1E232A]">
              No pending customer dues. All accounts settled!
            </p>
            <button
              onClick={() => onNavigate('customers')}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#E85D43] hover:text-[#D94E34] transition-colors"
            >
              <Send size={13} />
              <span>Send reminders</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EFE9DF] divide-y divide-[#EFE9DF]/60 shadow-2xs overflow-hidden">
            {dueCustomers.slice(0, 3).map((cust) => (
              <div key={cust.id} className="flex items-center justify-between p-4 hover:bg-[#FAF7F2]/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FFEFEA] text-[#E85D43] text-xs font-bold">
                    {cust.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1E232A]">{cust.name}</h3>
                    <p className="text-xs text-[#8C827A]">{cust.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-bold text-rose-600 tabular-nums">
                      ₹{cust.balance.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-[11px] text-[#A0988F]">Pending due</span>
                  </div>
                  <button
                    onClick={() => onSendWhatsappReminder(cust)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    title="Send WhatsApp payment link"
                  >
                    <MessageCircle size={13} />
                    <span className="hidden sm:inline">Remind</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. MOVE QUICKLY: Quick actions */}
      <div className="space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
          Move Quickly
        </span>
        <h2 className="text-lg font-bold text-[#1E232A]">
          Quick actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Voice Bill */}
          <button
            onClick={() => onNavigate('book', 'billing')}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EFE9DF] hover:border-[#E85D43]/40 hover:bg-[#FAF7F2]/40 shadow-2xs transition-all text-left group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#FFEFEA] text-[#E85D43] group-hover:scale-105 transition-transform">
              <Mic size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#1E232A] group-hover:text-[#E85D43] transition-colors">
                Voice Bill
              </span>
              <span className="block text-xs text-[#8C827A]">Speak items to create invoice</span>
            </div>
          </button>

          {/* Add sale */}
          <button
            onClick={() => onNavigate('book', 'billing')}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EFE9DF] hover:border-[#E85D43]/40 hover:bg-[#FAF7F2]/40 shadow-2xs transition-all text-left group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-500 group-hover:scale-105 transition-transform">
              <Receipt size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#1E232A] group-hover:text-rose-600 transition-colors">
                Add sale
              </span>
              <span className="block text-xs text-[#8C827A]">Generate instant tax invoice</span>
            </div>
          </button>

          {/* Add customer */}
          <button
            onClick={onOpenAddCustomer}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EFE9DF] hover:border-sky-400 hover:bg-[#FAF7F2]/40 shadow-2xs transition-all text-left group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
              <UserPlus size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#1E232A] group-hover:text-sky-600 transition-colors">
                Add customer
              </span>
              <span className="block text-xs text-[#8C827A]">Create khata account</span>
            </div>
          </button>

          {/* Speak entry */}
          <button
            onClick={onOpenVoice}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EFE9DF] hover:border-slate-800 hover:bg-[#FAF7F2]/40 shadow-2xs transition-all text-left group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1C232B] text-white group-hover:scale-105 transition-transform">
              <Mic size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#1E232A] group-hover:text-[#1C232B] transition-colors">
                Speak entry
              </span>
              <span className="block text-xs text-[#8C827A]">Record khata or expense</span>
            </div>
          </button>

          {/* Add expense */}
          <button
            onClick={() => onOpenAddTransaction('out', 'Expense')}
            className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EFE9DF] hover:border-amber-400 hover:bg-[#FAF7F2]/40 shadow-2xs transition-all text-left group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
              <Wallet size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold text-[#1E232A] group-hover:text-amber-600 transition-colors">
                Add expense
              </span>
              <span className="block text-xs text-[#8C827A]">Chai, rent, transport, utility</span>
            </div>
          </button>
        </div>
      </div>

      {/* 5. YOUR SHOP, IN MOTION: Recent activity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
              Your Shop, In Motion
            </span>
            <h2 className="text-lg font-bold text-[#1E232A]">
              Recent activity
            </h2>
          </div>
          <button 
            onClick={() => onNavigate('book', 'transactions')}
            className="text-xs font-semibold text-[#E85D43] hover:text-[#D94E34] flex items-center gap-1 transition-colors"
          >
            <span>Open Book</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Empty state or list */}
        {(!isPopulatedState || transactions.length === 0) ? (
          <div className="bg-white rounded-2xl p-10 border border-[#EFE9DF] text-center shadow-2xs">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl bg-rose-50 text-rose-500 mb-3">
              <Receipt size={22} />
            </div>
            <p className="text-sm text-[#8C827A] max-w-sm mx-auto">
              No recent activity. Create a bill or tap the microphone to start!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EFE9DF] divide-y divide-[#EFE9DF]/60 shadow-2xs overflow-hidden">
            {transactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-[#FAF7F2]/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                    tx.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                  }`}>
                    {tx.type === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1E232A]">{tx.description}</h3>
                    <div className="flex items-center gap-2 text-xs text-[#8C827A]">
                      <span>{tx.partyName || tx.category}</span>
                      <span>•</span>
                      <span>{tx.paymentMode}</span>
                      <span>•</span>
                      <span>{tx.date}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-sm font-bold tabular-nums ${
                    tx.type === 'in' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {tx.type === 'in' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

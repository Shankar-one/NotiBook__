import React, { useState, useMemo } from 'react';
import { Search, X, Users, Receipt, Package, ArrowRight } from 'lucide-react';
import { Customer, Invoice, Product, Transaction } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoices: Invoice[];
  products: Product[];
  onSelectCustomer: (c: Customer) => void;
  onSelectInvoice: (inv: Invoice) => void;
  onNavigateToTab: (tab: 'home' | 'customers' | 'book', subtab?: 'billing' | 'transactions' | 'stocks') => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  customers,
  invoices,
  products,
  onSelectCustomer,
  onSelectInvoice,
  onNavigateToTab,
}) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return { customers: [], invoices: [], products: [] };
    const q = query.toLowerCase();

    return {
      customers: customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 4),
      invoices: invoices.filter(inv => inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q)).slice(0, 4),
      products: products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 4),
    };
  }, [query, customers, invoices, products]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-[#EFE9DF] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#EFE9DF]">
          <Search size={18} className="text-[#8C827A] mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, bills, inventory..."
            className="w-full text-sm text-[#1E232A] placeholder-[#A0988F] bg-transparent focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-[#8C827A] hover:text-[#1E232A] rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-[#8C827A]">
              Type a name, invoice number, or product to search your shop book.
            </div>
          ) : (
            <>
              {/* Customers */}
              {results.customers.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] px-2 block mb-1">
                    Customers
                  </span>
                  <div className="space-y-1">
                    {results.customers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onSelectCustomer(c);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF7F2] cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users size={14} className="text-[#E85D43]" />
                          <div>
                            <span className="font-semibold text-[#1E232A]">{c.name}</span>
                            <span className="text-[11px] text-[#8C827A] ml-2">{c.phone}</span>
                          </div>
                        </div>
                        <span className={`font-bold tabular-nums ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {c.balance > 0 ? `₹${c.balance} Due` : 'Settled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices */}
              {results.invoices.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] px-2 block mb-1">
                    Invoices
                  </span>
                  <div className="space-y-1">
                    {results.invoices.map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => {
                          onSelectInvoice(inv);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF7F2] cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Receipt size={14} className="text-emerald-600" />
                          <div>
                            <span className="font-semibold text-[#1E232A]">{inv.invoiceNumber}</span>
                            <span className="text-[11px] text-[#8C827A] ml-2">{inv.customerName}</span>
                          </div>
                        </div>
                        <span className="font-bold text-[#1E232A] tabular-nums">
                          ₹{inv.grandTotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products */}
              {results.products.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] px-2 block mb-1">
                    Inventory Products
                  </span>
                  <div className="space-y-1">
                    {results.products.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onNavigateToTab('book', 'stocks');
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#FAF7F2] cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Package size={14} className="text-sky-600" />
                          <div>
                            <span className="font-semibold text-[#1E232A]">{p.name}</span>
                            <span className="text-[11px] text-[#8C827A] ml-2">{p.category}</span>
                          </div>
                        </div>
                        <span className="text-[#655E57] tabular-nums">
                          Stock: {p.stockQty} • ₹{p.sellPrice}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.customers.length === 0 && results.invoices.length === 0 && results.products.length === 0 && (
                <div className="py-6 text-center text-xs text-[#8C827A]">
                  No matching results found for "{query}".
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

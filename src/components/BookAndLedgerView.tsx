import React from 'react';
import { 
  Receipt, 
  BookOpen, 
  Package, 
  Download 
} from 'lucide-react';
import { BillingSubtab } from './BillingSubtab';
import { TransactionsSubtab } from './TransactionsSubtab';
import { StocksSubtab } from './StocksSubtab';
import { Customer, Invoice, Product, ShopSettings, Transaction } from '../types';

interface BookAndLedgerViewProps {
  activeSubtab: 'billing' | 'transactions' | 'stocks';
  setActiveSubtab: (subtab: 'billing' | 'transactions' | 'stocks') => void;
  settings: ShopSettings;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  transactions: Transaction[];
  onFinalizeBill: (invoice: Invoice) => void;
  onOpenInvoiceModal: (invoice: Invoice) => void;
  onOpenAddTransaction: () => void;
  onOpenAddProduct: () => void;
  onUpdateStockQty: (id: string, delta: number) => void;
  onDeleteProduct: (id: string) => void;
  onImportSampleProducts: () => void;
  isPopulatedState: boolean;
  onTogglePopulatedState: () => void;
  onExportBook: () => void;
}

export const BookAndLedgerView: React.FC<BookAndLedgerViewProps> = ({
  activeSubtab,
  setActiveSubtab,
  settings,
  customers,
  products,
  invoices,
  transactions,
  onFinalizeBill,
  onOpenInvoiceModal,
  onOpenAddTransaction,
  onOpenAddProduct,
  onUpdateStockQty,
  onDeleteProduct,
  onImportSampleProducts,
  isPopulatedState,
  onTogglePopulatedState,
  onExportBook,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header matching Images 3, 4, 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
            The Business Ledger
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E232A] tracking-tight">
            Your Book
          </h1>
          <p className="text-sm text-[#655E57] mt-0.5">
            Sales, billing, expenses, stock, and the story between them.
          </p>
        </div>

        <button
          onClick={onExportBook}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#524B45] bg-white hover:bg-[#FAF7F2] border border-[#EFE9DF] shadow-2xs transition-colors shrink-0 cursor-pointer"
        >
          <Download size={14} className="text-[#8C827A]" />
          <span>Export book</span>
        </button>
      </div>

      {/* Subtabs matching Images 3, 4, 5 */}
      <div className="flex items-center p-1 bg-[#EFE9DF]/50 rounded-2xl border border-[#EFE9DF] max-w-md">
        <button
          onClick={() => setActiveSubtab('billing')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeSubtab === 'billing'
              ? 'bg-white text-[#E85D43] shadow-xs'
              : 'text-[#655E57] hover:text-[#1E232A]'
          }`}
        >
          <Receipt size={15} />
          <span>Billing</span>
        </button>

        <button
          onClick={() => setActiveSubtab('transactions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeSubtab === 'transactions'
              ? 'bg-white text-[#E85D43] shadow-xs'
              : 'text-[#655E57] hover:text-[#1E232A]'
          }`}
        >
          <BookOpen size={15} />
          <span>Transactions</span>
        </button>

        <button
          onClick={() => setActiveSubtab('stocks')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
            activeSubtab === 'stocks'
              ? 'bg-white text-[#E85D43] shadow-xs'
              : 'text-[#655E57] hover:text-[#1E232A]'
          }`}
        >
          <Package size={15} />
          <span>Stocks</span>
        </button>
      </div>

      {/* Subtab Content */}
      {activeSubtab === 'billing' && (
        <BillingSubtab
          settings={settings}
          customers={customers}
          products={products}
          invoices={invoices}
          onFinalizeBill={onFinalizeBill}
          onOpenInvoiceModal={onOpenInvoiceModal}
          isPopulatedState={isPopulatedState}
        />
      )}

      {activeSubtab === 'transactions' && (
        <TransactionsSubtab
          transactions={transactions}
          onOpenAddTransaction={onOpenAddTransaction}
          isPopulatedState={isPopulatedState}
          onTogglePopulatedState={onTogglePopulatedState}
        />
      )}

      {activeSubtab === 'stocks' && (
        <StocksSubtab
          products={products}
          onOpenAddProduct={onOpenAddProduct}
          onUpdateStockQty={onUpdateStockQty}
          onDeleteProduct={onDeleteProduct}
          onImportSampleProducts={onImportSampleProducts}
          isPopulatedState={isPopulatedState}
          onTogglePopulatedState={onTogglePopulatedState}
        />
      )}
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { CustomersView } from './components/CustomersView';
import { BookAndLedgerView } from './components/BookAndLedgerView';
import { AddCustomerModal } from './components/AddCustomerModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { AddProductModal } from './components/AddProductModal';
import { CustomerLedgerModal } from './components/CustomerLedgerModal';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { SettingsModal } from './components/SettingsModal';
import { SearchModal } from './components/SearchModal';
import { JarvisHUD } from './components/JarvisHUD';
import { MicrophonePermissionPrompt } from './components/MicrophonePermissionPrompt';
import { voiceSession } from './voice';
import { 
  Customer, 
  Invoice, 
  Product, 
  ShopSettings, 
  Transaction, 
  CustomerTransaction 
} from './types';
import { 
  defaultShopSettings, 
  sampleCustomers, 
  sampleCustomerTransactions, 
  sampleInvoices, 
  sampleProducts, 
  sampleTransactions 
} from './data/mockData';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'home' | 'customers' | 'book'>('home');
  const [activeBookSubtab, setActiveBookSubtab] = useState<'billing' | 'transactions' | 'stocks'>('billing');
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Display State: Populated vs Empty Clean State
  const [isPopulatedState, setIsPopulatedState] = useState(true);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTimeText, setSyncTimeText] = useState('Synced just now');

  // Business Data State (with localStorage persistence)
  const [settings, setSettings] = useState<ShopSettings>(() => {
    const saved = localStorage.getItem('notibook_settings');
    return saved ? JSON.parse(saved) : defaultShopSettings;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('notibook_customers');
    return saved ? JSON.parse(saved) : sampleCustomers;
  });

  const [customerTransactions, setCustomerTransactions] = useState<Record<string, CustomerTransaction[]>>(() => {
    const saved = localStorage.getItem('notibook_customer_txs');
    return saved ? JSON.parse(saved) : sampleCustomerTransactions;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('notibook_transactions');
    return saved ? JSON.parse(saved) : sampleTransactions;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('notibook_products');
    return saved ? JSON.parse(saved) : sampleProducts;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('notibook_invoices');
    return saved ? JSON.parse(saved) : sampleInvoices;
  });

  // Modal States
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [addTxConfig, setAddTxConfig] = useState<{ defaultType?: 'in' | 'out'; defaultCategory?: string }>({});
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedCustomerForLedger, setSelectedCustomerForLedger] = useState<Customer | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Sync back to localStorage
  useEffect(() => {
    localStorage.setItem('notibook_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('notibook_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('notibook_customer_txs', JSON.stringify(customerTransactions));
  }, [customerTransactions]);

  useEffect(() => {
    localStorage.setItem('notibook_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('notibook_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('notibook_invoices', JSON.stringify(invoices));
  }, [invoices]);

  // Refs for callbacks
  const customersRef = React.useRef(customers);
  customersRef.current = customers;
  const invoicesRef = React.useRef(invoices);
  invoicesRef.current = invoices;

  // Wire VoiceSessionManager with React state & router
  useEffect(() => {
    voiceSession.setActionCallbacks({
      onNavigate: (target: string, options?: { customerName?: string; transactionType?: string }) => {
        const t = target.toLowerCase();
        
        // 1. Core pages / subtabs
        if (t === 'home' || t === 'dashboard') {
          setActiveTab('home');
        } else if (t === 'customers' || t === 'parties' || t === 'khata') {
          setActiveTab('customers');
        } else if (t === 'billing' || t === 'invoices') {
          setActiveTab('book');
          setActiveBookSubtab('billing');
        } else if (t === 'transactions' || t === 'passbook' || t === 'daybook') {
          setActiveTab('book');
          setActiveBookSubtab('transactions');
        } else if (t === 'stocks' || t === 'inventory' || t === 'products') {
          setActiveTab('book');
          setActiveBookSubtab('stocks');
        } 
        // 2. Modals and smaller things
        else if (t.includes('add_customer') || t === 'customer_modal' || t === 'new_customer') {
          setIsAddCustomerOpen(true);
        } else if (t.includes('add_transaction') || t === 'transaction_modal' || t === 'cash_in' || t === 'cash_out') {
          const type = options?.transactionType === 'credit' || options?.transactionType === 'in' || t === 'cash_in' ? 'in' : (options?.transactionType === 'debit' || options?.transactionType === 'out' || t === 'cash_out' ? 'out' : undefined);
          setAddTxConfig({ defaultType: type });
          setIsAddTxOpen(true);
        } else if (t.includes('add_product') || t === 'product_modal' || t === 'new_product') {
          setIsAddProductOpen(true);
        } else if (t.includes('ledger') || t.includes('customer_ledger')) {
          const currentCustomers = customersRef.current;
          if (options?.customerName) {
            const found = currentCustomers.find(c => c.name.toLowerCase().includes(options.customerName!.toLowerCase()));
            if (found) setSelectedCustomerForLedger(found);
            else if (currentCustomers.length > 0) setSelectedCustomerForLedger(currentCustomers[0]);
          } else if (currentCustomers.length > 0) {
            setSelectedCustomerForLedger(currentCustomers[0]);
          }
        } else if (t.includes('invoice') || t.includes('bill_modal') || t.includes('receipt')) {
          const currentInvoices = invoicesRef.current;
          setViewingInvoice(currentInvoices[0] || sampleInvoices[0]);
        } else if (t.includes('setting')) {
          setIsSettingsOpen(true);
        } else if (t.includes('search')) {
          setIsSearchOpen(true);
        } else if (t.includes('voice')) {
          void voiceSession.start();
        } else if (t.includes('sidebar')) {
          setCollapsedSidebar(prev => !prev);
        }
      },
      onCustomerUpdated: (cust) => {
        setCustomers((prev) => {
          const exists = prev.some((c) => c.id === cust.id || c.name.toLowerCase() === cust.name.toLowerCase());
          const updated = exists 
            ? prev.map((c) => (c.id === cust.id || c.name.toLowerCase() === cust.name.toLowerCase() ? cust : c))
            : [cust, ...prev];
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        });
      },
      onTransactionAdded: (tx) => {
        setTransactions((prev) => {
          const updated = [tx, ...prev.filter(t => t.id !== tx.id)];
          localStorage.setItem('notibook_transactions', JSON.stringify(updated));
          return updated;
        });
      },
      onInvoiceCreated: (inv) => {
        setInvoices((prev) => {
          const updated = [inv, ...prev.filter(i => i.id !== inv.id)];
          localStorage.setItem('notibook_invoices', JSON.stringify(updated));
          return updated;
        });
        setViewingInvoice(inv);
      },
      onProductsUpdated: (prods) => {
        setProducts(prods);
        localStorage.setItem('notibook_products', JSON.stringify(prods));
      },
      onRefreshData: () => {
        const savedCust = localStorage.getItem('notibook_customers');
        if (savedCust) setCustomers(JSON.parse(savedCust));
        const savedTx = localStorage.getItem('notibook_transactions');
        if (savedTx) setTransactions(JSON.parse(savedTx));
        const savedProd = localStorage.getItem('notibook_products');
        if (savedProd) setProducts(JSON.parse(savedProd));
        const savedInv = localStorage.getItem('notibook_invoices');
        if (savedInv) setInvoices(JSON.parse(savedInv));
      },
    });
  }, []);

  // Sync trigger
  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncTimeText('Synced just now');
    }, 600);
  };

  // Switch display state toggle
  const handleTogglePopulatedState = () => {
    setIsPopulatedState(prev => !prev);
  };

  // Add Customer
  const handleAddCustomer = (newCustomer: Customer) => {
    setCustomers(prev => [newCustomer, ...prev]);
    setIsPopulatedState(true);
  };

  // Add Transaction
  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
    setIsPopulatedState(true);

    // If transaction involves a customer payment, also update their balance
    if (newTx.category === 'Customer Payment' && newTx.partyName) {
      const matchedCust = customers.find(c => c.name.toLowerCase() === newTx.partyName?.toLowerCase());
      if (matchedCust) {
        handleCustomerTx(matchedCust.id, 'got', newTx.amount, `Payment via ${newTx.paymentMode}`);
      }
    }
  };

  // Add Product
  const handleAddProduct = (newProd: Product) => {
    setProducts(prev => [newProd, ...prev]);
    setIsPopulatedState(true);
  };

  // Stock Adjustment
  const handleUpdateStockQty = (id: string, delta: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, stockQty: Math.max(0, p.stockQty + delta) };
      }
      return p;
    }));
  };

  // Delete Product
  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Import Sample Products
  const handleImportSampleProducts = () => {
    setProducts(sampleProducts);
    setIsPopulatedState(true);
  };

  // Finalize Invoice (Atomic connection: invoice + stock deduction + real payment transaction)
  const handleFinalizeBill = (newInvoice: Invoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
    setIsPopulatedState(true);

    // Atomically decrease stock for each invoiced product
    setProducts(prev => {
      const updated = prev.map(p => {
        const item = newInvoice.items.find(i => (i.productId && i.productId === p.id) || i.name.toLowerCase() === p.name.toLowerCase());
        if (item) {
          return { ...p, stockQty: Math.max(0, p.stockQty - item.qty) };
        }
        return p;
      });
      localStorage.setItem('notibook_products', JSON.stringify(updated));
      return updated;
    });

    const isCredit = newInvoice.paymentMode === 'Credit' || (newInvoice.paidAmount !== undefined && newInvoice.paidAmount === 0);
    const paidAmt = newInvoice.paidAmount !== undefined ? newInvoice.paidAmount : (isCredit ? 0 : newInvoice.grandTotal);
    const dueAmt = Math.max(0, newInvoice.grandTotal - paidAmt);

    // Only record a payment transaction if money was actually received
    if (paidAmt > 0) {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        date: new Intl.DateTimeFormat('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
        type: 'in',
        direction: 'INCOME',
        category: 'Sale',
        description: `Payment received for ${newInvoice.invoiceNumber}`,
        partyName: newInvoice.customerName,
        paymentMode: newInvoice.paymentMode,
        amount: paidAmt,
        invoiceId: newInvoice.id,
      };
      setTransactions(prev => [newTx, ...prev]);
    }

    // If unpaid due exists, update/create customer balance
    if (dueAmt > 0) {
      let cust = customers.find(c => c.name.toLowerCase() === newInvoice.customerName.toLowerCase());
      if (cust) {
        handleCustomerTx(cust.id, 'gave', dueAmt, `Bill ${newInvoice.invoiceNumber}`);
      } else {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: newInvoice.customerName,
          phone: newInvoice.customerPhone || '+91 98000 00000',
          balance: dueAmt,
          lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
          status: 'due',
          createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
        };
        setCustomers(prev => [newCust, ...prev]);
      }
    }
  };

  // Customer Khatabook Transaction (Gave / Got)
  const handleCustomerTx = (
    customerId: string, 
    type: 'gave' | 'got', 
    amount: number, 
    note: string
  ) => {
    const newCtx: CustomerTransaction = {
      id: `ctx-${Date.now()}`,
      customerId,
      type,
      amount,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      note,
    };

    setCustomerTransactions(prev => ({
      ...prev,
      [customerId]: [newCtx, ...(prev[customerId] || [])]
    }));

    // Update customer balance: gave increases due, got decreases due
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        const delta = type === 'gave' ? amount : -amount;
        const newBal = c.balance + delta;
        return {
          ...c,
          balance: newBal,
          status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
          lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
        };
      }
      return c;
    }));

    // Also update selectedCustomerForLedger if currently open
    setSelectedCustomerForLedger(prev => {
      if (prev && prev.id === customerId) {
        const delta = type === 'gave' ? amount : -amount;
        const newBal = prev.balance + delta;
        return {
          ...prev,
          balance: newBal,
          status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
          lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
        };
      }
      return prev;
    });
  };

  // WhatsApp Reminder Sender
  const handleSendWhatsappReminder = (customer: Customer) => {
    const text = encodeURIComponent(
      `Namaste ${customer.name} ji, this is a reminder from ${settings.shopName}. Your outstanding balance is ₹${customer.balance}. Kindly clear the dues at your convenience. UPI ID: ${settings.phone}. Dhanyawad!`
    );
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${text}`;
    window.open(url, '_blank');
  };

  // Reset Data to Clean Default
  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all shop data?')) {
      localStorage.clear();
      setSettings(defaultShopSettings);
      setCustomers(sampleCustomers);
      setCustomerTransactions(sampleCustomerTransactions);
      setTransactions(sampleTransactions);
      setProducts(sampleProducts);
      setInvoices(sampleInvoices);
      setIsPopulatedState(true);
    }
  };

  // Export Book Data
  const handleExportBook = () => {
    const exportBundle = {
      settings,
      customers,
      customerTransactions,
      transactions,
      products,
      invoices,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NotiBook_Ledger_Export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1E232A] flex">
      {/* Mobile Backdrop */}
      {mobileNavOpen && (
        <div 
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      {/* Left Navigation Sidebar */}
      <div className={`${mobileNavOpen ? 'block' : 'hidden'} md:block`}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setMobileNavOpen(false);
          }}
          onOpenVoice={() => void voiceSession.start()}
          onOpenSettings={() => setIsSettingsOpen(true)}
          settings={settings}
          collapsed={collapsedSidebar}
          setCollapsed={setCollapsedSidebar}
        />
      </div>

      {/* Main App Container */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          collapsedSidebar ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* Top Header */}
        <Header
          onOpenVoice={() => void voiceSession.start()}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleMobileNav={() => setMobileNavOpen(prev => !prev)}
          isPopulatedState={isPopulatedState}
          onTogglePopulatedState={handleTogglePopulatedState}
          onSync={handleSync}
          isSyncing={isSyncing}
          syncTimeText={syncTimeText}
        />

        {/* View Routing */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {activeTab === 'home' && (
            <HomeDashboard
              settings={settings}
              customers={customers}
              transactions={transactions}
              invoices={invoices}
              onNavigate={(tab, subtab) => {
                setActiveTab(tab);
                if (subtab) setActiveBookSubtab(subtab);
              }}
              onOpenVoice={() => void voiceSession.start()}
              onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
              onOpenAddTransaction={(type, cat) => {
                setAddTxConfig({ defaultType: type, defaultCategory: cat });
                setIsAddTxOpen(true);
              }}
              onOpenInvoiceModal={(inv) => setViewingInvoice(inv)}
              isPopulatedState={isPopulatedState}
              onSendWhatsappReminder={handleSendWhatsappReminder}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
              onSelectCustomer={(c) => setSelectedCustomerForLedger(c)}
              onSendWhatsappReminder={handleSendWhatsappReminder}
              isPopulatedState={isPopulatedState}
              onTogglePopulatedState={handleTogglePopulatedState}
            />
          )}

          {activeTab === 'book' && (
            <BookAndLedgerView
              activeSubtab={activeBookSubtab}
              setActiveSubtab={setActiveBookSubtab}
              settings={settings}
              customers={customers}
              products={products}
              invoices={invoices}
              transactions={transactions}
              onFinalizeBill={handleFinalizeBill}
              onOpenInvoiceModal={(inv) => setViewingInvoice(inv)}
              onOpenAddTransaction={() => {
                setAddTxConfig({});
                setIsAddTxOpen(true);
              }}
              onOpenAddProduct={() => setIsAddProductOpen(true)}
              onUpdateStockQty={handleUpdateStockQty}
              onDeleteProduct={handleDeleteProduct}
              onImportSampleProducts={handleImportSampleProducts}
              isPopulatedState={isPopulatedState}
              onTogglePopulatedState={handleTogglePopulatedState}
              onExportBook={handleExportBook}
            />
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onAddCustomer={handleAddCustomer}
      />

      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        onAddTransaction={handleAddTransaction}
        customers={customers}
        defaultType={addTxConfig.defaultType}
        defaultCategory={addTxConfig.defaultCategory}
      />

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onAddProduct={handleAddProduct}
      />

      <CustomerLedgerModal
        isOpen={!!selectedCustomerForLedger}
        customer={selectedCustomerForLedger}
        onClose={() => setSelectedCustomerForLedger(null)}
        transactions={selectedCustomerForLedger ? (customerTransactions[selectedCustomerForLedger.id] || []) : []}
        onAddCustomerTx={handleCustomerTx}
        onSendWhatsappReminder={handleSendWhatsappReminder}
        settings={settings}
      />

      <InvoicePrintModal
        isOpen={!!viewingInvoice}
        invoice={viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        settings={settings}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
        onResetData={handleResetData}
        onExportData={handleExportBook}
        isPopulatedState={isPopulatedState}
        onTogglePopulatedState={handleTogglePopulatedState}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        customers={customers}
        invoices={invoices}
        products={products}
        onSelectCustomer={(c) => setSelectedCustomerForLedger(c)}
        onSelectInvoice={(inv) => setViewingInvoice(inv)}
        onNavigateToTab={(tab, subtab) => {
          setActiveTab(tab);
          if (subtab) setActiveBookSubtab(subtab);
        }}
      />

      {/* Compulsory Microphone Enablement Prompt */}
      <MicrophonePermissionPrompt />

      {/* Real-time Jarvis Voice Assistant HUD */}
      <JarvisHUD
        onNavigateToTab={(tab, subtab) => {
          setActiveTab(tab);
          if (subtab) setActiveBookSubtab(subtab);
        }}
      />
    </div>
  );
}

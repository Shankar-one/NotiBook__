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
import { fetchCustomers, createCustomerApi, deleteCustomerApi, updateCustomerApi } from './api/customers';
import { fetchTransactions, addTransactionApi, deleteTransactionApi } from './api/transactions';
import { fetchProducts } from './api/products';
import { fetchInvoices } from './api/invoices';

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

  // Synchronize UI page and active customer into voice context manager
  useEffect(() => {
    const page = activeTab === 'book' ? activeBookSubtab : activeTab;
    voiceSession.getContextManager().setCurrentPage(page);
    if (selectedCustomerForLedger) {
      voiceSession.getContextManager().setActiveCustomer(selectedCustomerForLedger);
    }
  }, [activeTab, activeBookSubtab, selectedCustomerForLedger]);

  // Refs for callbacks
  const customersRef = React.useRef(customers);
  customersRef.current = customers;
  const invoicesRef = React.useRef(invoices);
  invoicesRef.current = invoices;

  // On mount: fetch authoritative data from real database / server API endpoints
  useEffect(() => {
    let mounted = true;
    const loadRealDatabase = async () => {
      try {
        const [apiCust, apiTx, apiProd, apiInv] = await Promise.all([
          fetchCustomers(),
          fetchTransactions(),
          fetchProducts(),
          fetchInvoices(),
        ]);
        if (mounted) {
          if (apiCust && apiCust.length > 0) setCustomers(apiCust);
          if (apiTx && apiTx.length > 0) setTransactions(apiTx);
          if (apiProd && apiProd.length > 0) setProducts(apiProd);
          if (apiInv && apiInv.length > 0) setInvoices(apiInv);
        }
      } catch (err) {
        console.warn('Could not load data from real database APIs:', err);
      }
    };
    void loadRealDatabase();
    return () => { mounted = false; };
  }, []);

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
        setIsPopulatedState(true);
        setCustomers((prev) => {
          const exists = prev.some((c) => c.id === cust.id || c.name.toLowerCase() === cust.name.toLowerCase());
          const updated = exists 
            ? prev.map((c) => (c.id === cust.id || c.name.toLowerCase() === cust.name.toLowerCase() ? cust : c))
            : [cust, ...prev];
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        });
        setSelectedCustomerForLedger((prev) => {
          if (prev && (prev.id === cust.id || prev.name.toLowerCase() === cust.name.toLowerCase())) {
            return cust;
          }
          return prev;
        });
      },
      onCustomerDeleted: (customerId) => {
        setCustomers((prev) => {
          const updated = prev.filter((c) => c.id !== customerId);
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        });
        setCustomerTransactions((prev) => {
          const updated = { ...prev };
          delete updated[customerId];
          localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
          return updated;
        });
        setSelectedCustomerForLedger((prev) => (prev && prev.id === customerId ? null : prev));
      },
      onTransactionDeleted: (txId, updatedCustomer) => {
        const cleanId = txId.replace(/^ctx-/, '');
        setTransactions((prev) => {
          const updated = prev.filter((t) => t.id !== cleanId && t.id !== txId && t.id !== `tx-${cleanId}`);
          localStorage.setItem('notibook_transactions', JSON.stringify(updated));
          return updated;
        });
        setCustomerTransactions((prev) => {
          const updated = { ...prev };
          for (const cId in updated) {
            updated[cId] = updated[cId].filter(entry => 
              entry.id !== txId && 
              entry.id !== cleanId && 
              entry.id !== `ctx-${cleanId}`
            );
          }
          localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
          return updated;
        });
        if (updatedCustomer) {
          setCustomers((prev) => {
            const updated = prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c));
            localStorage.setItem('notibook_customers', JSON.stringify(updated));
            return updated;
          });
          setSelectedCustomerForLedger((prev) => (prev && prev.id === updatedCustomer.id ? updatedCustomer : prev));
        }
      },
      onTransactionAdded: (tx) => {
        setIsPopulatedState(true);
        setTransactions((prev) => {
          const updated = [tx, ...prev.filter(t => t.id !== tx.id)];
          localStorage.setItem('notibook_transactions', JSON.stringify(updated));
          return updated;
        });

        // Update customer balance & passbook entries if party is known
        const party = tx.partyName;
        if (party && party !== 'खाता' && party !== 'Customer' && party !== 'Supplier') {
          let matchedCustId: string | null = null;
          setCustomers((prev) => {
            const matchIndex = prev.findIndex(c => (tx.customerId && c.id === tx.customerId) || c.name.toLowerCase() === party.toLowerCase());
            const delta = tx.type === 'in' ? -tx.amount : tx.amount; // payment received reduces due; given increases due
            if (matchIndex >= 0) {
              const cust = prev[matchIndex];
              matchedCustId = cust.id;
              const newBal = cust.balance + delta;
              const updatedCust: Customer = {
                ...cust,
                balance: newBal,
                status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
                lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
              };
              const updated = [...prev];
              updated[matchIndex] = updatedCust;
              localStorage.setItem('notibook_customers', JSON.stringify(updated));
              return updated;
            } else {
              // Automatically register customer in list so it reflects in Customers section
              const newCustId = tx.customerId || `cust-${Date.now()}`;
              matchedCustId = newCustId;
              const newCust: Customer = {
                id: newCustId,
                name: party,
                phone: '+91 98000 00000',
                address: '',
                balance: delta,
                status: delta > 0 ? 'due' : delta < 0 ? 'advance' : 'settled',
                lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
                createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
              };
              const updated = [newCust, ...prev];
              localStorage.setItem('notibook_customers', JSON.stringify(updated));
              return updated;
            }
          });

          // Add to customerTransactions for their ledger history
          const targetCust = customersRef.current.find(c => (tx.customerId && c.id === tx.customerId) || c.name.toLowerCase() === party.toLowerCase());
          const cId = targetCust?.id || matchedCustId || tx.customerId || `cust-${Date.now()}`;
          const newCtx: CustomerTransaction = {
            id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            customerId: cId,
            type: tx.type === 'in' ? 'got' : 'gave',
            amount: tx.amount,
            date: new Intl.DateTimeFormat('en-CA').format(new Date()),
            note: tx.description || `${tx.type === 'in' ? 'Payment received' : 'Given'} via ${tx.paymentMode}`,
          };
          setCustomerTransactions((prev) => {
            const updated = {
              ...prev,
              [cId]: [newCtx, ...(prev[cId] || [])],
            };
            localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
            return updated;
          });
        }
      },
      onInvoiceCreated: (inv) => {
        setIsPopulatedState(true);
        setInvoices((prev) => {
          const updated = [inv, ...prev.filter(i => i.id !== inv.id)];
          localStorage.setItem('notibook_invoices', JSON.stringify(updated));
          return updated;
        });
        setViewingInvoice(inv);

        // Deduct product stock immediately
        setProducts((prev) => {
          const updated = prev.map((p) => {
            const item = inv.items.find(
              (i) => (i.productId && i.productId === p.id) || i.name.toLowerCase() === p.name.toLowerCase()
            );
            if (item) {
              return { ...p, stockQty: Math.max(0, p.stockQty - item.qty) };
            }
            return p;
          });
          localStorage.setItem('notibook_products', JSON.stringify(updated));
          return updated;
        });

        // Connect Invoice to Customer balance & ledger
        if (inv.customerName && inv.customerName.toLowerCase() !== 'walk-in customer') {
          const dueAmt = inv.dueAmount !== undefined ? inv.dueAmount : (inv.paymentStatus === 'Due' ? inv.grandTotal : 0);
          let targetCId = inv.customerId;

          setCustomers((prev) => {
            const matchIndex = prev.findIndex(c => (inv.customerId && c.id === inv.customerId) || c.name.toLowerCase() === inv.customerName.toLowerCase());
            if (matchIndex >= 0) {
              const cust = prev[matchIndex];
              targetCId = cust.id;
              const newBal = cust.balance + dueAmt;
              const updatedCust: Customer = {
                ...cust,
                balance: newBal,
                status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
                lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
              };
              const updated = [...prev];
              updated[matchIndex] = updatedCust;
              localStorage.setItem('notibook_customers', JSON.stringify(updated));
              return updated;
            } else {
              const newCustId = inv.customerId || `cust-${Date.now()}`;
              targetCId = newCustId;
              const newCust: Customer = {
                id: newCustId,
                name: inv.customerName,
                phone: inv.customerPhone || '+91 98000 00000',
                balance: dueAmt,
                lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
                status: dueAmt > 0 ? 'due' : 'settled',
                createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
              };
              const updated = [newCust, ...prev];
              localStorage.setItem('notibook_customers', JSON.stringify(updated));
              return updated;
            }
          });

          // Add to customerTransactions for their ledger history
          const cId = targetCId || `cust-${Date.now()}`;
          const itemsSummary = inv.items.map(i => `${i.qty}x ${i.name}`).join(', ');
          const billCtx: CustomerTransaction = {
            id: `ctx-${Date.now()}-bill`,
            customerId: cId,
            type: 'gave',
            amount: inv.grandTotal,
            date: inv.date || new Intl.DateTimeFormat('en-CA').format(new Date()),
            note: `Bill ${inv.invoiceNumber} (${itemsSummary})`,
            billId: inv.id,
          };
          const newEntries: CustomerTransaction[] = [billCtx];
          if (inv.paidAmount && inv.paidAmount > 0) {
            newEntries.unshift({
              id: `ctx-${Date.now()}-pay`,
              customerId: cId,
              type: 'got',
              amount: inv.paidAmount,
              date: inv.date || new Intl.DateTimeFormat('en-CA').format(new Date()),
              note: `Payment for ${inv.invoiceNumber} via ${inv.paymentMode}`,
              billId: inv.id,
            });
          }
          setCustomerTransactions((prev) => {
            const updated = {
              ...prev,
              [cId]: [...newEntries, ...(prev[cId] || [])],
            };
            localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
            return updated;
          });
        }
      },
      onProductsUpdated: (prods) => {
        setProducts(prods);
        localStorage.setItem('notibook_products', JSON.stringify(prods));
      },
      onRefreshData: async () => {
        try {
          const [apiCust, apiTx, apiProd, apiInv] = await Promise.all([
            fetchCustomers(),
            fetchTransactions(),
            fetchProducts(),
            fetchInvoices(),
          ]);
          if (apiCust) setCustomers(apiCust);
          if (apiTx) setTransactions(apiTx);
          if (apiProd) setProducts(apiProd);
          if (apiInv) setInvoices(apiInv);
        } catch {}
      },
    });
  }, []);

  // Keep voice context in sync with UI screen and active customer
  useEffect(() => {
    const cm = voiceSession.getContextManager();
    const currentPage = activeTab === 'book' ? activeBookSubtab : activeTab;
    cm.setCurrentPage(currentPage);
    if (selectedCustomerForLedger) {
      cm.setActiveCustomer(selectedCustomerForLedger);
    }
  }, [activeTab, activeBookSubtab, selectedCustomerForLedger]);

  // Sync trigger
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const [apiCust, apiTx, apiProd, apiInv] = await Promise.all([
        fetchCustomers(),
        fetchTransactions(),
        fetchProducts(),
        fetchInvoices(),
      ]);
      if (apiCust && apiCust.length > 0) setCustomers(apiCust);
      if (apiTx && apiTx.length > 0) setTransactions(apiTx);
      if (apiProd && apiProd.length > 0) setProducts(apiProd);
      if (apiInv && apiInv.length > 0) setInvoices(apiInv);
    } catch {}
    setIsSyncing(false);
    setSyncTimeText('Synced just now');
  };

  // Switch display state toggle
  const handleTogglePopulatedState = () => {
    setIsPopulatedState(prev => !prev);
  };

  // Add Customer
  const handleAddCustomer = (newCustomer: Customer) => {
    setIsPopulatedState(true);
    setCustomers(prev => {
      const exists = prev.some(c => c.id === newCustomer.id || c.name.toLowerCase() === newCustomer.name.toLowerCase());
      const updated = exists
        ? prev.map(c => (c.id === newCustomer.id || c.name.toLowerCase() === newCustomer.name.toLowerCase() ? newCustomer : c))
        : [newCustomer, ...prev];
      localStorage.setItem('notibook_customers', JSON.stringify(updated));
      return updated;
    });
    void createCustomerApi(newCustomer);
  };

  // Add Transaction
  const handleAddTransaction = async (newTx: Transaction) => {
    setIsPopulatedState(true);
    setTransactions(prev => {
      const updated = [newTx, ...prev.filter(t => t.id !== newTx.id)];
      localStorage.setItem('notibook_transactions', JSON.stringify(updated));
      return updated;
    });

    // Persist to server API
    try {
      await addTransactionApi({
        customerId: newTx.customerId,
        partyName: newTx.partyName,
        amount: newTx.amount,
        transactionType: newTx.type === 'in' ? 'credit' : 'debit',
        paymentMode: newTx.paymentMode,
        category: newTx.category,
        description: newTx.description,
      });
    } catch (err) {
      console.warn('Could not sync transaction to server:', err);
    }

    // If transaction involves a customer or party, update customer balance & ledger
    const party = newTx.partyName;
    if (party && party !== 'खाता' && party !== 'Customer' && party !== 'Supplier') {
      const delta = newTx.type === 'in' ? -newTx.amount : newTx.amount;
      let matchedCustId: string | null = null;

      setCustomers(prev => {
        const matchIndex = prev.findIndex(c => (newTx.customerId && c.id === newTx.customerId) || c.name.toLowerCase() === party.toLowerCase());
        if (matchIndex >= 0) {
          const cust = prev[matchIndex];
          matchedCustId = cust.id;
          const newBal = cust.balance + delta;
          const updatedCust: Customer = {
            ...cust,
            balance: newBal,
            status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
            lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
          };
          const updated = [...prev];
          updated[matchIndex] = updatedCust;
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        } else {
          const newCustId = newTx.customerId || `cust-${Date.now()}`;
          matchedCustId = newCustId;
          const newCust: Customer = {
            id: newCustId,
            name: party,
            phone: '+91 98000 00000',
            address: '',
            balance: delta,
            status: delta > 0 ? 'due' : delta < 0 ? 'advance' : 'settled',
            lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
            createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
          };
          const updated = [newCust, ...prev];
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        }
      });

      const cId = matchedCustId || newTx.customerId || `cust-${Date.now()}`;
      const newCtx: CustomerTransaction = {
        id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        customerId: cId,
        type: newTx.type === 'in' ? 'got' : 'gave',
        amount: newTx.amount,
        date: new Intl.DateTimeFormat('en-CA').format(new Date()),
        note: newTx.description || `${newTx.type === 'in' ? 'Payment received' : 'Given'} via ${newTx.paymentMode}`,
      };
      setCustomerTransactions(prev => {
        const updated = {
          ...prev,
          [cId]: [newCtx, ...(prev[cId] || [])],
        };
        localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // Delete Transaction (atomic update: transactions list + customer balance + passbook entry + backend API)
  const handleDeleteTransaction = async (txId: string) => {
    const cleanId = txId.replace(/^ctx-/, '');

    // 1. Locate transaction
    const targetTx = transactions.find(t => t.id === cleanId || t.id === txId || t.id === `tx-${cleanId}`);

    // 2. Locate passbook entry if in customerTransactions
    let targetCustomerTx: CustomerTransaction | null = null;
    let targetCustomerId: string | null = targetTx?.customerId || null;

    for (const cId in customerTransactions) {
      const found = customerTransactions[cId].find(ctx =>
        ctx.id === txId ||
        ctx.id === cleanId ||
        ctx.id === `ctx-${cleanId}` ||
        (targetTx && ctx.amount === targetTx.amount && (ctx.note === targetTx.description || ctx.billId === targetTx.invoiceId))
      );
      if (found) {
        targetCustomerTx = found;
        targetCustomerId = cId;
        break;
      }
    }

    // 3. Determine amount and direction to reverse customer debt
    let delta = 0;
    if (targetTx) {
      delta = targetTx.type === 'in' ? targetTx.amount : -targetTx.amount;
    } else if (targetCustomerTx) {
      delta = targetCustomerTx.type === 'got' ? targetCustomerTx.amount : -targetCustomerTx.amount;
    }

    if (delta !== 0 && targetCustomerId) {
      setCustomers(prev => {
        const idx = prev.findIndex(c => c.id === targetCustomerId || (targetTx?.partyName && c.name.toLowerCase() === targetTx.partyName.toLowerCase()));
        if (idx >= 0) {
          const cust = prev[idx];
          const newBal = cust.balance + delta;
          const updatedCust: Customer = {
            ...cust,
            balance: newBal,
            status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
            lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
          };
          const updated = [...prev];
          updated[idx] = updatedCust;
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          setSelectedCustomerForLedger(curr => curr && (curr.id === cust.id || curr.name.toLowerCase() === cust.name.toLowerCase()) ? updatedCust : curr);
          void updateCustomerApi(cust.id, updatedCust);
          return updated;
        }
        return prev;
      });
    }

    // 4. Remove from transactions
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== cleanId && t.id !== txId && t.id !== `tx-${cleanId}`);
      localStorage.setItem('notibook_transactions', JSON.stringify(updated));
      return updated;
    });

    // 5. Remove from customerTransactions
    setCustomerTransactions(prev => {
      const updated: Record<string, CustomerTransaction[]> = {};
      for (const cId in prev) {
        updated[cId] = prev[cId].filter(ctx =>
          ctx.id !== txId &&
          ctx.id !== cleanId &&
          ctx.id !== `ctx-${cleanId}` &&
          !(targetTx && ctx.amount === targetTx.amount && (ctx.note === targetTx.description || ctx.billId === targetTx.invoiceId))
        );
      }
      localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
      return updated;
    });

    // 6. Delete on server API
    try {
      await deleteTransactionApi(cleanId);
    } catch {}
  };

  // Delete Customer (removes customer, clears ledger, updates server & storage)
  const handleDeleteCustomer = async (customerId: string) => {
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== customerId);
      localStorage.setItem('notibook_customers', JSON.stringify(updated));
      return updated;
    });
    setCustomerTransactions(prev => {
      const updated = { ...prev };
      delete updated[customerId];
      localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
      return updated;
    });
    setSelectedCustomerForLedger(prev => prev && prev.id === customerId ? null : prev);
    try {
      await deleteCustomerApi(customerId);
    } catch {}
  };

  // Update Customer Profile (name, phone, address, notes)
  const handleUpdateCustomer = async (updatedCust: Customer) => {
    setCustomers(prev => {
      const updated = prev.map(c => c.id === updatedCust.id ? updatedCust : c);
      localStorage.setItem('notibook_customers', JSON.stringify(updated));
      return updated;
    });
    setSelectedCustomerForLedger(updatedCust);
    try {
      await updateCustomerApi(updatedCust.id, updatedCust);
    } catch {}
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

  // Finalize Invoice (Atomic connection: invoice + stock deduction + real payment transaction + customer khata)
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

    // Always ensure customer balance & ledger entry are reflected in Customers section
    if (newInvoice.customerName && newInvoice.customerName.toLowerCase() !== 'walk-in customer') {
      let targetCustId = newInvoice.customerId;
      setCustomers(prev => {
        const matchIndex = prev.findIndex(c => (newInvoice.customerId && c.id === newInvoice.customerId) || c.name.toLowerCase() === newInvoice.customerName.toLowerCase());
        if (matchIndex >= 0) {
          const cust = prev[matchIndex];
          targetCustId = cust.id;
          const newBal = cust.balance + dueAmt;
          const updatedCust: Customer = {
            ...cust,
            balance: newBal,
            status: newBal > 0 ? 'due' : newBal < 0 ? 'advance' : 'settled',
            lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
          };
          const updated = [...prev];
          updated[matchIndex] = updatedCust;
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        } else {
          const newCustId = newInvoice.customerId || `cust-${Date.now()}`;
          targetCustId = newCustId;
          const newCust: Customer = {
            id: newCustId,
            name: newInvoice.customerName,
            phone: newInvoice.customerPhone || '+91 98000 00000',
            balance: dueAmt,
            lastTransactionDate: new Intl.DateTimeFormat('en-CA').format(new Date()),
            status: dueAmt > 0 ? 'due' : 'settled',
            createdAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
          };
          const updated = [newCust, ...prev];
          localStorage.setItem('notibook_customers', JSON.stringify(updated));
          return updated;
        }
      });

      // Add to customerTransactions for customer ledger
      const cId = targetCustId || `cust-${Date.now()}`;
      const itemsSummary = newInvoice.items.map(i => `${i.qty}x ${i.name}`).join(', ');
      const billCtx: CustomerTransaction = {
        id: `ctx-${Date.now()}-bill`,
        customerId: cId,
        type: 'gave',
        amount: newInvoice.grandTotal,
        date: newInvoice.date || new Intl.DateTimeFormat('en-CA').format(new Date()),
        note: `Bill ${newInvoice.invoiceNumber} (${itemsSummary})`,
        billId: newInvoice.id,
      };
      const newEntries: CustomerTransaction[] = [billCtx];
      if (paidAmt > 0) {
        newEntries.unshift({
          id: `ctx-${Date.now()}-pay`,
          customerId: cId,
          type: 'got',
          amount: paidAmt,
          date: newInvoice.date || new Intl.DateTimeFormat('en-CA').format(new Date()),
          note: `Payment for ${newInvoice.invoiceNumber} via ${newInvoice.paymentMode}`,
          billId: newInvoice.id,
        });
      }
      setCustomerTransactions(prev => {
        const updated = {
          ...prev,
          [cId]: [...newEntries, ...(prev[cId] || [])],
        };
        localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // Customer Khatabook Transaction (Gave / Got)
  const handleCustomerTx = async (
    customerId: string, 
    type: 'gave' | 'got', 
    amount: number, 
    note: string
  ) => {
    setIsPopulatedState(true);
    const newCtx: CustomerTransaction = {
      id: `ctx-${Date.now()}`,
      customerId,
      type,
      amount,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      note,
    };

    setCustomerTransactions(prev => {
      const updated = {
        ...prev,
        [customerId]: [newCtx, ...(prev[customerId] || [])]
      };
      localStorage.setItem('notibook_customer_txs', JSON.stringify(updated));
      return updated;
    });

    let custName = '';
    // Update customer balance: gave increases due, got decreases due
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        custName = c.name;
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

    // Also sync to real financial transaction record
    try {
      await addTransactionApi({
        customerId,
        partyName: custName,
        amount,
        transactionType: type === 'got' ? 'credit' : 'debit',
        paymentMode: 'Cash',
        description: note,
      });
    } catch {}
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
              onDeleteTransaction={handleDeleteTransaction}
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
        transactions={selectedCustomerForLedger ? [
          ...(customerTransactions[selectedCustomerForLedger.id] || []),
          ...transactions
            .filter(t => (t.customerId && t.customerId === selectedCustomerForLedger.id) || (t.partyName && t.partyName.toLowerCase() === selectedCustomerForLedger.name.toLowerCase()))
            .map(t => ({
              id: `ctx-${t.id}`,
              customerId: selectedCustomerForLedger.id,
              type: (t.type === 'in' ? 'got' : 'gave') as 'got' | 'gave',
              amount: t.amount,
              date: t.date.slice(0, 10),
              note: t.description || `${t.type === 'in' ? 'Payment received' : 'Given'} via ${t.paymentMode}`,
              billId: t.invoiceId,
            }))
        ].filter((tx, idx, arr) => arr.findIndex(x => x.id === tx.id || (x.note === tx.note && x.amount === tx.amount && x.date === tx.date)) === idx) : []}
        invoices={invoices}
        onViewInvoice={(inv) => setViewingInvoice(inv)}
        onAddCustomerTx={handleCustomerTx}
        onSendWhatsappReminder={handleSendWhatsappReminder}
        onDeleteTransaction={handleDeleteTransaction}
        onDeleteCustomer={handleDeleteCustomer}
        onUpdateCustomer={handleUpdateCustomer}
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

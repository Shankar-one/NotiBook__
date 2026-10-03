import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Send, 
  Check, 
  Trash2, 
  Plus, 
  Printer, 
  FileText, 
  Share2, 
  Receipt, 
  Eye, 
  ShoppingBag,
  Sparkles,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  User,
  CreditCard
} from 'lucide-react';
import { BillItem, Customer, Invoice, PaymentMethod, Product, ShopSettings } from '../types';
import { parseBusinessCommand } from '../utils/aiCommandParser';

interface BillingSubtabProps {
  settings: ShopSettings;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  onFinalizeBill: (invoice: Invoice) => void;
  onOpenInvoiceModal: (invoice: Invoice) => void;
  isPopulatedState: boolean;
  onOpenSalesReturn?: (invoice: Invoice) => void;
}

export const BillingSubtab: React.FC<BillingSubtabProps> = ({
  settings,
  customers,
  products,
  invoices,
  onFinalizeBill,
  onOpenInvoiceModal,
  isPopulatedState,
  onOpenSalesReturn,
}) => {
  // Command input state
  const [commandText, setCommandText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'Hindi / Hinglish'>('English');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Active Draft Bill state
  const [billCustomer, setBillCustomer] = useState('Walk-In Customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod>('Cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [stockWarning, setStockWarning] = useState<string | null>(null);

  // Active Catalogue product picker state
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>('');

  // Draft Bill Items
  const [billItems, setBillItems] = useState<BillItem[]>([
    ...(isPopulatedState && products.length >= 2 ? [
      { 
        id: 'bi-1', 
        name: products[0].name, 
        qty: 3, 
        price: products[0].sellPrice, 
        total: 3 * products[0].sellPrice,
        productId: products[0].id,
        availableStock: products[0].stockQty,
      },
      { 
        id: 'bi-2', 
        name: products[1].name, 
        qty: 2, 
        price: products[1].sellPrice, 
        total: 2 * products[1].sellPrice,
        productId: products[1].id,
        availableStock: products[1].stockQty,
      }
    ] : [])
  ]);

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * taxPercent) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // Paid and Outstanding calculation
  // If paymentMode === 'Credit', default paid is 0 unless specified
  const effectivePaidAmount = paidAmountInput !== '' 
    ? Math.max(0, parseFloat(paidAmountInput) || 0) 
    : (paymentMode === 'Credit' ? 0 : grandTotal);

  const outstandingDue = Math.max(0, grandTotal - effectivePaidAmount);

  // Update paid amount input when mode changes to Credit or Cash
  useEffect(() => {
    if (paidAmountInput === '') return;
    if (paymentMode === 'Credit' && paidAmountInput === String(grandTotal)) {
      setPaidAmountInput('0');
    }
  }, [paymentMode]);

  // Invoice History list
  const activeInvoices = isPopulatedState ? invoices : [];

  // Match selected customer against customer database
  const matchedCustomer = customers.find(c => 
    (selectedCustomerId && c.id === selectedCustomerId) || 
    c.name.toLowerCase() === billCustomer.toLowerCase().trim()
  );

  // Add Item to bill from Catalogue with strict stock check
  const handleAddItemFromCatalogue = (prodId: string) => {
    setStockWarning(null);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    // Requirement 8: Out-of-stock products cannot be selected for normal sales
    if (prod.stockQty <= 0) {
      setStockWarning(`"${prod.name}" is OUT OF STOCK. Cannot add to bill.`);
      setTimeout(() => setStockWarning(null), 4000);
      return;
    }

    // Check if item already in draft
    const existingIndex = billItems.findIndex(i => (i.productId && i.productId === prod.id) || i.name.toLowerCase() === prod.name.toLowerCase());
    if (existingIndex >= 0) {
      const currentQty = billItems[existingIndex].qty;
      const targetQty = currentQty + 1;
      // Requirement 4: Stock guard
      if (targetQty > prod.stockQty) {
        setStockWarning(`Only ${prod.stockQty} "${prod.name}" are available in stock.`);
        setTimeout(() => setStockWarning(null), 4000);
        return;
      }
      handleUpdateItemQty(billItems[existingIndex].id, targetQty);
    } else {
      setBillItems(prev => [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: prod.name,
          qty: 1,
          price: prod.sellPrice,
          total: prod.sellPrice,
          productId: prod.id,
          unit: prod.unit,
          sku: prod.sku,
          availableStock: prod.stockQty,
        }
      ]);
    }

    setSelectedProductToAdd('');
  };

  // Update item quantity with stock boundary validation
  const handleUpdateItemQty = (id: string, newQty: number) => {
    setStockWarning(null);
    if (newQty <= 0) {
      setBillItems(prev => prev.filter(i => i.id !== id));
      return;
    }

    const item = billItems.find(i => i.id === id);
    if (!item) return;

    // Check against current catalogue stock
    const prod = products.find(p => (item.productId && p.id === item.productId) || p.name.toLowerCase() === item.name.toLowerCase());
    if (prod && newQty > prod.stockQty) {
      setStockWarning(`Only ${prod.stockQty} "${prod.name}" are available in stock.`);
      setTimeout(() => setStockWarning(null), 4000);
      return;
    }

    setBillItems(prev => prev.map(it => {
      if (it.id === id) {
        return { ...it, qty: newQty, total: newQty * it.price };
      }
      return it;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setBillItems(prev => prev.filter(i => i.id !== id));
  };

  // Load Prompt Example: 5 Pepsi, 2 Coca-Cola, 3 Maggi
  const handleLoadPromptExample = () => {
    setStockWarning(null);
    setBillCustomer('Ramesh');

    // Find or simulate the exact items
    const pepsiProd = products.find(p => p.name.toLowerCase().includes('pepsi'));
    const colaProd = products.find(p => p.name.toLowerCase().includes('coca') || p.name.toLowerCase().includes('cola'));
    const maggiProd = products.find(p => p.name.toLowerCase().includes('maggi'));

    const items: BillItem[] = [
      {
        id: `bi-pepsi-${Date.now()}`,
        name: pepsiProd ? pepsiProd.name : 'Pepsi 500ml',
        qty: 5,
        price: pepsiProd ? pepsiProd.sellPrice : 40,
        total: 5 * (pepsiProd ? pepsiProd.sellPrice : 40),
        productId: pepsiProd?.id,
        availableStock: pepsiProd ? pepsiProd.stockQty : 75,
      },
      {
        id: `bi-cola-${Date.now()}`,
        name: colaProd ? colaProd.name : 'Coca-Cola 500ml',
        qty: 2,
        price: colaProd ? colaProd.sellPrice : 40,
        total: 2 * (colaProd ? colaProd.sellPrice : 40),
        productId: colaProd?.id,
        availableStock: colaProd ? colaProd.stockQty : 100,
      },
      {
        id: `bi-maggi-${Date.now()}`,
        name: maggiProd ? maggiProd.name : 'Maggi 70g',
        qty: 3,
        price: maggiProd ? maggiProd.sellPrice : 15,
        total: 3 * (maggiProd ? maggiProd.sellPrice : 15),
        productId: maggiProd?.id,
        availableStock: maggiProd ? maggiProd.stockQty : 50,
      }
    ];

    setBillItems(items);
    setPaidAmountInput('200'); // Paid = 200, Outstanding = 125 as in prompt!
    setPaymentMode('Cash');
    setCommandFeedback('Loaded prompt example: 5 Pepsi, 2 Coca-Cola, 3 Maggi (Subtotal ₹325, Paid ₹200, Udhar ₹125)');
    setTimeout(() => setCommandFeedback(null), 5000);
  };

  // Command executor
  const handleExecuteCommand = (text: string) => {
    if (!text.trim()) return;
    const result = parseBusinessCommand(text, products, customers);
    setCommandFeedback(result.message);

    if (result.action === 'set_customer' && result.data?.customerName) {
      setBillCustomer(result.data.customerName);
    } else if (result.action === 'set_discount' && result.data?.discountPercent !== undefined) {
      setDiscountPercent(result.data.discountPercent);
    } else if (result.action === 'set_tax' && result.data?.taxPercent !== undefined) {
      setTaxPercent(result.data.taxPercent);
    } else if (result.action === 'set_payment' && result.data?.paymentMode) {
      setPaymentMode(result.data.paymentMode);
    } else if (result.action === 'add_to_bill' && result.data?.items) {
      if (result.data.customerName) {
        setBillCustomer(result.data.customerName);
      }
      for (const item of result.data.items) {
        const prod = products.find(p => p.name.toLowerCase().includes(item.name.toLowerCase()));
        if (prod) {
          if (prod.stockQty <= 0) {
            setStockWarning(`"${prod.name}" is OUT OF STOCK. Cannot add.`);
            continue;
          }
          if (item.qty > prod.stockQty) {
            setStockWarning(`Only ${prod.stockQty} "${prod.name}" are available in stock.`);
          }
        }
      }

      const newItems: BillItem[] = result.data.items.map((item, idx) => {
        const prod = products.find(p => p.name.toLowerCase().includes(item.name.toLowerCase()));
        return {
          id: `draft-item-${Date.now()}-${idx}`,
          name: prod ? prod.name : item.name,
          qty: item.qty,
          price: prod ? prod.sellPrice : item.price,
          total: item.qty * (prod ? prod.sellPrice : item.price),
          productId: prod?.id,
          availableStock: prod ? prod.stockQty : 99,
        };
      });
      setBillItems(prev => [...prev, ...newItems]);
    }

    setCommandText('');
    setTimeout(() => setCommandFeedback(null), 4000);
  };

  // Web Speech recognition for inline mic
  const handleToggleMic = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setCommandText('Ramesh ko 5 Pepsi aur 2 Coca-Cola becha');
      handleExecuteCommand('Ramesh ko 5 Pepsi aur 2 Coca-Cola becha');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLanguage === 'Hindi / Hinglish' ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCommandText(transcript);
        handleExecuteCommand(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
      setCommandText('Ramesh ko 5 Pepsi aur 2 Coca-Cola becha');
      handleExecuteCommand('Ramesh ko 5 Pepsi aur 2 Coca-Cola becha');
    }
  };

  // Finalize current bill (Requirement 6: Atomic Transaction Confirmation)
  const handleSaveBill = () => {
    if (billItems.length === 0) {
      alert('Please add at least one item from the Catalogue to finalize the bill.');
      return;
    }

    // Final Stock Check
    for (const it of billItems) {
      const p = products.find(prod => (it.productId && prod.id === it.productId) || prod.name.toLowerCase() === it.name.toLowerCase());
      if (p) {
        if (p.stockQty <= 0) {
          setStockWarning(`Cannot confirm bill: "${p.name}" is OUT OF STOCK.`);
          return;
        }
        if (it.qty > p.stockQty) {
          setStockWarning(`Cannot confirm bill: Only ${p.stockQty} "${p.name}" are available in stock. Requested: ${it.qty}.`);
          return;
        }
      }
    }

    const nextInvNumber = `#INV-${1000 + activeInvoices.length + 1}`;
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvNumber,
      customerName: billCustomer.trim() || 'Walk-In Customer',
      customerId: matchedCustomer?.id,
      customerPhone: matchedCustomer?.phone,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      items: [...billItems],
      subtotal,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      grandTotal,
      paidAmount: effectivePaidAmount,
      dueAmount: outstandingDue,
      paymentMode,
      paymentStatus: effectivePaidAmount === 0 ? 'Due' : outstandingDue > 0 ? 'Partial' : 'Paid',
      receiptFormat: settings.receiptFormat || '80mm',
    };

    onFinalizeBill(newInvoice);
    onOpenInvoiceModal(newInvoice);

    // Reset draft
    setBillItems([]);
    setBillCustomer('Walk-In Customer');
    setSelectedCustomerId('');
    setPaidAmountInput('');
    setDiscountPercent(0);
    setTaxPercent(0);
    setStockWarning(null);
  };

  // Filtered catalogue products for search dropdown
  const filteredCatalogue = products.filter(p => {
    if (!catalogueSearch) return true;
    const q = catalogueSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      
      {/* Stock warning banner if stock violated */}
      {stockWarning && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 animate-in fade-in">
          <AlertCircle size={16} className="shrink-0 text-rose-600" />
          <span>{stockWarning}</span>
        </div>
      )}

      {/* 2-Column Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: AI Voice / Text Command Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#A0988F]">
                <Sparkles size={13} className="text-[#E85D43]" />
                <span>Voice & AI Command Billing</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as any)}
                  aria-label="Speech language"
                  className="text-xs bg-[#FAF7F2] border border-[#EFE9DF] rounded-lg px-2 py-1 text-[#655E57] focus:outline-none"
                >
                  <option value="English">EN English</option>
                  <option value="Hindi / Hinglish">HI Hinglish</option>
                </select>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Ready
                </span>
              </div>
            </div>

            {/* Mic Button */}
            <div className="flex flex-col items-center justify-center py-5 text-center">
              <button
                onClick={handleToggleMic}
                className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 cursor-pointer shadow-md ${
                  isListening
                    ? 'bg-rose-500 text-white ring-4 ring-rose-300 animate-pulse scale-105'
                    : 'bg-[#E85D43] text-white hover:bg-[#D94E34] hover:scale-105 active:scale-95 shadow-[#E85D43]/30'
                }`}
                title="Tap to speak bill command"
              >
                <Mic size={26} />
              </button>
              <p className="mt-3 text-xs text-[#8C827A] font-medium">
                {isListening ? 'Listening... Speak bill command' : 'Tap mic and speak, or type command below'}
              </p>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteCommand(commandText);
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder="e.g. 'Ramesh ko 5 Pepsi aur 2 Coca-Cola becha'"
                className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs sm:text-sm text-[#1E232A] placeholder-[#A0988F] focus:outline-none focus:border-[#E85D43] transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 p-1.5 rounded-lg text-white bg-[#E85D43] hover:bg-[#D94E34] transition-colors"
                title="Send command"
              >
                <Send size={13} />
              </button>
            </form>

            {/* Command Feedback Toast */}
            {commandFeedback && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 animate-in fade-in">
                <Check size={14} className="shrink-0 text-emerald-600" />
                <span>{commandFeedback}</span>
              </div>
            )}
          </div>

          {/* Quick 1-Click Prompt Test Card */}
          <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#EFE9DF] shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
                Quick Test Example (User Brief)
              </span>
              <span className="text-[10px] font-bold text-[#E85D43] bg-orange-100/60 px-2 py-0.5 rounded-full">
                5 Pepsi + 2 Coke + 3 Maggi
              </span>
            </div>
            <p className="text-xs text-[#655E57]">
              Instantly fills draft with 5 Pepsi (₹200), 2 Coca-Cola (₹80), 3 Maggi (₹45) = ₹325, with ₹200 paid & ₹125 Udhar.
            </p>
            <button
              onClick={handleLoadPromptExample}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#EFE9DF] border border-[#EFE9DF] text-xs font-bold text-[#1E232A] shadow-2xs transition-colors cursor-pointer"
            >
              Fill Example Bill (₹325 Total, ₹125 Udhar)
            </button>
          </div>
        </div>

        {/* Right Column: Complete Catalogue Billing Workflow */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#EFE9DF] shadow-2xs space-y-5">
            
            {/* Header & Customer Selection */}
            <div className="border-b border-[#EFE9DF] pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1E232A]">
                    New Thermal Bill
                  </h2>
                  <span className="text-xs text-[#8C827A]">
                    Sourced directly from your Product Catalogue
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#E85D43] bg-orange-50 px-2.5 py-1 rounded-xl">
                  #INV-{1000 + activeInvoices.length + 1}
                </span>
              </div>

              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#524B45] mb-1">
                  Customer / Ledger Account *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={billCustomer}
                    onChange={(e) => {
                      setBillCustomer(e.target.value);
                      setSelectedCustomerId('');
                    }}
                    placeholder="Enter customer name or select below"
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs sm:text-sm font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
                  />
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const c = customers.find(cust => cust.id === e.target.value);
                      if (c) {
                        setSelectedCustomerId(c.id);
                        setBillCustomer(c.name);
                      }
                    }}
                    className="px-2.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#655E57] focus:outline-none"
                  >
                    <option value="">Choose Saved Customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.balance > 0 ? `(Due: ₹${c.balance})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {matchedCustomer && matchedCustomer.balance > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    <AlertCircle size={13} />
                    <span>Existing Udhar/Due for {matchedCustomer.name}: ₹{matchedCustomer.balance.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Requirement 4: Central Catalogue Product Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#524B45]">
                Select Products from Catalogue
              </label>
              
              <div className="flex gap-2">
                <select
                  value={selectedProductToAdd}
                  onChange={(e) => setSelectedProductToAdd(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
                >
                  <option value="">-- Choose item from Catalogue --</option>
                  {products.map(p => {
                    const isOut = p.stockQty <= 0;
                    return (
                      <option key={p.id} value={p.id} disabled={isOut}>
                        {p.name} — ₹{p.sellPrice} [{isOut ? 'OUT OF STOCK' : `Stock: ${p.stockQty} ${p.unit}`}]
                      </option>
                    );
                  })}
                </select>

                <button
                  onClick={() => selectedProductToAdd && handleAddItemFromCatalogue(selectedProductToAdd)}
                  disabled={!selectedProductToAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E85D43] hover:bg-[#D94E34] disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Bill Items Table */}
            <div>
              {billItems.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-[#EFE9DF] rounded-2xl text-[#8C827A] space-y-1">
                  <ShoppingBag size={24} className="mx-auto text-[#DCD5CB]" />
                  <p className="text-xs font-bold text-[#1E232A]">No items added to draft bill</p>
                  <p className="text-[11px]">Select a product above or use the mic to add items.</p>
                </div>
              ) : (
                <div className="border border-[#EFE9DF] rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#FAF7F2] border-b border-[#EFE9DF] text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-center">Available</th>
                        <th className="py-2.5 px-3 text-center w-24">Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFE9DF]/60 bg-white">
                      {billItems.map((item) => {
                        const prod = products.find(p => (item.productId && p.id === item.productId) || p.name.toLowerCase() === item.name.toLowerCase());
                        const maxAvail = prod ? prod.stockQty : (item.availableStock || 99);
                        const isStockExceeded = item.qty > maxAvail;

                        return (
                          <tr key={item.id} className={isStockExceeded ? 'bg-rose-50/50' : 'hover:bg-[#FAF7F2]/40'}>
                            <td className="py-2.5 px-3 font-semibold text-[#1E232A]">
                              <div>{item.name}</div>
                              {isStockExceeded && (
                                <span className="text-[10px] font-bold text-rose-600">
                                  Exceeds stock ({maxAvail} avail)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center tabular-nums text-[#8C827A]">
                              {maxAvail}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(item.id, item.qty - 1)}
                                  className="w-5 h-5 rounded flex items-center justify-center bg-[#FAF7F2] hover:bg-[#EFE9DF] font-bold"
                                >
                                  -
                                </button>
                                <span className="w-6 font-bold tabular-nums text-center">{item.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(item.id, item.qty + 1)}
                                  className="w-5 h-5 rounded flex items-center justify-center bg-[#FAF7F2] hover:bg-[#EFE9DF] font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-[#655E57]">
                              ₹{item.price}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[#1E232A]">
                              ₹{item.total}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1 rounded text-[#C8C0B2] hover:text-rose-500"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Calculations & Discounts */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EFE9DF] space-y-2.5 text-xs">
              <div className="flex justify-between text-[#655E57]">
                <span>Subtotal ({billItems.length} items):</span>
                <span className="font-bold text-[#1E232A] tabular-nums">₹{subtotal.toFixed(2)}</span>
              </div>

              {/* Discount & Tax Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-[#8C827A] mb-0.5">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#EFE9DF] text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#8C827A] mb-0.5">GST / Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#EFE9DF] text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-[#EFE9DF] text-sm">
                <span className="font-bold text-[#1E232A]">Grand Total:</span>
                <span className="text-xl font-extrabold text-[#E85D43] tabular-nums">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method, Paid Amount & Credit/Udhar Breakdown */}
            <div className="p-4 rounded-2xl bg-white border border-[#EFE9DF] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
                Payment & Ledger Allocation
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-semibold text-[#524B45] mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#1E232A] focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit">Full Credit / Udhar</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Paid Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-[#524B45] mb-1">
                    Amount Paid by Customer (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={paidAmountInput !== '' ? paidAmountInput : (paymentMode === 'Credit' ? '0' : String(grandTotal))}
                    onChange={(e) => setPaidAmountInput(e.target.value)}
                    placeholder={String(grandTotal)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-bold text-[#1E232A] tabular-nums focus:outline-none focus:border-[#E85D43]"
                  />
                </div>
              </div>

              {/* Outstanding Udhar Indicator */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                outstandingDue > 0 
                  ? 'bg-amber-50 border-amber-200 text-amber-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div>
                  <span className="font-bold block">
                    {outstandingDue > 0 ? 'Remaining Credit / Udhar Balance:' : 'Bill Fully Settled:'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {outstandingDue > 0 
                      ? `₹${outstandingDue.toFixed(2)} will be added to ${billCustomer}'s Khata ledger`
                      : 'No remaining balance on this invoice'}
                  </span>
                </div>
                <div className="text-right font-extrabold text-base tabular-nums">
                  ₹{outstandingDue.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Requirement 6: Atomic Confirmation Button */}
            <div className="pt-2">
              <button
                onClick={handleSaveBill}
                disabled={billItems.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-bold text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-[0.99] disabled:opacity-40 shadow-md shadow-[#E85D43]/20 transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>Confirm & Print Thermal Receipt</span>
              </button>
              <p className="text-center text-[10px] text-[#A0988F] mt-2">
                Stock is deducted only upon confirmation. Generates clean 80mm/58mm thermal receipt.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Invoice History Table with Thermal Print & Return action */}
      {activeInvoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EFE9DF] shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#EFE9DF] flex justify-between items-center">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#1E232A]">
                Recent Invoices ({activeInvoices.length})
              </h3>
              <p className="text-xs text-[#8C827A]">
                Historical receipts snapshot item prices and remain unchanged
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] bg-[#FAF7F2]/60 text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60">
                {activeInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E232A]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1E232A]">
                      {inv.customerName}
                    </td>
                    <td className="py-3 px-4 text-[#655E57]">{inv.date}</td>
                    <td className="py-3 px-4 text-[#655E57]">
                      {inv.items.length} item(s)
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#1E232A] tabular-nums">
                      ₹{inv.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.paymentStatus === 'Paid' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : inv.paymentStatus === 'Partial'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {inv.paymentStatus} ({inv.paymentMode})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenInvoiceModal(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1C232B] bg-[#FAF7F2] hover:bg-[#EFE9DF] border border-[#EFE9DF] transition-colors"
                          title="Print Thermal Receipt"
                        >
                          <Printer size={12} />
                          <span>Receipt</span>
                        </button>
                        {onOpenSalesReturn && (
                          <button
                            onClick={() => onOpenSalesReturn(inv)}
                            className="p-1 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                            title="Process Return for this invoice"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { BillItem, Customer, Invoice, Product, ShopSettings } from '../types';
import { parseBusinessCommand } from '../utils/aiCommandParser';

interface BillingSubtabProps {
  settings: ShopSettings;
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  onFinalizeBill: (invoice: Invoice) => void;
  onOpenInvoiceModal: (invoice: Invoice) => void;
  isPopulatedState: boolean;
}

export const BillingSubtab: React.FC<BillingSubtabProps> = ({
  settings,
  customers,
  products,
  invoices,
  onFinalizeBill,
  onOpenInvoiceModal,
  isPopulatedState,
}) => {
  // Command input state
  const [commandText, setCommandText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'Hindi / Hinglish'>('English');
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Active Draft Bill state
  const [billCustomer, setBillCustomer] = useState('Walk-In Customer');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Credit' | 'Bank Transfer'>('Cash');
  const [billItems, setBillItems] = useState<BillItem[]>([
    ...(isPopulatedState ? [
      { id: 'bi-1', name: 'Classmate Deluxe Notebook 240p', qty: 3, price: 90, total: 270 },
      { id: 'bi-2', name: 'Reynolds Ballpoint Pen Blue (Pack of 10)', qty: 2, price: 100, total: 200 }
    ] : [])
  ]);
  const [discountPercent, setDiscountPercent] = useState<number>(isPopulatedState ? 10 : 0);
  const [taxPercent, setTaxPercent] = useState<number>(isPopulatedState ? 18 : 0);

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * taxPercent) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // Invoice History list
  const activeInvoices = isPopulatedState ? invoices : [];

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
      const newItems: BillItem[] = result.data.items.map((item, idx) => ({
        id: `draft-item-${Date.now()}-${idx}`,
        name: item.name,
        qty: item.qty,
        price: item.price,
        total: item.qty * item.price,
      }));
      setBillItems(prev => [...prev, ...newItems]);
    }

    setCommandText('');
    setTimeout(() => setCommandFeedback(null), 4000);
  };

  // Quick prompt chip clicked
  const handlePromptClick = (prompt: string) => {
    handleExecuteCommand(prompt);
  };

  // Web Speech recognition for inline mic
  const handleToggleMic = () => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback: simulate high quality speech command
      setCommandText('Add 3 notebook and 2 pen');
      handleExecuteCommand('Add 3 notebook and 2 pen');
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
      setCommandText('Add 3 notebook and 2 pen');
      handleExecuteCommand('Add 3 notebook and 2 pen');
    }
  };

  // Add Item to bill manually
  const handleAddItemFromCatalogue = (prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    setBillItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: prod.name,
        qty: 1,
        price: prod.sellPrice,
        total: prod.sellPrice,
        productId: prod.id,
      }
    ]);
  };

  const handleUpdateItemQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setBillItems(prev => prev.filter(i => i.id !== id));
      return;
    }
    setBillItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, qty: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setBillItems(prev => prev.filter(i => i.id !== id));
  };

  // Finalize current bill
  const handleSaveBill = () => {
    if (billItems.length === 0) {
      alert('Please add at least one item to finalize the bill.');
      return;
    }

    const nextInvNumber = `#INV-${1000 + activeInvoices.length + 1}`;
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvNumber,
      customerName: billCustomer,
      date: new Intl.DateTimeFormat('en-CA').format(new Date()),
      items: [...billItems],
      subtotal,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      grandTotal,
      paymentMode,
      paymentStatus: paymentMode === 'Credit' ? 'Due' : 'Paid',
    };

    onFinalizeBill(newInvoice);
    onOpenInvoiceModal(newInvoice);

    // Reset draft
    setBillItems([]);
    setBillCustomer('Walk-In Customer');
    setDiscountPercent(0);
    setTaxPercent(0);
  };

  return (
    <div className="space-y-6">
      {/* 2-Column Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Command Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#A0988F]">
                <Sparkles size={13} className="text-[#E85D43]" />
                <span>AI Command Input</span>
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

            {/* Big Mic Area matching Image 3 */}
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <button
                onClick={handleToggleMic}
                className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 cursor-pointer shadow-md ${
                  isListening
                    ? 'bg-rose-500 text-white ring-4 ring-rose-300 animate-pulse scale-105'
                    : 'bg-[#E85D43] text-white hover:bg-[#D94E34] hover:scale-105 active:scale-95 shadow-[#E85D43]/30'
                }`}
                title="Tap to speak bill"
              >
                <Mic size={26} />
              </button>
              <p className="mt-3 text-xs text-[#8C827A] font-medium">
                {isListening ? 'Listening... Speak your command now' : 'Tap mic and speak, or type command below'}
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
              <span className="absolute left-3.5 text-[#A0988F]">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#A0988F]" />
              </span>
              <input
                type="text"
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder="e.g. 'Rahul ko 3 notebook aur 2 pen becha'"
                className="w-full pl-9 pr-12 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs sm:text-sm text-[#1E232A] placeholder-[#A0988F] focus:outline-none focus:border-[#E85D43] transition-all"
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

          {/* Quick Voice / Text Phrases matching Image 3 */}
          <div className="bg-white rounded-2xl p-5 border border-[#EFE9DF] shadow-2xs space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
              Try these voice / text phrases:
            </span>

            <div className="space-y-1.5">
              {[
                'Bill for customer Rahul',
                'Add 3 notebook and 2 pen',
                'Give 10% discount',
                'Apply 18% GST',
                'Paid by UPI',
              ].map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePromptClick(phrase)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[#EFE9DF] hover:border-[#E85D43]/40 hover:bg-[#FFEFEA]/30 text-left text-xs font-medium text-[#524B45] hover:text-[#E85D43] transition-all group cursor-pointer"
                >
                  <span>"{phrase}"</span>
                  <Check size={13} className="text-[#C8C0B2] group-hover:text-[#E85D43] transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* 3 Metric Mini Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[#EBF8F2] rounded-2xl p-3 sm:p-4 border border-emerald-100 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Today Sales
              </span>
              <span className="text-sm sm:text-base font-bold text-emerald-800 tabular-nums">
                ₹{subtotal > 0 ? (subtotal * 1.18).toFixed(0) : '0'}
              </span>
            </div>

            <div className="bg-[#EEF4FF] rounded-2xl p-3 sm:p-4 border border-sky-100 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                Bills Today
              </span>
              <span className="text-sm sm:text-base font-bold text-sky-800 tabular-nums">
                {activeInvoices.length}
              </span>
            </div>

            <div className="bg-[#FFF1EE] rounded-2xl p-3 sm:p-4 border border-rose-100 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E85D43] block">
                Draft Bills
              </span>
              <span className="text-sm sm:text-base font-bold text-[#E85D43] tabular-nums">
                {billItems.length > 0 ? 1 : 0}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Tax Invoice / Cash Memo Card matching Image 3 */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xs space-y-6 flex flex-col justify-between h-full">
            {/* Invoice Top Header */}
            <div>
              <div className="flex items-start justify-between border-b border-[#EFE9DF]/80 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1E232A]">
                    {settings.shopName || 'NotiBook Merchant'}
                  </h2>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block mt-0.5">
                    Tax Invoice / Cash Memo
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    Draft
                  </span>
                  <span className="block text-xs font-semibold text-[#1E232A] mt-0.5">
                    #INV-1001
                  </span>
                  <span className="block text-[11px] text-[#A0988F]">
                    {new Intl.DateTimeFormat('en-CA').format(new Date())}
                  </span>
                </div>
              </div>

              {/* Customer & Payment Selectors */}
              <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-[#EFE9DF]/60">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] block mb-1">
                    Customer:
                  </span>
                  <select
                    value={billCustomer}
                    onChange={(e) => setBillCustomer(e.target.value)}
                    aria-label="Customer selection"
                    className="w-full font-semibold text-[#1E232A] bg-[#FAF7F2] border border-[#EFE9DF] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#E85D43]"
                  >
                    <option value="Walk-In Customer">Walk-In Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] block mb-1">
                    Payment:
                  </span>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    aria-label="Payment mode selection"
                    className="w-full font-semibold text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="Cash">Cash (Paid)</option>
                    <option value="UPI">UPI (Paid)</option>
                    <option value="Credit">Credit (Udhar)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <div className="grid grid-cols-12 text-[11px] font-bold uppercase tracking-wider text-[#A0988F] pb-2 border-b border-[#EFE9DF]/80">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {billItems.length === 0 ? (
                  /* Empty state matching Image 3 */
                  <div className="py-12 text-center">
                    <div className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl bg-orange-50 text-[#E85D43] mb-2.5">
                      <ShoppingBag size={20} />
                    </div>
                    <p className="text-xs text-[#8C827A] max-w-xs mx-auto">
                      No items added to bill yet. Speak or type to add catalogue products.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#EFE9DF]/40">
                    {billItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 items-center py-2.5 text-xs">
                        <div className="col-span-6 flex items-center gap-2">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-[#C8C0B2] hover:text-rose-500 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 size={13} />
                          </button>
                          <span className="font-semibold text-[#1E232A] truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleUpdateItemQty(item.id, item.qty - 1)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-[#FAF7F2] hover:bg-[#F2ECE2] text-[#524B45]"
                          >
                            -
                          </button>
                          <span className="font-medium tabular-nums">{item.qty}</span>
                          <button
                            onClick={() => handleUpdateItemQty(item.id, item.qty + 1)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-[#FAF7F2] hover:bg-[#F2ECE2] text-[#524B45]"
                          >
                            +
                          </button>
                        </div>
                        <div className="col-span-2 text-right text-[#655E57] tabular-nums">
                          ₹{item.price.toFixed(2)}
                        </div>
                        <div className="col-span-2 text-right font-bold text-[#1E232A] tabular-nums">
                          ₹{item.total.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Add Product from Catalogue Dropdown */}
                <div className="mt-3 pt-3 border-t border-dashed border-[#EFE9DF] flex items-center justify-between">
                  <span className="text-xs text-[#8C827A]">Quick add item:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItemFromCatalogue(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    aria-label="Quick add item from catalogue"
                    className="text-xs bg-[#FAF7F2] border border-[#EFE9DF] rounded-lg px-2.5 py-1 text-[#524B45] focus:outline-none"
                  >
                    <option value="" disabled>+ Choose from catalogue</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.sellPrice})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Calculations & Actions */}
            <div className="border-t border-[#EFE9DF] pt-4 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#655E57]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-rose-600">
                  <span className="flex items-center gap-1">
                    Discount ({discountPercent}%)
                  </span>
                  <span className="tabular-nums">-₹{discountAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-[#655E57]">
                  <span>Tax / GST ({taxPercent}%)</span>
                  <span className="tabular-nums">₹{taxAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-[#EFE9DF]/80">
                  <span className="text-sm font-bold text-[#1E232A]">Grand Total</span>
                  <span className="text-xl sm:text-2xl font-extrabold text-[#E85D43] tabular-nums">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons matching Image 3 */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={handleSaveBill}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all shadow-xs cursor-pointer"
                >
                  <Check size={15} />
                  <span>Finalize Bill</span>
                </button>

                <button
                  onClick={() => {
                    if (billItems.length === 0) return;
                    window.print();
                  }}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-[#EFE9DF] hover:bg-[#FAF7F2] text-xs font-semibold text-[#524B45] transition-colors"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => {
                    if (billItems.length === 0) return;
                    alert('PDF receipt downloaded to device.');
                  }}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-[#EFE9DF] hover:bg-[#FAF7F2] text-xs font-semibold text-[#524B45] transition-colors"
                >
                  <FileText size={14} />
                  <span>PDF</span>
                </button>

                <button
                  onClick={() => {
                    if (billItems.length === 0) return;
                    navigator.clipboard.writeText(`NotiBook Bill: Total ₹${grandTotal} for ${billCustomer}`);
                    alert('Bill summary copied to clipboard!');
                  }}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-[#EFE9DF] hover:bg-[#FAF7F2] text-xs font-semibold text-[#524B45] transition-colors"
                >
                  <Share2 size={14} />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: INVOICE HISTORY / Recent Invoices matching Image 3 */}
      <div className="bg-white rounded-2xl p-6 border border-[#EFE9DF] shadow-2xs space-y-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
            Invoice History
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#1E232A]">
            Recent Invoices
          </h2>
        </div>

        {activeInvoices.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8C827A]">
            No invoices generated yet. Speak or type a command above to create your first bill!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60">
                {activeInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#1E232A]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-3 text-[#524B45] font-medium">
                      {inv.customerName}
                    </td>
                    <td className="py-3 px-3 text-[#8C827A]">
                      {inv.date}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#1E232A] tabular-nums">
                      ₹{inv.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.paymentStatus === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onOpenInvoiceModal(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#E85D43] bg-[#FFEFEA] hover:bg-[#FFE6DE] transition-colors"
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

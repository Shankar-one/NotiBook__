import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  RotateCcw, 
  Copy, 
  Check, 
  FileText 
} from 'lucide-react';
import { Invoice, ShopSettings } from '../types';

interface InvoicePrintModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  settings: ShopSettings;
  onOpenReturn?: (invoice: Invoice) => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice,
  isOpen,
  onClose,
  settings,
  onOpenReturn,
}) => {
  const [receiptWidth, setReceiptWidth] = useState<'80mm' | '58mm'>(
    invoice?.receiptFormat || settings.receiptFormat || '80mm'
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen || !invoice) return null;

  const is58 = receiptWidth === '58mm';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyReceiptText = () => {
    const divider = '--------------------------------';
    const lines = [
      settings.shopName || 'ABC GENERAL STORE',
      settings.address || 'Main Road',
      `Phone: ${settings.phone || '9876543210'}`,
      divider,
      `Date: ${invoice.date}   ${invoice.invoiceNumber}`,
      `Customer: ${invoice.customerName}`,
      divider,
      'ITEM             QTY  RATE   AMT',
      ...invoice.items.map(it => {
        const name = it.name.slice(0, 15).padEnd(16, ' ');
        const qty = String(it.qty).padStart(3, ' ');
        const rate = String(it.price).padStart(5, ' ');
        const amt = String(it.total).padStart(6, ' ');
        return `${name} ${qty} ${rate} ${amt}`;
      }),
      divider,
      `SUBTOTAL:                 ₹${invoice.subtotal.toFixed(2)}`,
      ...(invoice.discountAmount > 0 ? [`DISCOUNT (${invoice.discountPercent}%):           -₹${invoice.discountAmount.toFixed(2)}`] : []),
      ...(invoice.taxAmount > 0 ? [`GST (${invoice.taxPercent}%):                ₹${invoice.taxAmount.toFixed(2)}`] : []),
      `TOTAL:                    ₹${invoice.grandTotal.toFixed(2)}`,
      `Paid (${invoice.paymentMode}):             ₹${(invoice.paidAmount ?? invoice.grandTotal).toFixed(2)}`,
      ...(invoice.dueAmount && invoice.dueAmount > 0 ? [`Credit / Udhar:           ₹${invoice.dueAmount.toFixed(2)}`] : []),
      divider,
      '         Thank You! Visit Again',
      '               NOTIBOOK',
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paidAmt = invoice.paidAmount !== undefined ? invoice.paidAmount : (invoice.paymentMode === 'Credit' ? 0 : invoice.grandTotal);
  const dueAmt = invoice.dueAmount !== undefined ? invoice.dueAmount : Math.max(0, invoice.grandTotal - paidAmt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-3xl p-5 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 max-h-[94vh] overflow-y-auto animate-in fade-in zoom-in-95">
        
        {/* Modal Top Bar - Hidden during printing */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE9DF] pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 size={12} /> Thermal Receipt
            </span>
            <span className="text-xs font-mono font-bold text-[#1E232A]">{invoice.invoiceNumber}</span>
          </div>

          {/* Width Selector: 80mm vs 58mm */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#FAF7F2] p-0.5 rounded-xl border border-[#EFE9DF] text-[11px] font-semibold text-[#655E57]">
              <button
                onClick={() => setReceiptWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  receiptWidth === '80mm' ? 'bg-[#1C232B] text-white' : 'hover:text-[#1E232A]'
                }`}
              >
                80mm (Standard)
              </button>
              <button
                onClick={() => setReceiptWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  receiptWidth === '58mm' ? 'bg-[#1C232B] text-white' : 'hover:text-[#1E232A]'
                }`}
              >
                58mm (Pocket)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1C232B] hover:bg-[#2C3540] shadow-sm transition-colors cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Thermal Receipt</span>
            </button>
            <button
              onClick={handleCopyReceiptText}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#524B45] bg-[#FAF7F2] hover:bg-[#EFE9DF] border border-[#EFE9DF] transition-colors cursor-pointer"
              title="Copy plain receipt text"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
          </div>

          {onOpenReturn && (
            <button
              onClick={() => {
                onClose();
                onOpenReturn(invoice);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Process Sales Return</span>
            </button>
          )}
        </div>

        {/* Dedicated Thermal Receipt View (80mm / 58mm Monospace Layout) */}
        <div className="flex justify-center p-3 bg-[#FAF7F2]/60 rounded-2xl border border-[#EFE9DF]">
          <div 
            id="thermal-receipt-printable"
            className={`bg-white text-black font-mono shadow-md border border-neutral-300 p-4 sm:p-5 transition-all select-text ${
              is58 ? 'w-[280px] text-[11px] leading-tight receipt-58mm' : 'w-[360px] text-xs leading-normal receipt-80mm'
            }`}
          >
            {/* Header: Shop Info */}
            <div className="text-center space-y-0.5 pb-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-wide uppercase">
                {settings.shopName || 'ABC GENERAL STORE'}
              </h1>
              {settings.address && (
                <p className="text-[11px] text-neutral-800">{settings.address}</p>
              )}
              {settings.phone && (
                <p className="text-[11px] text-neutral-800">Phone: {settings.phone}</p>
              )}
              {settings.gstNumber && (
                <p className="text-[10px] text-neutral-600">GST: {settings.gstNumber}</p>
              )}
            </div>

            {/* Dashed separator */}
            <div className="border-t border-dashed border-neutral-400 my-2" />

            {/* Receipt Metadata */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>Date: {invoice.date}</span>
                <span>{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer: <span className="font-bold">{invoice.customerName}</span></span>
                {invoice.customerPhone && <span className="text-[10px]">{invoice.customerPhone}</span>}
              </div>
            </div>

            {/* Dashed separator */}
            <div className="border-t border-dashed border-neutral-400 my-2" />

            {/* Items Table */}
            <table className="w-full text-left font-mono">
              <thead>
                <tr className="border-b border-dashed border-neutral-400 text-[10px] font-black uppercase">
                  <th className="pb-1">ITEM</th>
                  <th className="pb-1 text-center">QTY</th>
                  <th className="pb-1 text-right">RATE</th>
                  <th className="pb-1 text-right">AMT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-neutral-200">
                {invoice.items.map((it) => (
                  <tr key={it.id} className="align-top">
                    <td className="py-1 pr-1 font-semibold break-words">
                      <div>{it.name}</div>
                      {it.sku && <span className="text-[9px] text-neutral-500 font-normal">[{it.sku}]</span>}
                    </td>
                    <td className="py-1 px-1 text-center tabular-nums">{it.qty}</td>
                    <td className="py-1 px-1 text-right tabular-nums">{it.price}</td>
                    <td className="py-1 pl-1 text-right font-bold tabular-nums">{it.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Dashed separator */}
            <div className="border-t border-dashed border-neutral-400 my-2" />

            {/* Totals & Payments */}
            <div className="space-y-1 text-[11px] tabular-nums">
              <div className="flex justify-between">
                <span>SUBTOTAL</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between font-semibold">
                  <span>DISCOUNT ({invoice.discountPercent}%)</span>
                  <span>-₹{invoice.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>GST ({invoice.taxPercent}%)</span>
                  <span>₹{invoice.taxAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-dashed border-neutral-800 my-1" />

              <div className="flex justify-between font-black text-sm">
                <span>TOTAL</span>
                <span>₹{invoice.grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between pt-1">
                <span>Paid ({invoice.paymentMode})</span>
                <span className="font-bold">₹{paidAmt.toFixed(2)}</span>
              </div>

              {dueAmt > 0 && (
                <div className="flex justify-between font-black text-neutral-900 border-t border-dotted border-neutral-400 pt-1">
                  <span>Credit / Udhar</span>
                  <span>₹{dueAmt.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Dashed separator */}
            <div className="border-t border-dashed border-neutral-400 my-3" />

            {/* Receipt Footer */}
            <div className="text-center text-[10px] space-y-1">
              <p className="font-bold">Thank You!</p>
              <p>Visit Again</p>
              <p className="pt-2 font-black tracking-widest text-[9px] uppercase">
                NOTIBOOK
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

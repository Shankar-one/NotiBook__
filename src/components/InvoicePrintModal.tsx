import React from 'react';
import { X, Printer, Download, Share2, CheckCircle2 } from 'lucide-react';
import { Invoice, ShopSettings } from '../types';

interface InvoicePrintModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  settings: ShopSettings;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice,
  isOpen,
  onClose,
  settings,
}) => {
  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE9DF] shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} /> Invoice Generated
            </span>
            <span className="text-xs font-semibold text-[#1E232A]">{invoice.invoiceNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#1C232B] hover:bg-[#2C3540] transition-colors"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Invoice Paper Document */}
        <div className="p-6 bg-[#FAF7F2]/40 border border-[#EFE9DF] rounded-2xl space-y-5 text-[#1E232A]">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-[#EFE9DF] pb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#1E232A]">
                {settings.shopName || 'NotiBook Merchant'}
              </h1>
              <p className="text-xs text-[#655E57] mt-0.5">{settings.category || 'Hardware & Paints'}</p>
              <p className="text-xs text-[#8C827A]">{settings.address}</p>
              <p className="text-xs text-[#8C827A]">GSTIN: {settings.gstNumber}</p>
              <p className="text-xs text-[#8C827A]">Phone: {settings.phone}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black uppercase tracking-wider text-[#E85D43]">
                Tax Invoice
              </span>
              <p className="text-sm font-bold text-[#1E232A] mt-1">{invoice.invoiceNumber}</p>
              <p className="text-xs text-[#8C827A]">Date: {invoice.date}</p>
              <span className={`inline-block mt-2 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                invoice.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {invoice.paymentStatus} via {invoice.paymentMode}
              </span>
            </div>
          </div>

          {/* Bill To */}
          <div className="text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] block">
              Billed To
            </span>
            <div className="text-sm font-bold text-[#1E232A] mt-0.5">
              {invoice.customerName}
            </div>
            {invoice.customerPhone && (
              <div className="text-xs text-[#8C827A]">{invoice.customerPhone}</div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] text-[10px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 font-medium text-[#1E232A]">{item.name}</td>
                    <td className="py-2.5 text-center tabular-nums">{item.qty}</td>
                    <td className="py-2.5 text-right text-[#655E57] tabular-nums">₹{item.price.toFixed(2)}</td>
                    <td className="py-2.5 text-right font-bold text-[#1E232A] tabular-nums">₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Breakdown & Total */}
          <div className="border-t border-[#EFE9DF] pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#655E57]">
              <span>Subtotal</span>
              <span className="tabular-nums">₹{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount ({invoice.discountPercent}%)</span>
                <span className="tabular-nums">-₹{invoice.discountAmount.toFixed(2)}</span>
              </div>
            )}
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-[#655E57]">
                <span>GST ({invoice.taxPercent}%)</span>
                <span className="tabular-nums">₹{invoice.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-[#EFE9DF] font-bold text-sm">
              <span>Grand Total</span>
              <span className="text-xl font-extrabold text-[#E85D43] tabular-nums">
                ₹{invoice.grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-4 border-t border-dashed border-[#EFE9DF] text-center text-[11px] text-[#8C827A]">
            <p>Thank you for your business! For queries, contact {settings.phone}</p>
            <p className="mt-0.5 text-[10px] text-[#A0988F]">Generated digitally via NotiBook Smart Merchant System</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-[#EFE9DF] print:hidden">
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Invoice ${invoice.invoiceNumber} for ₹${invoice.grandTotal.toFixed(2)} from ${settings.shopName}`);
              alert('Invoice details copied to clipboard!');
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#524B45] hover:text-[#1E232A]"
          >
            <Share2 size={14} />
            <span>Share Bill</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#E85D43] hover:bg-[#D94E34] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

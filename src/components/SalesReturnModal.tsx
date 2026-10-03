import React, { useState } from 'react';
import { X, RotateCcw, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { Invoice, BillItem } from '../types';

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onConfirmReturn: (params: {
    invoiceId: string;
    items: { productId?: string; name: string; qty: number; price: number }[];
    returnReason?: string;
  }) => void;
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onConfirmReturn,
}) => {
  if (!isOpen || !invoice) return null;

  // Track returned quantities for each item in the invoice
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('Customer return / exchange');

  const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
    const clamped = Math.max(0, Math.min(maxQty, val));
    setReturnQtys(prev => ({
      ...prev,
      [itemId]: clamped,
    }));
  };

  // Calculate total return amount
  let totalRefund = 0;
  const returnItems: { productId?: string; name: string; qty: number; price: number }[] = [];

  for (const item of invoice.items) {
    const qty = returnQtys[item.id] || 0;
    if (qty > 0) {
      totalRefund += item.price * qty;
      returnItems.push({
        productId: item.productId,
        name: item.name,
        qty,
        price: item.price,
      });
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnItems.length === 0) return;

    onConfirmReturn({
      invoiceId: invoice.id,
      items: returnItems,
      returnReason: reason,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-purple-50 text-purple-700">
              <RotateCcw size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Process Sales Return</h2>
              <span className="text-xs text-[#8C827A]">
                Bill {invoice.invoiceNumber} • {invoice.customerName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-[#655E57]">
            Select the item(s) and quantities being returned by the customer. Returned stock will be restored to your Catalogue automatically.
          </p>

          {/* Items Return Table */}
          <div className="border border-[#EFE9DF] rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] border-b border-[#EFE9DF] text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                <tr>
                  <th className="py-2.5 px-3">Item</th>
                  <th className="py-2.5 px-3 text-center">Billed Qty</th>
                  <th className="py-2.5 px-3 text-right">Price</th>
                  <th className="py-2.5 px-3 text-center w-28">Return Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60 bg-white">
                {invoice.items.map((it) => {
                  const currentReturn = returnQtys[it.id] || 0;
                  return (
                    <tr key={it.id} className="hover:bg-[#FAF7F2]/50">
                      <td className="py-2.5 px-3 font-semibold text-[#1E232A]">{it.name}</td>
                      <td className="py-2.5 px-3 text-center tabular-nums text-[#655E57]">{it.qty}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#1E232A]">₹{it.price}</td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(it.id, it.qty, currentReturn - 1)}
                            className="w-6 h-6 rounded-lg bg-[#FAF7F2] hover:bg-[#EFE9DF] font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={it.qty}
                            value={currentReturn}
                            onChange={(e) => handleQtyChange(it.id, it.qty, parseInt(e.target.value, 10) || 0)}
                            className="w-10 text-center font-bold text-xs border border-[#EFE9DF] rounded-md py-0.5"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(it.id, it.qty, currentReturn + 1)}
                            className="w-6 h-6 rounded-lg bg-[#FAF7F2] hover:bg-[#EFE9DF] font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Refund Breakdown */}
          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-purple-900 block">Total Refund / Credit Adjustment:</span>
              <span className="text-[11px] text-purple-700">Stock will increase by total returned units</span>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-purple-900 tabular-nums">
                ₹{totalRefund.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Return Reason / Notes
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Defective seal / customer changed mind"
              className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EFE9DF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#655E57] hover:bg-[#FAF7F2] border border-[#EFE9DF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={returnItems.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Check size={14} />
              <span>Confirm Return (Restore Stock)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

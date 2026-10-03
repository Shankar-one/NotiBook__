import React, { useState } from 'react';
import { X, SlidersHorizontal, Check, AlertCircle } from 'lucide-react';
import { Product } from '../types';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProduct?: Product | null;
  onConfirmAdjust: (params: {
    productId: string;
    newQty: number;
    reason: 'ADJUSTMENT' | 'PURCHASE' | 'SALE' | 'RETURN';
    notes?: string;
  }) => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProduct,
  onConfirmAdjust,
}) => {
  const [productId, setProductId] = useState<string>(selectedProduct?.id || products[0]?.id || '');
  const targetProduct = products.find(p => p.id === productId) || selectedProduct || products[0];

  const [newQty, setNewQty] = useState<string>(String(targetProduct?.stockQty ?? 0));
  const [reason, setReason] = useState<'ADJUSTMENT' | 'PURCHASE' | 'RETURN'>('ADJUSTMENT');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const currentQty = targetProduct?.stockQty ?? 0;
  const parsedNewQty = Math.max(0, parseInt(newQty, 10) || 0);
  const delta = parsedNewQty - currentQty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;

    onConfirmAdjust({
      productId: targetProduct.id,
      newQty: parsedNewQty,
      reason,
      notes: notes.trim() || `${reason} adjustment: ${currentQty} → ${parsedNewQty}`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-[#E85D43]">
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Manual Stock Adjustment</h2>
              <span className="text-xs text-[#8C827A]">Audit-tracked inventory correction</span>
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
          {/* Product selector if not locked */}
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Select Product
            </label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                const p = products.find(prod => prod.id === e.target.value);
                if (p) setNewQty(String(p.stockQty));
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current Stock: {p.stockQty} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Current vs New Quantity comparison */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EFE9DF]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
                Current Stock
              </span>
              <span className="text-lg font-bold text-[#1E232A] tabular-nums">
                {currentQty} {targetProduct?.unit || 'pcs'}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
                Stock Change
              </span>
              <span className={`text-lg font-bold tabular-nums ${
                delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-[#8C827A]'
              }`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </div>
          </div>

          {/* Target Quantity Input */}
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              New Counted Stock Quantity *
            </label>
            <input
              type="number"
              min="0"
              required
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EFE9DF] text-sm font-bold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          {/* Adjustment Reason */}
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Reason for Adjustment
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-medium text-[#1E232A] focus:outline-none"
            >
              <option value="ADJUSTMENT">Physical Audit Correction</option>
              <option value="PURCHASE">New Stock Purchase / Supplier Restock</option>
              <option value="RETURN">Customer Return</option>
            </select>
          </div>

          {/* Reference / Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Notes / Audit Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Weekly physical inventory count / supplier invoice #204"
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
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
            >
              <Check size={14} />
              <span>Save Adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

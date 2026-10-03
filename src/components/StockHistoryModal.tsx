import React, { useState } from 'react';
import { 
  X, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Filter, 
  Package,
  Layers,
  FileText
} from 'lucide-react';
import { StockMovement, Product } from '../types';

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements: StockMovement[];
  products: Product[];
  selectedProductId?: string;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({
  isOpen,
  onClose,
  movements,
  products,
  selectedProductId,
}) => {
  const [filterReason, setFilterReason] = useState<string>('All');
  const [activeProductId, setActiveProductId] = useState<string>(selectedProductId || 'All');

  if (!isOpen) return null;

  const filteredMovements = movements.filter(m => {
    if (activeProductId !== 'All' && m.productId !== activeProductId) return false;
    if (filterReason !== 'All' && m.reason !== filterReason) return false;
    return true;
  });

  const getReasonBadge = (reason: StockMovement['reason']) => {
    switch (reason) {
      case 'SALE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">SALE</span>;
      case 'PURCHASE':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">PURCHASE</span>;
      case 'RETURN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">RETURN</span>;
      case 'CATALOGUE_IMPORT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">PDF IMPORT</span>;
      case 'ADJUSTMENT':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">ADJUSTMENT</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#FFEFEA] text-[#E85D43]">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E232A]">Stock Movement Audit History</h2>
              <p className="text-xs text-[#8C827A] mt-0.5">
                Every confirmed sale, purchase, return, and catalogue import recorded chronologically
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF7F2] p-3 rounded-2xl border border-[#EFE9DF]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#655E57]">Product:</span>
            <select
              value={activeProductId}
              onChange={(e) => setActiveProductId(e.target.value)}
              className="text-xs bg-white border border-[#EFE9DF] rounded-xl px-2.5 py-1.5 font-medium text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            >
              <option value="All">All Products ({products.length})</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#655E57]">Type:</span>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="text-xs bg-white border border-[#EFE9DF] rounded-xl px-2.5 py-1.5 font-medium text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            >
              <option value="All">All Events</option>
              <option value="SALE">Sales</option>
              <option value="PURCHASE">Purchases</option>
              <option value="RETURN">Returns</option>
              <option value="CATALOGUE_IMPORT">PDF Imports</option>
              <option value="ADJUSTMENT">Adjustments</option>
            </select>
          </div>
        </div>

        {/* Audit Movements Table */}
        {filteredMovements.length === 0 ? (
          <div className="py-12 text-center text-[#8C827A] space-y-2">
            <Package size={32} className="mx-auto text-[#DCD5CB]" />
            <p className="text-sm font-semibold">No stock movements recorded yet</p>
            <p className="text-xs">Confirmed sales, catalogue updates, and adjustments will appear here.</p>
          </div>
        ) : (
          <div className="border border-[#EFE9DF] rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-center">Change Qty</th>
                  <th className="py-3 px-3 text-center">Stock After</th>
                  <th className="py-3 px-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60 bg-white">
                {filteredMovements.map((m) => {
                  const isPositive = m.changeQty > 0;
                  return (
                    <tr key={m.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#655E57]">{m.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#1E232A]">{m.productName}</td>
                      <td className="py-2.5 px-3 text-center">{getReasonBadge(m.reason)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-0.5 font-bold tabular-nums text-xs ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {isPositive ? '+' : ''}{m.changeQty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#1E232A] tabular-nums">
                        {m.finalQty}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#655E57]">
                        {m.referenceId || 'Manual adjustment'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-[#EFE9DF]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-[#1C232B] bg-[#FAF7F2] hover:bg-[#EFE9DF] border border-[#EFE9DF] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

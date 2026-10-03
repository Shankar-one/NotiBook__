import React, { useState } from 'react';
import { X, Edit3, Check, DollarSign, Package } from 'lucide-react';
import { Product } from '../types';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSaveProduct: (updated: Product) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSaveProduct,
}) => {
  if (!isOpen || !product) return null;

  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [sellPrice, setSellPrice] = useState(String(product.sellPrice));
  const [buyPrice, setBuyPrice] = useState(String(product.buyPrice));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product.lowStockThreshold || 10));
  const [unit, setUnit] = useState(product.unit || 'pcs');
  const [sku, setSku] = useState(product.sku || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Product = {
      ...product,
      name: name.trim() || product.name,
      category: category.trim() || 'General',
      sellPrice: Math.max(0, parseFloat(sellPrice) || 0),
      buyPrice: Math.max(0, parseFloat(buyPrice) || 0),
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 5),
      unit: unit.trim() || 'pcs',
      sku: sku.trim() || product.sku,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onSaveProduct(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-50 text-[#E85D43]">
              <Edit3 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Edit Catalogue Product</h2>
              <span className="text-xs text-[#8C827A]">Updates apply to all future bills</span>
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
          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#EFE9DF] text-xs font-bold text-[#1E232A] tabular-nums focus:outline-none focus:border-[#E85D43]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Purchase Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-medium text-[#655E57] tabular-nums focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Unit (pcs/bottle/kg)
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Min Stock Alert Level
              </label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                SKU / Barcode
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-mono text-[#1E232A] focus:outline-none"
              />
            </div>
          </div>

          {/* Current Stock Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs">
            <span className="text-[#8C827A]">Current Stock in Inventory:</span>
            <span className="font-bold text-[#1E232A]">{product.stockQty} {product.unit}</span>
          </div>

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
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

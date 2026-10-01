import React, { useState } from 'react';
import { X, PackagePlus } from 'lucide-react';
import { Product } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [unit, setUnit] = useState('pcs');
  const [sku, setSku] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedBuy = parseFloat(buyPrice) || 0;
    const parsedSell = parseFloat(sellPrice) || 0;
    const parsedQty = parseInt(stockQty, 10) || 0;
    const parsedThreshold = parseInt(lowStockThreshold, 10) || 5;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: name.trim(),
      category: category.trim() || 'General',
      buyPrice: parsedBuy,
      sellPrice: parsedSell,
      stockQty: parsedQty,
      lowStockThreshold: parsedThreshold,
      unit,
      sku: sku.trim() || `SKU-${Math.floor(Math.random() * 9000 + 1000)}`,
    };

    onAddProduct(newProd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-orange-50 text-[#E85D43]">
              <PackagePlus size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Add New Product</h2>
              <span className="text-xs text-[#8C827A]">Item for stock & billing catalogue</span>
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
              placeholder="e.g. Asian Paints Apex Ultima 4L"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-sm text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
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
                placeholder="Paints, Stationery, Hardware"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                aria-label="Unit of measurement"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="can">Can / Tin</option>
                <option value="bag">Bag</option>
                <option value="pack">Pack</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="meter">Meter (m)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Buy Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="₹ 0"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Sell Price (₹) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="₹ 0"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-bold text-[#1E232A] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Initial Stock Qty
              </label>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Low Stock Alert At
              </label>
              <input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="5"
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EFE9DF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#655E57] hover:bg-[#FAF7F2] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 transition-all shadow-xs"
            >
              Add to Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

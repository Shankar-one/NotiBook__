import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Upload, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Edit, 
  Trash2,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { Product } from '../types';

interface StocksSubtabProps {
  products: Product[];
  onOpenAddProduct: () => void;
  onUpdateStockQty: (id: string, delta: number) => void;
  onDeleteProduct: (id: string) => void;
  onImportSampleProducts: () => void;
  isPopulatedState: boolean;
  onTogglePopulatedState: () => void;
}

export const StocksSubtab: React.FC<StocksSubtabProps> = ({
  products,
  onOpenAddProduct,
  onUpdateStockQty,
  onDeleteProduct,
  onImportSampleProducts,
  isPopulatedState,
  onTogglePopulatedState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const activeProducts = isPopulatedState ? products : [];

  // Metrics matching Image 5
  const totalProducts = activeProducts.length;
  const lowStockCount = activeProducts.filter(p => p.stockQty <= p.lowStockThreshold).length;
  const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.stockQty * p.sellPrice), 0);

  const categories = ['All', ...Array.from(new Set(activeProducts.map(p => p.category)))];

  const filteredProducts = activeProducts.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterCategory !== 'All' && p.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 3 Metric Stat Cards matching Image 5 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* PRODUCTS */}
        <div className="bg-[#EEF4FF] rounded-2xl p-5 border border-sky-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
            Products
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-sky-950 tracking-tight tabular-nums">
            {totalProducts}
          </div>
        </div>

        {/* LOW STOCK */}
        <div className="bg-[#FFF1EE] rounded-2xl p-5 border border-rose-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E85D43] block">
            Low Stock
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#E85D43] tracking-tight tabular-nums">
            {lowStockCount < 10 ? `0${lowStockCount}` : lowStockCount}
          </div>
        </div>

        {/* STOCK VALUE */}
        <div className="bg-[#EBF8F2] rounded-2xl p-5 border border-emerald-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
            Stock Value
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-900 tracking-tight tabular-nums">
            ₹{totalStockValue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Search & Actions Bar matching Image 5 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C827A]" size={17} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products"
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white border border-[#EFE9DF] text-sm text-[#1E232A] placeholder-[#A0988F] focus:outline-none focus:border-[#E85D43] transition-all shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Upload File button matching Image 5 */}
          <button
            onClick={onImportSampleProducts}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-[#524B45] bg-white hover:bg-[#FAF7F2] border border-[#EFE9DF] shadow-2xs transition-colors cursor-pointer"
            title="Import or upload catalogue"
          >
            <Upload size={15} className="text-[#8C827A]" />
            <span>Upload File</span>
          </button>

          {/* Add product button matching Image 5 */}
          <button
            onClick={onOpenAddProduct}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add product</span>
          </button>
        </div>
      </div>

      {/* Filter Categories if populated */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === cat
                  ? 'bg-[#1C232B] text-white'
                  : 'bg-white text-[#655E57] hover:bg-[#F2ECE2] border border-[#EFE9DF]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      {filteredProducts.length === 0 ? (
        /* Empty state matching Image 5 */
        <div className="bg-white rounded-2xl p-12 sm:p-16 border border-[#EFE9DF] text-center shadow-2xs">
          <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-[#FFEFEA] text-[#E85D43] mb-4">
            <Package size={28} />
          </div>
          <h2 className="text-lg font-bold text-[#1E232A]">
            Catalogue is Empty
          </h2>
          <p className="text-sm text-[#8C827A] max-w-md mx-auto mt-1 mb-6">
            Add products manually or upload your catalogue file (CSV, Excel, or JSON).
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onImportSampleProducts}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm text-[#524B45] bg-white hover:bg-[#FAF7F2] border border-[#EFE9DF] shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={16} className="text-[#8C827A]" />
              <span>Upload Catalogue File</span>
            </button>

            <button
              onClick={onOpenAddProduct}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      ) : (
        /* Populated Products Table */
        <div className="bg-white rounded-2xl border border-[#EFE9DF] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] bg-[#FAF7F2]/50 text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Buy Price</th>
                  <th className="py-3 px-4">Sell Price</th>
                  <th className="py-3 px-4 text-center">Stock Level</th>
                  <th className="py-3 px-4 text-center">Quick Adjust</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60">
                {filteredProducts.map((p) => {
                  const isLow = p.stockQty <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#1E232A]">
                        <div>{p.name}</div>
                        {p.sku && <span className="text-[10px] text-[#A0988F]">{p.sku}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-[#655E57]">
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#EFE9DF] text-[11px]">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#8C827A] tabular-nums">
                        ₹{p.buyPrice}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1E232A] tabular-nums">
                        ₹{p.sellPrice}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                          isLow ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {isLow && <AlertTriangle size={12} />}
                          <span>{p.stockQty} {p.unit}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onUpdateStockQty(p.id, -1)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#FAF7F2] hover:bg-rose-100 hover:text-rose-700 font-bold transition-colors"
                            title="Decrease stock by 1"
                          >
                            -
                          </button>
                          <span className="w-8 text-center tabular-nums font-semibold">{p.stockQty}</span>
                          <button
                            onClick={() => onUpdateStockQty(p.id, 1)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#FAF7F2] hover:bg-emerald-100 hover:text-emerald-700 font-bold transition-colors"
                            title="Increase stock by 1"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onDeleteProduct(p.id)}
                          className="p-1.5 rounded-lg text-[#C8C0B2] hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

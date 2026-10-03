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
  Layers,
  History,
  SlidersHorizontal,
  ArrowUpDown,
  FileText,
  AlertCircle
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
  onOpenPdfImport?: () => void;
  onOpenStockHistory?: (productId?: string) => void;
  onOpenStockAdjust?: (product?: Product) => void;
  onEditProduct?: (product: Product) => void;
}

export const StocksSubtab: React.FC<StocksSubtabProps> = ({
  products,
  onOpenAddProduct,
  onUpdateStockQty,
  onDeleteProduct,
  onImportSampleProducts,
  isPopulatedState,
  onTogglePopulatedState,
  onOpenPdfImport,
  onOpenStockHistory,
  onOpenStockAdjust,
  onEditProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'AVAILABLE' | 'LOW STOCK' | 'OUT OF STOCK'>('All');
  const [sortBy, setSortBy] = useState<'name' | 'priceAsc' | 'priceDesc' | 'stockAsc' | 'stockDesc'>('name');

  const activeProducts = isPopulatedState ? products : [];

  // Metrics
  const totalProducts = activeProducts.length;
  const outOfStockCount = activeProducts.filter(p => p.stockQty === 0).length;
  const lowStockCount = activeProducts.filter(p => p.stockQty > 0 && p.stockQty <= (p.lowStockThreshold || 10)).length;
  const totalStockValue = activeProducts.reduce((sum, p) => sum + (p.stockQty * p.sellPrice), 0);

  const categories = ['All', ...Array.from(new Set(activeProducts.map(p => p.category)))];

  // Filtering and Sorting
  const filteredProducts = activeProducts.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterCategory !== 'All' && p.category !== filterCategory) return false;

    const isOut = p.stockQty === 0;
    const isLow = p.stockQty > 0 && p.stockQty <= (p.lowStockThreshold || 10);
    const isAvail = p.stockQty > (p.lowStockThreshold || 10);

    if (filterStatus === 'OUT OF STOCK' && !isOut) return false;
    if (filterStatus === 'LOW STOCK' && !isLow) return false;
    if (filterStatus === 'AVAILABLE' && !isAvail) return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'priceAsc') return a.sellPrice - b.sellPrice;
    if (sortBy === 'priceDesc') return b.sellPrice - a.sellPrice;
    if (sortBy === 'stockAsc') return a.stockQty - b.stockQty;
    if (sortBy === 'stockDesc') return b.stockQty - a.stockQty;
    return 0;
  });

  const getProductStatus = (p: Product) => {
    if (p.stockQty === 0) {
      return {
        label: 'OUT OF STOCK',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-600',
      };
    }
    if (p.stockQty <= (p.lowStockThreshold || 10)) {
      return {
        label: 'LOW STOCK',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-600',
      };
    }
    return {
      label: 'AVAILABLE',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-600',
    };
  };

  return (
    <div className="space-y-6">
      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* TOTAL PRODUCTS */}
        <div className="bg-[#EEF4FF] rounded-2xl p-5 border border-sky-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
            Catalogue Items
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-sky-950 tracking-tight tabular-nums">
            {totalProducts}
          </div>
        </div>

        {/* LOW STOCK */}
        <div className="bg-[#FFF8EE] rounded-2xl p-5 border border-amber-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
            Low Stock
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-800 tracking-tight tabular-nums">
            {lowStockCount < 10 ? `0${lowStockCount}` : lowStockCount}
          </div>
        </div>

        {/* OUT OF STOCK */}
        <div className="bg-[#FFF1EE] rounded-2xl p-5 border border-rose-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E85D43] block">
            Out of Stock
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#E85D43] tracking-tight tabular-nums">
            {outOfStockCount < 10 ? `0${outOfStockCount}` : outOfStockCount}
          </div>
        </div>

        {/* STOCK VALUE */}
        <div className="bg-[#EBF8F2] rounded-2xl p-5 border border-emerald-100/80 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
            Stock Valuation
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-900 tracking-tight tabular-nums">
            ₹{totalStockValue.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Search, Filter, Sort & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C827A]" size={17} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by title, category, or SKU..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white border border-[#EFE9DF] text-sm text-[#1E232A] placeholder-[#A0988F] focus:outline-none focus:border-[#E85D43] transition-all shadow-2xs"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl bg-white border border-[#EFE9DF] text-xs font-semibold text-[#524B45] focus:outline-none shadow-2xs"
          >
            <option value="All">All Statuses</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="LOW STOCK">Low Stock Only</option>
            <option value="OUT OF STOCK">Out of Stock Only</option>
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl bg-white border border-[#EFE9DF] text-xs font-semibold text-[#524B45] focus:outline-none shadow-2xs"
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="stockAsc">Stock: Low to High</option>
            <option value="stockDesc">Stock: High to Low</option>
          </select>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Import PDF Catalogue Button */}
          <button
            onClick={onOpenPdfImport || onImportSampleProducts}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-[#1E232A] bg-white hover:bg-[#FAF7F2] border border-[#EFE9DF] shadow-2xs transition-colors cursor-pointer"
            title="Import or update products from PDF Catalogue"
          >
            <FileText size={15} className="text-[#E85D43]" />
            <span>Import PDF</span>
          </button>

          {/* Stock History Audit Button */}
          {onOpenStockHistory && (
            <button
              onClick={() => onOpenStockHistory()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-[#524B45] bg-white hover:bg-[#FAF7F2] border border-[#EFE9DF] shadow-2xs transition-colors cursor-pointer"
              title="View stock movement history"
            >
              <History size={15} className="text-[#8C827A]" />
              <span>History</span>
            </button>
          )}

          {/* Add Product Button */}
          <button
            onClick={onOpenAddProduct}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Category Pills Filter */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterCategory === cat
                  ? 'bg-[#1C232B] text-white shadow-2xs'
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
        /* Empty state */
        <div className="bg-white rounded-2xl p-12 sm:p-16 border border-[#EFE9DF] text-center shadow-2xs">
          <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-[#FFEFEA] text-[#E85D43] mb-4">
            <Package size={28} />
          </div>
          <h2 className="text-lg font-bold text-[#1E232A]">
            No Products Found
          </h2>
          <p className="text-sm text-[#8C827A] max-w-md mx-auto mt-1 mb-6">
            Upload your Catalogue PDF to automatically extract product names, selling prices, and stock quantities.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenPdfImport || onImportSampleProducts}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#1C232B] hover:bg-[#2C3540] shadow-sm transition-all cursor-pointer"
            >
              <FileText size={16} />
              <span>Import Catalogue PDF</span>
            </button>

            <button
              onClick={onOpenAddProduct}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Add Product Manually</span>
            </button>
          </div>
        </div>
      ) : (
        /* Populated Products Catalogue Table */
        <div className="bg-white rounded-2xl border border-[#EFE9DF] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#EFE9DF] bg-[#FAF7F2]/60 text-[11px] font-bold uppercase tracking-wider text-[#A0988F]">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Selling Price</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Quick Adjust</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE9DF]/60">
                {filteredProducts.map((p) => {
                  const status = getProductStatus(p);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF7F2]/50 transition-colors">
                      {/* Product Name & SKU */}
                      <td className="py-3 px-4 font-semibold text-[#1E232A]">
                        <div>{p.name}</div>
                        {p.sku && <span className="font-mono text-[10px] text-[#A0988F]">{p.sku}</span>}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-[#655E57]">
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2] border border-[#EFE9DF] text-[11px]">
                          {p.category}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 font-bold text-[#1E232A] tabular-nums">
                        ₹{p.sellPrice}
                        {p.buyPrice > 0 && (
                          <div className="text-[10px] font-normal text-[#8C827A]">
                            Cost: ₹{p.buyPrice}
                          </div>
                        )}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-sm text-[#1E232A] tabular-nums">
                          {p.stockQty} <span className="text-[11px] font-normal text-[#8C827A]">{p.unit}</span>
                        </div>
                        {p.lowStockThreshold && (
                          <div className="text-[10px] text-[#A0988F]">
                            Min: {p.lowStockThreshold}
                          </div>
                        )}
                      </td>

                      {/* Status: AVAILABLE / LOW STOCK / OUT OF STOCK */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${status.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          <span>{status.label}</span>
                        </span>
                      </td>

                      {/* Quick Adjust +/- Buttons */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onUpdateStockQty(p.id, -1)}
                            disabled={p.stockQty <= 0}
                            className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#FAF7F2] hover:bg-rose-100 hover:text-rose-700 disabled:opacity-30 font-bold transition-colors cursor-pointer"
                            title="Decrease stock by 1"
                          >
                            -
                          </button>
                          <span className="w-8 text-center tabular-nums font-semibold">{p.stockQty}</span>
                          <button
                            onClick={() => onUpdateStockQty(p.id, 1)}
                            className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#FAF7F2] hover:bg-emerald-100 hover:text-emerald-700 font-bold transition-colors cursor-pointer"
                            title="Increase stock by 1"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Action icons */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Edit Product */}
                          {onEditProduct && (
                            <button
                              onClick={() => onEditProduct(p)}
                              className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
                              title="Edit product"
                            >
                              <Edit size={14} />
                            </button>
                          )}

                          {/* Adjust stock modal */}
                          {onOpenStockAdjust && (
                            <button
                              onClick={() => onOpenStockAdjust(p)}
                              className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
                              title="Adjust stock with audit reason"
                            >
                              <SlidersHorizontal size={14} />
                            </button>
                          )}

                          {/* Product stock history */}
                          {onOpenStockHistory && (
                            <button
                              onClick={() => onOpenStockHistory(p.id)}
                              className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
                              title="View stock movement history for this item"
                            >
                              <History size={14} />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => onDeleteProduct(p.id)}
                            className="p-1.5 rounded-lg text-[#C8C0B2] hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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

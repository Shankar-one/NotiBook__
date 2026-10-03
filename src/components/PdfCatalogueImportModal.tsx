import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Plus, 
  Edit2, 
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { Product, CatalogueImportProduct } from '../types';

interface PdfCatalogueImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  onImportSuccess: (items: CatalogueImportProduct[]) => void;
}

export const PdfCatalogueImportModal: React.FC<PdfCatalogueImportModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [shopTitle, setShopTitle] = useState('Imported Catalogue');
  const [parsedItems, setParsedItems] = useState<CatalogueImportProduct[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [updatePrices, setUpdatePrices] = useState(true);
  const [updateStock, setUpdateStock] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handler for uploading or parsing a PDF file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    await processPdfFile(selected);
  };

  // Convert PDF to base64 and call /api/catalogue/parse-pdf
  const processPdfFile = async (pdfFile: File) => {
    setIsParsing(true);
    setParseError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(pdfFile);
      });

      const base64Data = await base64Promise;

      const res = await fetch('/api/catalogue/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: pdfFile.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to extract catalogue products from PDF');
      }

      setShopTitle(data.shopTitle || pdfFile.name.replace(/\.pdf$/i, ''));
      setParsedItems(data.items || []);
      setStep('preview');
    } catch (err: any) {
      console.warn('[PDF Import Error]', err);
      setParseError(err.message || 'Could not parse the PDF. You can try the sample or enter items manually.');
    } finally {
      setIsParsing(false);
    }
  };

  // 1-Click Load Sample ABC General Store Catalogue as requested in the prompt
  const handleLoadSampleAbc = async () => {
    setIsParsing(true);
    setParseError(null);

    try {
      const res = await fetch('/api/catalogue/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleType: 'sample-abc',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load sample catalogue');
      }

      setShopTitle(data.shopTitle || 'ABC GENERAL STORE');
      setParsedItems(data.items || []);
      setStep('preview');
    } catch (err: any) {
      setParseError(err.message || 'Failed to load sample catalogue');
    } finally {
      setIsParsing(false);
    }
  };

  // Allow user to correct extracted values in the preview table
  const handleUpdateItemField = (index: number, field: keyof CatalogueImportProduct, value: any) => {
    setParsedItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Add a manual item to the preview list
  const handleAddNewItem = () => {
    const newItem: CatalogueImportProduct = {
      name: 'New Product',
      sellingPrice: 50,
      stockQty: 25,
      category: 'General',
      unit: 'pcs',
      isExisting: false,
    };
    setParsedItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Confirm Import
  const handleFinalizeImport = async () => {
    if (parsedItems.length === 0) return;

    try {
      setIsParsing(true);
      const res = await fetch('/api/catalogue/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: parsedItems,
          updateExistingPrices: updatePrices,
          updateExistingStock: updateStock,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      onImportSuccess(parsedItems);
      onClose();
    } catch (err: any) {
      setParseError(err.message || 'Import failed. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  // Partition preview into new products and existing product updates
  const newProducts = parsedItems.filter(i => !i.isExisting);
  const existingUpdates = parsedItems.filter(i => i.isExisting);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFE9DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-orange-50 text-[#E85D43]">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1E232A]">
                  {step === 'upload' ? 'Upload Catalogue PDF' : 'Import Catalogue Preview'}
                </h2>
                {step === 'preview' && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {parsedItems.length} Products Detected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8C827A] mt-0.5">
                Central product source for your store billing, inventory, and stock updates
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

        {/* STEP 1: UPLOAD AREA */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Drag & Drop Upload Container */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-[#DCD5CB] hover:border-[#E85D43] bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-[#EFE9DF] flex items-center justify-center text-[#E85D43] group-hover:scale-105 transition-transform mb-3">
                <Upload size={24} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#1E232A]">
                Click or drag & drop your Catalogue PDF here
              </h3>
              <p className="text-xs text-[#8C827A] max-w-sm mt-1">
                Supports standard text PDFs as well as scanned price lists via OCR/vision processing.
              </p>
              <span className="inline-block mt-4 px-3.5 py-1.5 rounded-xl bg-white border border-[#EFE9DF] text-xs font-semibold text-[#524B45] group-hover:border-[#E85D43] group-hover:text-[#E85D43] transition-colors">
                Browse PDF from computer
              </span>
            </div>

            {/* Parsing State */}
            {isParsing && (
              <div className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-xs font-semibold text-[#E85D43] animate-pulse">
                <Loader2 size={16} className="animate-spin" />
                <span>Reading and extracting product records from PDF...</span>
              </div>
            )}

            {/* Error Message */}
            {parseError && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">PDF Parsing Notice</div>
                  <div className="mt-0.5 text-rose-700">{parseError}</div>
                </div>
              </div>
            )}

            {/* 1-Click Prompt Test Card: ABC GENERAL STORE */}
            <div className="bg-[#FAF7F2] border border-[#EFE9DF] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#E85D43]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E232A]">
                    Instant Demo: ABC General Store PDF
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#E85D43] bg-[#FFEFEA] px-2 py-0.5 rounded-full">
                  User Brief Sample
                </span>
              </div>
              <p className="text-xs text-[#655E57]">
                Quickly test with the exact 4-product sample from the user specifications:
                <br />
                <span className="font-mono text-[11px] text-[#1E232A] font-semibold">
                  Coca-Cola 500ml (₹40, 100 stock), Pepsi 500ml (₹40, 75 stock), Maggi 70g (₹15, 50 stock), Parle-G Biscuits (₹20, 30 stock)
                </span>
              </p>
              <button
                onClick={handleLoadSampleAbc}
                disabled={isParsing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#1C232B] hover:bg-[#2C3540] active:scale-98 transition-all cursor-pointer"
              >
                <FileSpreadsheet size={14} />
                <span>Load ABC General Store Demo Catalogue</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VERIFY EXTRACTED PRODUCTS */}
        {step === 'preview' && (
          <div className="space-y-5">
            {/* Summary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EFE9DF]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
                  Document Source
                </span>
                <span className="text-sm font-bold text-[#1E232A]">{shopTitle}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {newProducts.length} New Products
                </span>
                {existingUpdates.length > 0 && (
                  <span className="text-sky-700 bg-sky-50 px-2.5 py-1 rounded-xl border border-sky-200">
                    {existingUpdates.length} Existing Updates
                  </span>
                )}
              </div>
            </div>

            {/* Settings for existing item updates */}
            {existingUpdates.length > 0 && (
              <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
                <span className="font-bold text-sky-900 block">Existing Products Matching Options:</span>
                <div className="flex flex-wrap items-center gap-4 text-sky-800">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updatePrices}
                      onChange={(e) => setUpdatePrices(e.target.checked)}
                      className="rounded text-[#E85D43]"
                    />
                    <span>Update Selling Price for matching items</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateStock}
                      onChange={(e) => setUpdateStock(e.target.checked)}
                      className="rounded text-[#E85D43]"
                    />
                    <span>Update Stock Quantity for matching items</span>
                  </label>
                </div>
              </div>
            )}

            {/* Editable Products Table */}
            <div className="border border-[#EFE9DF] rounded-2xl overflow-hidden shadow-2xs">
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#FAF7F2] border-b border-[#EFE9DF] text-[11px] font-bold uppercase tracking-wider text-[#A0988F] z-10">
                    <tr>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3 w-24">Price (₹)</th>
                      <th className="py-2.5 px-3 w-24">Stock</th>
                      <th className="py-2.5 px-3 w-28">Category</th>
                      <th className="py-2.5 px-3 w-20">Unit</th>
                      <th className="py-2.5 px-3 w-20 text-center">Status</th>
                      <th className="py-2.5 px-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9DF]/60 bg-white">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF7F2]/50 transition-colors">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItemField(idx, 'name', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-[#EFE9DF] bg-white font-medium text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.sellingPrice}
                            onChange={(e) => handleUpdateItemField(idx, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded-lg border border-[#EFE9DF] bg-white font-bold text-[#1E232A] tabular-nums focus:outline-none focus:border-[#E85D43]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            value={item.stockQty}
                            onChange={(e) => handleUpdateItemField(idx, 'stockQty', parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2 py-1 rounded-lg border border-[#EFE9DF] bg-white font-semibold text-[#1E232A] tabular-nums focus:outline-none focus:border-[#E85D43]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.category || 'General'}
                            onChange={(e) => handleUpdateItemField(idx, 'category', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-[#EFE9DF] bg-white text-[#655E57] focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.unit || 'pcs'}
                            onChange={(e) => handleUpdateItemField(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg border border-[#EFE9DF] bg-white text-[#655E57] focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          {item.isExisting ? (
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                              Update
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              New
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded-lg text-[#C8C0B2] hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add row manually in preview */}
              <div className="p-2.5 bg-[#FAF7F2]/50 border-t border-[#EFE9DF] flex justify-between items-center text-xs">
                <button
                  onClick={handleAddNewItem}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#E85D43] hover:text-[#D94E34] transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add another product manually</span>
                </button>
                <span className="text-[11px] text-[#8C827A]">
                  Review or edit any extracted values before final import.
                </span>
              </div>
            </div>

            {/* Error Notice if any */}
            {parseError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {parseError}
              </div>
            )}

            {/* Action Buttons matching User Prompt */}
            <div className="flex items-center justify-between pt-2 border-t border-[#EFE9DF]">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#655E57] hover:bg-[#FAF7F2] transition-colors"
              >
                Back to Upload
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#655E57] hover:bg-[#FAF7F2] border border-[#EFE9DF] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalizeImport}
                  disabled={isParsing || parsedItems.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 shadow-sm shadow-[#E85D43]/20 transition-all cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Import Catalogue ({parsedItems.length} items)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

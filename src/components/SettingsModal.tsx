import React, { useState } from 'react';
import { X, Settings, Store, Save, Download, RotateCcw } from 'lucide-react';
import { ShopSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShopSettings;
  onSaveSettings: (settings: ShopSettings) => void;
  onResetData: () => void;
  onExportData: () => void;
  isPopulatedState: boolean;
  onTogglePopulatedState: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetData,
  onExportData,
  isPopulatedState,
  onTogglePopulatedState,
}) => {
  const [formData, setFormData] = useState<ShopSettings>({ ...settings });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-[#EFE9DF] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#FFEFEA] text-[#E85D43]">
              <Settings size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E232A]">Shop Settings</h2>
              <span className="text-xs text-[#8C827A]">Merchant profile & preferences</span>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Shop / Business Name
              </label>
              <input
                type="text"
                required
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Merchant Owner Name
              </label>
              <input
                type="text"
                required
                value={formData.merchantName}
                onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Business Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#524B45] mb-1">
              Store Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#524B45] mb-1">
                Default GST Rate (%)
              </label>
              <input
                type="number"
                value={formData.defaultTaxRate}
                onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
              />
            </div>
          </div>

          {/* Voice & Language Preferences */}
          <div className="pt-3 border-t border-[#EFE9DF] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
              Jarvis Voice & Language Settings
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#524B45] mb-1">
                  Default Language
                </label>
                <select
                  value={localStorage.getItem('notibook_preferred_language') || 'auto'}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    localStorage.setItem('notibook_preferred_language', val);
                    import('../voice').then(m => m.voiceSession.setLanguage(val));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] text-xs font-semibold text-[#1E232A] focus:outline-none focus:border-[#E85D43]"
                >
                  <option value="auto">Auto-Detect from Voice</option>
                  <option value="english">English (US / Indian English)</option>
                  <option value="hinglish">Hinglish (Colloquial)</option>
                  <option value="hindi">हिन्दी (Devanagari)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#524B45] mb-1">
                  Wake Word ("Hey Jarvis")
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const m = await import('../voice');
                    await m.voiceSession.enableWakeWord();
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#EFE9DF] hover:border-[#E85D43]/50 text-xs font-semibold text-[#1E232A] text-left flex items-center justify-between"
                >
                  <span>Re-arm "Hey Jarvis"</span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Controls & Display Mode */}
          <div className="pt-3 border-t border-[#EFE9DF] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0988F] block">
              Display & Data Management
            </span>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onTogglePopulatedState}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-[#EFE9DF] bg-[#FAF7F2] hover:bg-[#F2ECE2] text-[#1E232A] transition-colors"
              >
                Toggle Mode ({isPopulatedState ? 'Currently: Populated' : 'Currently: Empty Clean State'})
              </button>

              <button
                type="button"
                onClick={onExportData}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#EFE9DF] bg-[#FAF7F2] hover:bg-[#F2ECE2] text-[#1E232A] transition-colors"
              >
                <Download size={13} />
                <span>Export Book JSON</span>
              </button>

              <button
                type="button"
                onClick={onResetData}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                <RotateCcw size={13} />
                <span>Reset to Default</span>
              </button>
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
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 transition-all shadow-xs"
            >
              <Save size={14} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

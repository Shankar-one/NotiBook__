import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Search, 
  RefreshCw, 
  Menu,
  CheckCircle2, 
  Sparkles, 
  Layers,
  Volume2
} from 'lucide-react';
import { voiceSession } from '../voice';
import { VoiceState } from '../voice/types';

interface HeaderProps {
  onOpenVoice: () => void;
  onOpenSearch: () => void;
  onToggleMobileNav: () => void;
  isPopulatedState: boolean;
  onTogglePopulatedState: () => void;
  onSync: () => void;
  isSyncing: boolean;
  syncTimeText: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenVoice,
  onOpenSearch,
  onToggleMobileNav,
  isPopulatedState,
  onTogglePopulatedState,
  onSync,
  isSyncing,
  syncTimeText,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');

  useEffect(() => {
    const unsub = voiceSession.subscribe({
      onStateChange: (state) => setVoiceState(state),
    });
    return unsub;
  }, []);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 md:px-8 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EFE9DF]/80">
      {/* Left: Mobile Menu Trigger + Sync Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="p-2 -ml-2 rounded-lg text-[#655E57] hover:text-[#1E232A] hover:bg-[#EFE9DF]/50 md:hidden"
        >
          <Menu size={20} />
        </button>

        {/* Live sync indicator pill from screenshot */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white/80 rounded-full border border-[#EFE9DF] text-xs font-medium text-[#655E57] shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="tracking-wider uppercase text-[11px] font-semibold text-[#8C827A]">Live Ledger</span>
          <span className="text-[#C8C0B2]">|</span>
          <span className="text-[#655E57]">{isSyncing ? 'Syncing...' : syncTimeText}</span>
        </div>

        {/* Jarvis Voice Status Badge */}
        <button
          onClick={() => voiceSession.toggle()}
          className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer ${
            voiceState === 'LISTENING'
              ? 'bg-[#E85D43] text-white border-[#E85D43] shadow-xs animate-pulse'
              : voiceState === 'SPEAKING'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : voiceState === 'THINKING'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white/80 hover:bg-white text-[#524B45] border-[#EFE9DF]'
          }`}
          title="Click to toggle Jarvis Voice Assistant (Wake word: 'Hey Jarvis')"
        >
          {voiceState === 'SPEAKING' ? (
            <Volume2 size={13} className="animate-bounce" />
          ) : (
            <Mic size={13} className={voiceState === 'LISTENING' ? 'text-white' : 'text-[#E85D43]'} />
          )}
          <span className="font-semibold">
            {voiceState === 'IDLE' && '🎙️ "Hey Jarvis"'}
            {voiceState === 'LISTENING' && 'Listening...'}
            {voiceState === 'THINKING' && 'Thinking...'}
            {voiceState === 'SPEAKING' && 'Jarvis Speaking'}
            {voiceState === 'ERROR' && 'Voice Offline'}
          </span>
        </button>
      </div>

      {/* Right: Display State Switcher + Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Toggle between screenshot empty state and populated mock state */}
        <button
          onClick={onTogglePopulatedState}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#524B45] hover:text-[#1E232A] bg-white rounded-lg border border-[#E5DFD5] hover:border-[#D5CDBD] shadow-2xs transition-all cursor-pointer"
          title="Toggle view between Fresh Empty Onboarding and Populated Shop Data"
        >
          <Layers size={13} className="text-[#E85D43]" />
          <span>Display State:</span>
          <span className="font-semibold text-[#1E232A]">
            {isPopulatedState ? 'Populated Shop' : 'Fresh Clean State'}
          </span>
        </button>

        {/* Mic action */}
        <button
          onClick={onOpenVoice}
          className={`p-2 rounded-full transition-all shadow-2xs ${
            voiceState === 'LISTENING' || voiceState === 'SPEAKING'
              ? 'bg-[#E85D43] text-white ring-2 ring-[#E85D43]/30 scale-105'
              : 'text-[#E85D43] bg-[#FFEFEA] hover:bg-[#FFE6DE] active:scale-95'
          }`}
          title="Voice Assistant (Hey Jarvis)"
        >
          <Mic size={17} />
        </button>

        {/* Search trigger */}
        <button
          onClick={onOpenSearch}
          className="p-2 rounded-full text-[#655E57] hover:text-[#1E232A] bg-white hover:bg-[#F2ECE2] border border-[#EFE9DF] transition-colors shadow-2xs"
          title="Quick Search"
        >
          <Search size={17} />
        </button>

        {/* Refresh / Sync */}
        <button
          onClick={onSync}
          className="p-2 rounded-full text-[#655E57] hover:text-[#1E232A] bg-white hover:bg-[#F2ECE2] border border-[#EFE9DF] transition-colors shadow-2xs"
          title="Sync Ledger"
        >
          <RefreshCw size={17} className={isSyncing ? 'animate-spin text-[#E85D43]' : ''} />
        </button>
      </div>
    </header>
  );
};

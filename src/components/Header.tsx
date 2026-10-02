import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Search, 
  RefreshCw, 
  Menu,
  CheckCircle2, 
  Sparkles, 
  Layers,
  Volume2,
  Globe,
  Radio
} from 'lucide-react';
import { voiceSession } from '../voice';
import { VoiceState } from '../voice/types';
import { UserLanguage, PreferredLanguage } from '../voice/LanguageUtils';

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
  const [currentLang, setCurrentLang] = useState<UserLanguage>('hinglish');
  const [langPref, setLangPref] = useState<PreferredLanguage>('auto');
  const [wakeWordListening, setWakeWordListening] = useState<boolean>(true);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    setCurrentLang(voiceSession.getCurrentVoiceLanguage());
    setLangPref(voiceSession.getLanguagePreference());

    const unsub = voiceSession.subscribe({
      onStateChange: (state) => {
        setVoiceState(state);
        setWakeWordListening(voiceSession.isWakeWordListening());
      },
      onLanguageChange: (lang, pref) => {
        setCurrentLang(lang);
        setLangPref(pref);
      },
    });

    // Check wake word health periodically
    const interval = setInterval(() => {
      setWakeWordListening(voiceSession.isWakeWordListening());
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleSelectLanguage = (pref: PreferredLanguage) => {
    voiceSession.setLanguage(pref);
    setLangPref(pref);
    setIsLangMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-16 px-4 md:px-8 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EFE9DF]/80">
      {/* Left: Mobile Menu Trigger + Sync Status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          onClick={onToggleMobileNav}
          className="p-2 -ml-2 rounded-lg text-[#655E57] hover:text-[#1E232A] hover:bg-[#EFE9DF]/50 md:hidden"
        >
          <Menu size={20} />
        </button>

        {/* Live sync indicator pill */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white/80 rounded-full border border-[#EFE9DF] text-xs font-medium text-[#655E57] shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="tracking-wider uppercase text-[11px] font-semibold text-[#8C827A]">Live Ledger</span>
          <span className="text-[#C8C0B2]">|</span>
          <span className="text-[#655E57]">{isSyncing ? 'Syncing...' : syncTimeText}</span>
        </div>

        {/* Wake Word Status & Voice Assistant Badge */}
        <button
          onClick={() => voiceSession.toggle()}
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium transition-all cursor-pointer ${
            voiceState === 'LISTENING'
              ? 'bg-[#E85D43] text-white border-[#E85D43] shadow-xs animate-pulse ring-2 ring-[#E85D43]/30'
              : voiceState === 'SPEAKING'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : voiceState === 'THINKING'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : voiceState === 'ERROR'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-white/90 hover:bg-white text-[#524B45] border-[#EFE9DF] hover:border-[#E85D43]/40'
          }`}
          title="Say 'Hey Jarvis' or click to start voice assistant"
        >
          {voiceState === 'SPEAKING' ? (
            <Volume2 size={13} className="animate-bounce" />
          ) : voiceState === 'LISTENING' ? (
            <Mic size={13} className="text-white animate-pulse" />
          ) : (
            <div className="relative flex items-center justify-center">
              <Mic size={13} className="text-[#E85D43]" />
              {wakeWordListening && (
                <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </div>
          )}
          <span className="font-semibold hidden sm:inline">
            {voiceState === 'IDLE' && (wakeWordListening ? '🎙️ "Hey Jarvis" (Active)' : '🎙️ "Hey Jarvis"')}
            {voiceState === 'CONNECTING' && 'Connecting...'}
            {voiceState === 'LISTENING' && 'Listening...'}
            {voiceState === 'THINKING' && 'Thinking...'}
            {voiceState === 'SPEAKING' && 'Jarvis Speaking'}
            {voiceState === 'WAITING_FOR_CONFIRMATION' && 'Confirming...'}
            {voiceState === 'ERROR' && 'Enable Mic'}
          </span>
          <span className="font-semibold sm:hidden">
            {voiceState === 'IDLE' ? '"Hey Jarvis"' : voiceState}
          </span>
        </button>
      </div>

      {/* Right: Language Selector + Display Mode Switcher + Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Language Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-[#E5DFD5] hover:border-[#D5CDBD] text-[#1E232A] transition-all cursor-pointer shadow-2xs"
            title="Switch Language (English, Hinglish, Hindi)"
          >
            <Globe size={13} className="text-[#E85D43]" />
            <span className="uppercase text-[11px] font-bold">
              {langPref === 'english' ? 'English' : langPref === 'hindi' ? 'हिन्दी' : langPref === 'hinglish' ? 'Hinglish' : `Auto (${currentLang.slice(0, 2).toUpperCase()})`}
            </span>
          </button>

          {isLangMenuOpen && (
            <div 
              className="absolute right-0 mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-[#EFE9DF] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A0988F]">
                Voice & Text Language
              </div>
              
              <button
                onClick={() => handleSelectLanguage('english')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-[#FAF7F2] transition-colors cursor-pointer ${
                  langPref === 'english' ? 'text-[#E85D43] font-bold bg-[#FFEFEA]/50' : 'text-[#1E232A]'
                }`}
              >
                <span>English</span>
                {langPref === 'english' && <CheckCircle2 size={13} className="text-[#E85D43]" />}
              </button>

              <button
                onClick={() => handleSelectLanguage('hinglish')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-[#FAF7F2] transition-colors cursor-pointer ${
                  langPref === 'hinglish' ? 'text-[#E85D43] font-bold bg-[#FFEFEA]/50' : 'text-[#1E232A]'
                }`}
              >
                <span>Hinglish</span>
                {langPref === 'hinglish' && <CheckCircle2 size={13} className="text-[#E85D43]" />}
              </button>

              <button
                onClick={() => handleSelectLanguage('hindi')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-[#FAF7F2] transition-colors cursor-pointer ${
                  langPref === 'hindi' ? 'text-[#E85D43] font-bold bg-[#FFEFEA]/50' : 'text-[#1E232A]'
                }`}
              >
                <span>हिन्दी (Hindi)</span>
                {langPref === 'hindi' && <CheckCircle2 size={13} className="text-[#E85D43]" />}
              </button>

              <div className="my-1 border-t border-[#EFE9DF]" />

              <button
                onClick={() => handleSelectLanguage('auto')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-[#FAF7F2] transition-colors cursor-pointer ${
                  langPref === 'auto' ? 'text-[#E85D43] font-bold bg-[#FFEFEA]/50' : 'text-[#655E57]'
                }`}
              >
                <span>Auto-Detect from Voice</span>
                {langPref === 'auto' && <CheckCircle2 size={13} className="text-[#E85D43]" />}
              </button>
            </div>
          )}
        </div>

        {/* Toggle between screenshot empty state and populated mock state */}
        <button
          onClick={onTogglePopulatedState}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#524B45] hover:text-[#1E232A] bg-white rounded-lg border border-[#E5DFD5] hover:border-[#D5CDBD] shadow-2xs transition-all cursor-pointer"
          title="Toggle view between Fresh Empty Onboarding and Populated Shop Data"
        >
          <Layers size={13} className="text-[#E85D43]" />
          <span>Display:</span>
          <span className="font-semibold text-[#1E232A]">
            {isPopulatedState ? 'Populated' : 'Clean'}
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

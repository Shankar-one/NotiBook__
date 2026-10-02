import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Volume2, 
  ChevronUp, 
  ChevronDown, 
  AlertCircle,
  Square,
  CheckCircle2,
  SlidersHorizontal,
  ArrowRight,
  Globe,
  Loader2,
  Pencil,
  XCircle
} from 'lucide-react';
import { voiceSession } from '../voice';
import { VoiceState, ConversationTurn, PendingConfirmation, StrictVoiceIntent } from '../voice/types';
import { UserLanguage, PreferredLanguage } from '../voice/LanguageUtils';

interface JarvisHUDProps {
  onNavigateToTab?: (tab: 'home' | 'customers' | 'book', subtab?: 'billing' | 'transactions' | 'stocks') => void;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [volume, setVolume] = useState<number>(0);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [lastUserUtterance, setLastUserUtterance] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [typedCommand, setTypedCommand] = useState<string>('');
  const [currentLang, setCurrentLang] = useState<UserLanguage>('hinglish');
  const [langPref, setLangPref] = useState<PreferredLanguage>('auto');
  const [isWakeWordActive, setIsWakeWordActive] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [showDevTestMode, setShowDevTestMode] = useState<boolean>(false);

  // Confirmation & Edit / Saving / Success states
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isEditingConfirmation, setIsEditingConfirmation] = useState<boolean>(false);
  const [editPersonName, setEditPersonName] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editIntent, setEditIntent] = useState<StrictVoiceIntent>('ADD_RECEIVABLE');
  const [editDescription, setEditDescription] = useState<string>('');
  const [isSavingConfirmation, setIsSavingConfirmation] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentLang(voiceSession.getCurrentVoiceLanguage());
    setLangPref(voiceSession.getLanguagePreference());
    setIsWakeWordActive(voiceSession.isWakeWordListening());

    const unsubscribe = voiceSession.subscribe({
      onStateChange: (state) => {
        setVoiceState(state);
        setIsWakeWordActive(voiceSession.isWakeWordListening());
        if (state !== 'IDLE') {
          setExpanded(true);
        } else if (!voiceSession.getPendingConfirmation()) {
          setInterimTranscript('');
        }
      },
      onTranscript: (turn: ConversationTurn) => {
        if (turn.lang) {
          setCurrentLang(turn.lang);
        }
        if (turn.role === 'user') {
          setLastUserUtterance(turn.text);
          setInterimTranscript('');
          setSaveSuccessMessage(null);
        } else if (turn.role === 'assistant') {
          setLastMessage(turn.text);
        }
      },
      onInterimTranscript: (text) => {
        setInterimTranscript(text);
      },
      onVolumeChange: (vol) => {
        setVolume(vol);
      },
      onJarvisMessage: (msg, lang) => {
        setLastMessage(msg);
        if (lang) setCurrentLang(lang);
      },
      onLanguageChange: (lang, pref) => {
        setCurrentLang(lang);
        setLangPref(pref);
      },
      onPendingConfirmationChange: (pending) => {
        setPendingConfirmation(pending);
        if (pending) {
          setExpanded(true);
          setIsEditingConfirmation(false);
          setIsSavingConfirmation(false);
          setSaveSuccessMessage(null);
          setEditPersonName(pending.personName || '');
          setEditAmount(pending.amount !== null && pending.amount !== undefined ? String(pending.amount) : '');
          setEditIntent(pending.intent);
          setEditDescription(pending.description || '');
        } else {
          setIsEditingConfirmation(false);
          setIsSavingConfirmation(false);
        }
      },
    });

    const interval = setInterval(() => {
      setIsWakeWordActive(voiceSession.isWakeWordListening());
    }, 2500);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleToggleVoice = async () => {
    if (voiceState === 'IDLE' || voiceState === 'ERROR') {
      const perm = await voiceSession.checkMicPermission();
      if (perm !== 'granted') {
        const req = await voiceSession.requestMicPermission();
        if (!req.granted) {
          setExpanded(true);
          return;
        }
      }
      await voiceSession.start();
    } else {
      await voiceSession.stop();
    }
  };

  const handleStop = async () => {
    await voiceSession.stop();
    if (!pendingConfirmation) {
      setExpanded(false);
    }
  };

  const handleSimulateUtterance = async (text: string) => {
    setSaveSuccessMessage(null);
    await voiceSession.sendManualUtterance(text);
  };

  const handleSetLanguage = (pref: PreferredLanguage) => {
    voiceSession.setLanguage(pref);
    setLangPref(pref);
  };

  const handleConfirmAndSave = async () => {
    if (!pendingConfirmation || isSavingConfirmation) return;
    setIsSavingConfirmation(true);
    try {
      const parsedAmt = editAmount.trim() !== '' ? Number(editAmount) : pendingConfirmation.amount;
      const result = await voiceSession.confirmPendingAction({
        personName: editPersonName.trim() || pendingConfirmation.personName,
        amount: parsedAmt !== null && !isNaN(Number(parsedAmt)) ? Number(parsedAmt) : pendingConfirmation.amount,
        intent: editIntent,
        description: editDescription.trim() || pendingConfirmation.description,
      });
      if (result.success) {
        setSaveSuccessMessage(result.reply);
        setTimeout(() => {
          setSaveSuccessMessage((prev) => (prev === result.reply ? null : prev));
        }, 4500);
      }
    } finally {
      setIsSavingConfirmation(false);
      setIsEditingConfirmation(false);
    }
  };

  const handleCancelConfirmation = async () => {
    if (isSavingConfirmation) return;
    setIsEditingConfirmation(false);
    await voiceSession.cancelPendingAction();
  };

  const getIntentBadgeInfo = (intent: StrictVoiceIntent) => {
    switch (intent) {
      case 'ADD_RECEIVABLE':
        return {
          label: 'RECEIVABLE',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
          sign: '+',
        };
      case 'ADD_PAYABLE':
        return {
          label: 'PAYABLE',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          sign: '-',
        };
      case 'ADD_PAYMENT_GIVEN':
        return {
          label: 'PAYMENT GIVEN',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          sign: '+',
        };
      case 'RECORD_PAYMENT_RECEIVED':
        return {
          label: 'PAYMENT RECEIVED',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
          sign: '-',
        };
      case 'CREATE_CUSTOMER':
        return {
          label: 'CREATE CUSTOMER',
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          sign: '',
        };
      default:
        return {
          label: intent.replace(/_/g, ' '),
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          sign: '',
        };
    }
  };

  // Status visual colors
  const stateColor: Record<VoiceState, string> = {
    IDLE: 'bg-[#1C232B] text-white border-slate-700/80 shadow-2xl',
    CONNECTING: 'bg-[#1C232B] text-amber-200 border-amber-500/60 shadow-2xl shadow-amber-950/40',
    LISTENING: 'bg-[#1C232B] text-white border-[#E85D43] shadow-2xl shadow-[#E85D43]/20',
    THINKING: 'bg-[#1C232B] text-indigo-200 border-indigo-500/60 shadow-2xl shadow-indigo-950/40',
    SPEAKING: 'bg-[#1C232B] text-white border-emerald-500/80 shadow-2xl shadow-emerald-950/30',
    WAITING_FOR_CONFIRMATION: 'bg-[#1C232B] text-amber-100 border-amber-400 shadow-2xl shadow-amber-950/50 ring-2 ring-amber-400/30',
    ENDING: 'bg-[#1C232B] text-slate-200 border-slate-600 shadow-2xl',
    ERROR: 'bg-[#1C232B] text-rose-200 border-rose-500 shadow-2xl',
  };

  const getStatusTitle = (): string => {
    if (pendingConfirmation || voiceState === 'WAITING_FOR_CONFIRMATION') {
      return 'Review & Confirm Entry';
    }
    if (voiceState === 'CONNECTING') {
      return 'Connecting to Jarvis...';
    }
    if (voiceState === 'LISTENING') {
      return 'Listening to you...';
    }
    if (voiceState === 'THINKING') {
      return 'Interpreting command...';
    }
    if (voiceState === 'SPEAKING') {
      return 'Jarvis speaking';
    }
    if (voiceState === 'ENDING') {
      return 'Session ending...';
    }
    if (voiceState === 'ERROR') {
      return '⚠️ Microphone Access Compulsory';
    }
    if (isWakeWordActive) {
      return '🎙️ Say "Hey Jarvis" (Listening)';
    } else {
      return '🎙️ Tap to Enable "Hey Jarvis"';
    }
  };

  const getSublineText = (): string => {
    if (pendingConfirmation) {
      return `${pendingConfirmation.personName}${pendingConfirmation.amount ? ` • ₹${pendingConfirmation.amount.toLocaleString('en-IN')}` : ''}`;
    }
    if (voiceState === 'ERROR') {
      return 'Microphone permission is required — Click to allow';
    }
    if (interimTranscript) {
      return `🎙️ "${interimTranscript}"`;
    }
    if (voiceState === 'LISTENING') {
      return 'Speak naturally... e.g. "Add 1000 to Ramesh\'s account"';
    }
    if (voiceState === 'SPEAKING') {
      return lastMessage;
    }
    if (lastUserUtterance) {
      return lastUserUtterance;
    }
    return 'Tap mic or say "Hey Jarvis" to start';
  };

  return (
    <aside 
      aria-label="Jarvis Voice Assistant" 
      className="fixed bottom-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-full"
    >
      <div className={`rounded-2xl border backdrop-blur-md transition-all duration-300 overflow-hidden ${stateColor[pendingConfirmation ? 'WAITING_FOR_CONFIRMATION' : (voiceState || 'IDLE')]}`}>
        {/* Main Header Bar */}
        <div className="flex items-center justify-between p-3.5 gap-3">
          {/* Status Icon & Label */}
          <div 
            onClick={async () => {
              if (voiceState === 'IDLE' && !isWakeWordActive) {
                const req = await voiceSession.requestMicPermission();
                if (req.granted) {
                  await voiceSession.enableWakeWord();
                  setIsWakeWordActive(voiceSession.isWakeWordListening());
                }
              }
              setExpanded(!expanded);
            }}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
          >
            <div className="relative shrink-0">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                pendingConfirmation || voiceState === 'WAITING_FOR_CONFIRMATION' ? 'bg-amber-500 text-slate-950 font-bold' :
                voiceState === 'LISTENING' ? 'bg-[#E85D43] text-white animate-pulse' :
                voiceState === 'SPEAKING' ? 'bg-emerald-500 text-white' :
                voiceState === 'THINKING' ? 'bg-indigo-500 text-white animate-spin' :
                voiceState === 'CONNECTING' ? 'bg-amber-600 text-white' :
                'bg-slate-800 text-slate-300'
              }`}>
                {voiceState === 'SPEAKING' ? <Volume2 size={18} /> : <Mic size={18} />}
              </div>

              {voiceState === 'IDLE' && isWakeWordActive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              )}

              {voiceState === 'LISTENING' && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E85D43] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E85D43]"></span>
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wide text-white truncate">
                  {getStatusTitle()}
                </span>
              </div>

              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                {getSublineText()}
              </div>
            </div>
          </div>

          {/* Distinct Microphone / Session Controls (Clearly separated from Confirmation) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {voiceState === 'LISTENING' && interimTranscript && (
              <button
                type="button"
                onClick={async () => {
                  await voiceSession.commitCurrentSpeech();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                title="Process spoken sentence now"
                aria-label="Process spoken sentence"
              >
                <ArrowRight size={13} />
                <span className="hidden sm:inline">Process</span>
              </button>
            )}

            {voiceState !== 'IDLE' && (
              <button
                type="button"
                onClick={handleStop}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="Stop voice listening"
                aria-label="Stop voice listening"
              >
                <Square size={14} className="fill-current" />
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-2 rounded-xl transition-all shadow-xs cursor-pointer ${
                voiceState === 'IDLE'
                  ? 'bg-[#E85D43] hover:bg-[#D94E34] text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title={voiceState === 'IDLE' ? 'Start Voice Assistant' : 'Toggle Microphone'}
              aria-label={voiceState === 'IDLE' ? 'Start Voice Assistant' : 'Toggle Microphone'}
            >
              <Mic size={16} />
            </button>

            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title={expanded ? 'Collapse panel' : 'Expand panel'}
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
            >
              {expanded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            </button>
          </div>
        </div>

        {/* Live Audio Visualizer Bar */}
        {(voiceState === 'LISTENING' || voiceState === 'SPEAKING') && (
          <div className="h-1 bg-slate-900 flex items-center gap-0.5 px-3">
            {[20, 50, 80, 100, 60, 40, 90, 70, 30, 85, 45].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-75 ${
                  voiceState === 'SPEAKING' ? 'bg-emerald-400' : 'bg-[#E85D43]'
                }`}
                style={{
                  height: `${Math.max(2, Math.min(10, (volume > 0.05 ? volume : (voiceState === 'SPEAKING' ? 0.35 : 0.08)) * h * 0.15))}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Expanded Panel */}
        {(expanded || pendingConfirmation || saveSuccessMessage) && (
          <div className="p-4 bg-[#141A21]/95 border-t border-slate-800 space-y-3.5 text-xs">
            {/* Post-Save Success Banner */}
            {saveSuccessMessage && !pendingConfirmation && (
              <div
                role="status"
                aria-live="polite"
                className="p-3.5 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500/80 text-emerald-100 shadow-lg space-y-1 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-300">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <span>Saved Successfully!</span>
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed pl-6">
                  {saveSuccessMessage}
                </p>
              </div>
            )}

            {/* ==============================================================
                PART 1 — HIGH-VISIBILITY VOICE CONFIRMATION CARD
               ============================================================== */}
            {pendingConfirmation && (
              <div
                role="region"
                aria-label="Voice Transaction Confirmation Card"
                className="p-4 rounded-2xl bg-slate-900 border-2 border-amber-400/90 shadow-2xl space-y-3.5"
              >
                {/* Header & Intent Badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${getIntentBadgeInfo(isEditingConfirmation ? editIntent : pendingConfirmation.intent).color}`}>
                    {getIntentBadgeInfo(isEditingConfirmation ? editIntent : pendingConfirmation.intent).label}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-300/90">
                    {pendingConfirmation.customerExists ? 'Existing Customer' : '✨ New Customer'}
                  </span>
                </div>

                {/* Read-Only Summary View vs Inline Edit View */}
                {!isEditingConfirmation ? (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                          Customer
                        </span>
                        <span className="text-base font-extrabold text-white">
                          {editPersonName || pendingConfirmation.personName}
                        </span>
                      </div>
                      {(editAmount || pendingConfirmation.amount !== null) && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Amount
                          </span>
                          <span className="text-xl font-black text-emerald-400">
                            ₹{Number(editAmount || pendingConfirmation.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Balance Impact Preview */}
                    {pendingConfirmation.amount !== null && pendingConfirmation.intent !== 'CREATE_CUSTOMER' && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
                        <span>
                          Previous Balance:{' '}
                          <strong className="text-white">₹{(pendingConfirmation.existingBalance ?? 0).toLocaleString('en-IN')}</strong>
                        </span>
                        <span>→</span>
                        <span>
                          New Balance:{' '}
                          <strong className="text-amber-300">
                            ₹{(
                              (pendingConfirmation.existingBalance ?? 0) +
                              (editIntent === 'RECORD_PAYMENT_RECEIVED' || editIntent === 'ADD_PAYABLE'
                                ? -Number(editAmount || pendingConfirmation.amount || 0)
                                : Number(editAmount || pendingConfirmation.amount || 0))
                            ).toLocaleString('en-IN')}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Inline Edit Mode (✏️ Edit) */
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={editPersonName}
                        onChange={(e) => setEditPersonName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {pendingConfirmation.intent !== 'CREATE_CUSTOMER' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Type
                          </label>
                          <select
                            value={editIntent}
                            onChange={(e) => setEditIntent(e.target.value as StrictVoiceIntent)}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                          >
                            <option value="ADD_RECEIVABLE">Receivable</option>
                            <option value="ADD_PAYABLE">Payable</option>
                            <option value="ADD_PAYMENT_GIVEN">Payment Given</option>
                            <option value="RECORD_PAYMENT_RECEIVED">Payment Received</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Note / Description (Optional)
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Optional note..."
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* PRIMARY ACTION BUTTON: ✅ Confirm & Save (54px height, full-width, keyboard accessible, anti-double-submit) */}
                <button
                  type="button"
                  autoFocus
                  disabled={isSavingConfirmation}
                  onClick={handleConfirmAndSave}
                  className="w-full min-h-[54px] px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-75 disabled:cursor-not-allowed text-white font-extrabold text-base tracking-wide shadow-xl shadow-emerald-950/60 border border-emerald-400/40 flex items-center justify-center gap-2.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                  aria-label="Confirm and Save transaction"
                >
                  {isSavingConfirmation ? (
                    <>
                      <Loader2 size={20} className="animate-spin text-white shrink-0" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>✅ Confirm &amp; Save</span>
                  )}
                </button>

                {/* SECONDARY CONTROLS: ✏️ Edit & ❌ Cancel (Clearly subordinate to Confirm & Save) */}
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <button
                    type="button"
                    disabled={isSavingConfirmation}
                    onClick={() => setIsEditingConfirmation(!isEditingConfirmation)}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs border border-slate-600/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
                    aria-label="Edit transaction details before saving"
                  >
                    <Pencil size={13} className="shrink-0" />
                    <span>{isEditingConfirmation ? 'Done Editing' : '✏️ Edit'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSavingConfirmation}
                    onClick={handleCancelConfirmation}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/50 disabled:opacity-50 text-slate-300 hover:text-rose-200 font-semibold text-xs border border-slate-700/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
                    aria-label="Cancel pending transaction"
                  >
                    <XCircle size={13} className="shrink-0" />
                    <span>❌ Cancel</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Command Input (Voice & Text Dual Input) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (typedCommand.trim()) {
                  handleSimulateUtterance(typedCommand.trim());
                  setTypedCommand('');
                }
              }}
              className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 rounded-xl border border-slate-800 focus-within:border-[#E85D43]/60 transition-colors"
            >
              <input
                type="text"
                value={typedCommand}
                onChange={(e) => setTypedCommand(e.target.value)}
                placeholder="Speak or type command (e.g. Add 1000 to Ramesh's account)..."
                className="flex-1 bg-transparent px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!typedCommand.trim()}
                className="p-2 rounded-lg bg-[#E85D43] hover:bg-[#D94E34] disabled:opacity-40 disabled:hover:bg-[#E85D43] text-white transition-all cursor-pointer"
                title="Send command"
              >
                <ArrowRight size={14} />
              </button>
            </form>

            {/* Active Dialogue Turns */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {interimTranscript && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#E85D43]/20 border border-[#E85D43]/50 text-amber-200 animate-pulse">
                  <span className="font-bold text-[#E85D43] shrink-0 text-[11px] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E85D43] animate-ping" />
                    Listening:
                  </span>
                  <span className="text-white font-medium italic">"{interimTranscript}..."</span>
                </div>
              )}

              {lastUserUtterance && (
                <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="font-bold text-[#E85D43] shrink-0 text-[11px] uppercase tracking-wider">
                    You:
                  </span>
                  <span className="text-slate-200">{lastUserUtterance}</span>
                </div>
              )}

              {lastMessage && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-200">
                  <Volume2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-emerald-400 block text-[10px] uppercase tracking-wider mb-0.5">
                      Jarvis:
                    </span>
                    <span>{lastMessage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error & Compulsory Permission Prompt */}
            {voiceState === 'ERROR' && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 space-y-2">
                <div className="flex items-center gap-2 text-rose-200 font-semibold text-xs">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>Microphone access is compulsory</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Allow microphone access in your browser to speak commands and use Jarvis wake word.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await voiceSession.requestMicPermission();
                    if (res.granted) {
                      void voiceSession.start();
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-[#E85D43] hover:bg-[#D94E34] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#E85D43]/20"
                >
                  <Mic size={14} />
                  <span>Turn On Microphone Now</span>
                </button>
              </div>
            )}

            {/* Quick Voice Test Prompts (Uses the exact same semantic/action pipeline as spoken English) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowDevTestMode(!showDevTestMode)}
                className="flex items-center justify-between w-full text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal size={11} />
                  <span>Test English Commands</span>
                </span>
                <span>{showDevTestMode ? 'Hide ▲' : 'Show ▼'}</span>
              </button>

              {showDevTestMode && (
                <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Customers &amp; Receivables:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        'Create a customer called Ramesh.',
                        'Add a thousand to his account.',
                        'I need to collect another 500 from Ramesh.',
                        'Ramesh owes me 750.',
                        'Create Ramesh as a customer and add 1000 to his account.',
                      ].map((phrase, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSimulateUtterance(phrase)}
                          className="text-[10.5px] px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-[#E85D43] text-slate-200 hover:text-white transition-colors cursor-pointer"
                        >
                          "{phrase}"
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Queries, Navigation &amp; Confirmation:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        'Show me how much Ramesh still owes.',
                        "Show me Ramesh's latest transaction.",
                        'Show me the customer tab.',
                        'Actually make that 1500.',
                        'Yes, save it.',
                        'Cancel that.',
                      ].map((phrase, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSimulateUtterance(phrase)}
                          className="text-[10.5px] px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-[#E85D43] text-slate-200 hover:text-white transition-colors cursor-pointer"
                        >
                          "{phrase}"
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

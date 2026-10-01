import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  X, 
  ChevronUp, 
  ChevronDown, 
  AlertCircle,
  CornerDownRight,
  Square,
  CheckCircle,
  HelpCircle,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { voiceSession } from '../voice';
import { VoiceState, ConversationTurn } from '../voice/types';

interface JarvisHUDProps {
  onNavigateToTab?: (tab: 'home' | 'customers' | 'book', subtab?: 'billing' | 'transactions' | 'stocks') => void;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = ({ onNavigateToTab }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [volume, setVolume] = useState<number>(0);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [lastUserUtterance, setLastUserUtterance] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [showDevTestMode, setShowDevTestMode] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = voiceSession.subscribe({
      onStateChange: (state) => {
        setVoiceState(state);
        if (state !== 'IDLE') {
          // Open panel to show active multi-turn conversation
          setExpanded(true);
        } else {
          // Cleanly collapse / minimize back to idle pill on completion
          setExpanded(false);
        }
      },
      onTranscript: (turn: ConversationTurn) => {
        if (turn.role === 'user') {
          setLastUserUtterance(turn.text);
        } else if (turn.role === 'assistant') {
          setLastMessage(turn.text);
        }
      },
      onVolumeChange: (vol) => {
        setVolume(vol);
      },
      onJarvisMessage: (msg) => {
        setLastMessage(msg);
      },
    });

    return () => {
      unsubscribe();
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
    setExpanded(false);
  };

  const handleSimulateUtterance = async (text: string) => {
    await voiceSession.sendManualUtterance(text);
  };

  // State visual configuration
  const stateColor: Record<VoiceState, string> = {
    IDLE: 'bg-[#1C232B] text-white border-slate-700/80 shadow-2xl',
    CONNECTING: 'bg-[#1C232B] text-amber-200 border-amber-500/60 shadow-2xl shadow-amber-950/40',
    LISTENING: 'bg-[#1C232B] text-white border-[#E85D43] shadow-2xl shadow-[#E85D43]/20',
    THINKING: 'bg-[#1C232B] text-indigo-200 border-indigo-500/60 shadow-2xl shadow-indigo-950/40',
    SPEAKING: 'bg-[#1C232B] text-white border-emerald-500/80 shadow-2xl shadow-emerald-950/30',
    WAITING_FOR_CONFIRMATION: 'bg-[#1C232B] text-amber-200 border-amber-500 shadow-2xl shadow-amber-950/40',
    ENDING: 'bg-[#1C232B] text-slate-200 border-slate-600 shadow-2xl',
    ERROR: 'bg-[#1C232B] text-rose-200 border-rose-500 shadow-2xl',
  };

  return (
    <aside 
      aria-label="Jarvis Voice Assistant" 
      className="fixed bottom-5 right-5 z-40 max-w-sm sm:max-w-md w-full px-4 sm:px-0"
    >
      <div className={`rounded-2xl border backdrop-blur-md transition-all duration-300 overflow-hidden ${stateColor[voiceState] || stateColor.IDLE}`}>
        {/* Main Bar */}
        <div className="flex items-center justify-between p-3.5 gap-3">
          {/* Status Icon & Label */}
          <div 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
          >
            <div className="relative shrink-0">
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
                voiceState === 'LISTENING' ? 'bg-[#E85D43] text-white animate-pulse' :
                voiceState === 'SPEAKING' ? 'bg-emerald-500 text-white' :
                voiceState === 'THINKING' ? 'bg-indigo-500 text-white animate-spin' :
                voiceState === 'WAITING_FOR_CONFIRMATION' ? 'bg-amber-500 text-black font-bold' :
                voiceState === 'CONNECTING' ? 'bg-amber-600 text-white' :
                'bg-slate-800 text-slate-300'
              }`}>
                {voiceState === 'SPEAKING' ? <Volume2 size={16} /> : <Mic size={16} />}
              </div>
              {voiceState === 'LISTENING' && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E85D43] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E85D43]"></span>
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wide text-white">
                  {voiceState === 'IDLE' && '🎙️ Say "Hey Jarvis"'}
                  {voiceState === 'CONNECTING' && 'Connecting to Jarvis...'}
                  {voiceState === 'LISTENING' && 'Listening to you...'}
                  {voiceState === 'THINKING' && 'Jarvis thinking...'}
                  {voiceState === 'SPEAKING' && 'Jarvis speaking'}
                  {voiceState === 'WAITING_FOR_CONFIRMATION' && 'Confirmation needed'}
                  {voiceState === 'ENDING' && 'Session ending...'}
                  {voiceState === 'ERROR' && '⚠️ Microphone Access Compulsory'}
                </span>
                {voiceState === 'SPEAKING' && (
                  <span className="text-[10px] text-emerald-400 opacity-90 hidden sm:inline font-medium">
                    (Speak to interrupt)
                  </span>
                )}
              </div>

              {/* Subline Preview */}
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {voiceState === 'ERROR'
                  ? 'Microphone permission is required — Click to allow'
                  : voiceState === 'SPEAKING' 
                  ? lastMessage 
                  : (lastUserUtterance || (voiceState === 'IDLE' ? 'Tap mic or say Hey Jarvis • Continuous multi-turn' : 'Speak naturally in Hindi, Hinglish, or English'))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {voiceState !== 'IDLE' && (
              <button
                onClick={handleStop}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="End voice session"
                aria-label="End conversation"
              >
                <Square size={14} className="fill-current" />
              </button>
            )}

            <button
              onClick={handleToggleVoice}
              className={`p-2 rounded-xl transition-all shadow-xs cursor-pointer ${
                voiceState === 'IDLE'
                  ? 'bg-[#E85D43] hover:bg-[#D94E34] text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={voiceState === 'IDLE' ? 'Start Jarvis Voice' : 'Pause/Toggle Mic'}
              aria-label={voiceState === 'IDLE' ? 'Start Jarvis' : 'Toggle microphone'}
            >
              <Mic size={15} />
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title={expanded ? 'Collapse panel' : 'Expand conversation'}
              aria-label={expanded ? 'Collapse panel' : 'Expand conversation'}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
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

        {/* Expanded Panel: Dialogue History + Natural Multi-turn Display */}
        {expanded && (
          <div className="p-3.5 bg-black/40 border-t border-slate-800/90 space-y-3 text-xs">
            {/* Active Dialogue Turns */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {lastUserUtterance && (
                <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="font-bold text-[#E85D43] shrink-0 text-[11px] uppercase tracking-wider">You:</span>
                  <span className="text-slate-200">{lastUserUtterance}</span>
                </div>
              )}

              {lastMessage && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-200">
                  <Volume2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-emerald-400 block text-[10px] uppercase tracking-wider mb-0.5">Jarvis:</span>
                    <span>{lastMessage}</span>
                  </div>
                </div>
              )}

              {!lastUserUtterance && !lastMessage && voiceState !== 'ERROR' && (
                <div className="text-slate-400 italic text-center py-2">
                  Say "Hey Jarvis" or speak naturally in Hindi, Hinglish, or English.
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
                  Allow microphone access in your browser to speak commands and use Jarvis.
                </p>
                <button
                  onClick={async () => {
                    const res = await voiceSession.requestMicPermission();
                    if (res.granted) {
                      void voiceSession.start();
                    }
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#E85D43] hover:bg-[#D94E34] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#E85D43]/20"
                >
                  <Mic size={14} />
                  <span>Turn On Microphone Now</span>
                </button>
              </div>
            )}

            {/* Confirmation Quick Action Bar (when waiting for confirmation) */}
            {voiceState === 'WAITING_FOR_CONFIRMATION' && (
              <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/50 space-y-2">
                <span className="text-[11px] font-semibold text-amber-300 block">
                  Say "Haan" / "Theek hai" to confirm, or tap:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSimulateUtterance('haan')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    Confirm (हाँ / Yes)
                  </button>
                  <button
                    onClick={() => handleSimulateUtterance('nahi')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer text-center"
                  >
                    Cancel (नहीं / No)
                  </button>
                </div>
              </div>
            )}

            {/* Discrete Dev Test Prompts (Hidden by default for clean production UX) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => setShowDevTestMode(!showDevTestMode)}
                className="flex items-center justify-between w-full text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal size={11} />
                  <span>Developer Test Prompts</span>
                </span>
                <span>{showDevTestMode ? 'Hide ▲' : 'Show ▼'}</span>
              </button>

              {showDevTestMode && (
                <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex flex-wrap gap-1">
                    {[
                      'कृपा शंकर के अकाउंट में ₹1000 उधर लिख दो',
                      'सुरेश के खाते में ₹500 जमा लिखो',
                      'Ravi ka balance batao',
                      'Usmein 500 add kar do',
                      'Uski last transaction batao',
                      'Theek hai',
                      'Total udhar kitna hai?',
                      'Customers kholo',
                      'Billing page kholo',
                      'दुकान की सेटिंग खोलो',
                      'Add Ramesh as customer',
                      'एक रमेश सा कस्टमर',
                      'रवि का लेजर खोलो',
                      'Aaj kitna paisa aaya?',
                    ].map((phrase, i) => (
                      <button
                        key={i}
                        onClick={() => handleSimulateUtterance(phrase)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-[#E85D43] text-slate-200 hover:text-white transition-colors cursor-pointer"
                      >
                        "{phrase}"
                      </button>
                    ))}
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

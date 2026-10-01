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
  Square
} from 'lucide-react';
import { voiceSession } from '../voice';
import { VoiceState, ConversationTurn } from '../voice/types';

interface JarvisHUDProps {
  onNavigateToTab: (tab: 'home' | 'customers' | 'book', subtab?: 'billing' | 'transactions' | 'stocks') => void;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = ({ onNavigateToTab }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [volume, setVolume] = useState<number>(0);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [lastUserUtterance, setLastUserUtterance] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [wakeWordListening, setWakeWordListening] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = voiceSession.subscribe({
      onStateChange: (state) => {
        setVoiceState(state);
        if (state !== 'IDLE') {
          setExpanded(true);
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
    await voiceSession.toggle();
  };

  const handleStop = async () => {
    await voiceSession.stop();
  };

  const handleSimulateUtterance = async (text: string) => {
    await voiceSession.sendManualUtterance(text);
  };

  // State visuals
  const stateColor = {
    IDLE: 'bg-[#1C232B] text-white border-slate-700',
    CONNECTING: 'bg-amber-900/90 text-amber-200 border-amber-500/40',
    LISTENING: 'bg-[#1C232B] text-white border-[#E85D43]',
    THINKING: 'bg-indigo-950 text-indigo-200 border-indigo-500/40',
    SPEAKING: 'bg-[#1C232B] text-white border-emerald-500',
    ERROR: 'bg-rose-950 text-rose-200 border-rose-500',
  }[voiceState];

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-sm sm:max-w-md w-full px-4 sm:px-0">
      <div className={`rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 overflow-hidden ${stateColor}`}>
        {/* Main Bar */}
        <div className="flex items-center justify-between p-3.5 gap-3">
          {/* Status Icon & Label */}
          <div 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
          >
            <div className="relative">
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${
                voiceState === 'LISTENING' ? 'bg-[#E85D43] text-white animate-pulse' :
                voiceState === 'SPEAKING' ? 'bg-emerald-500 text-white' :
                voiceState === 'THINKING' ? 'bg-indigo-500 text-white animate-spin' :
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
                <span className="text-xs font-bold tracking-wide">
                  {voiceState === 'IDLE' && '🎙️ Say "Hey Jarvis"'}
                  {voiceState === 'CONNECTING' && 'Connecting to Jarvis...'}
                  {voiceState === 'LISTENING' && 'Listening to you...'}
                  {voiceState === 'THINKING' && 'Jarvis thinking...'}
                  {voiceState === 'SPEAKING' && 'Jarvis speaking...'}
                  {voiceState === 'ERROR' && 'Voice unavailable'}
                </span>
                {voiceState === 'SPEAKING' && (
                  <span className="text-[10px] text-emerald-400 opacity-90 hidden sm:inline">
                    (Speak to interrupt)
                  </span>
                )}
              </div>

              {/* Subline Preview */}
              <div className="text-[11px] opacity-80 truncate mt-0.5">
                {voiceState === 'SPEAKING' ? lastMessage : (lastUserUtterance || 'Ask balance, add transaction, or navigate')}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {voiceState !== 'IDLE' && (
              <button
                onClick={handleStop}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="Stop conversation"
              >
                <Square size={14} className="fill-current" />
              </button>
            )}

            <button
              onClick={handleToggleVoice}
              className={`p-2 rounded-xl transition-all shadow-xs ${
                voiceState === 'IDLE'
                  ? 'bg-[#E85D43] hover:bg-[#D94E34] text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
              title={voiceState === 'IDLE' ? 'Start Jarvis' : 'Toggle Mic'}
            >
              <Mic size={15} />
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {/* Live Audio Visualizer Bar */}
        {voiceState === 'LISTENING' && (
          <div className="h-1 bg-slate-800 flex items-center gap-0.5 px-3">
            {[20, 50, 80, 100, 60, 40, 90, 70, 30, 85, 45].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-[#E85D43] rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(2, Math.min(10, volume * h * 0.15))}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Expanded Panel: Dialogue History + Instant Test Phrases */}
        {expanded && (
          <div className="p-3.5 bg-black/30 border-t border-slate-800 space-y-3 text-xs">
            {/* Active Dialog Turn */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {lastUserUtterance && (
                <div className="flex items-start gap-1.5 text-slate-300">
                  <span className="font-bold text-[#E85D43] shrink-0">You:</span>
                  <span>{lastUserUtterance}</span>
                </div>
              )}
              {lastMessage && (
                <div className="flex items-start gap-1.5 text-emerald-300">
                  <span className="font-bold text-emerald-400 shrink-0">Jarvis:</span>
                  <span>{lastMessage}</span>
                </div>
              )}
              {!lastUserUtterance && !lastMessage && (
                <div className="text-slate-400 italic">
                  Say "Hey Jarvis" or try one of the test prompts below.
                </div>
              )}
            </div>

            {/* Test Phrases matching user's spec test cases */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                Multilingual Test Prompts (Hindi / Hinglish / English):
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  'एक रमेश सा कस्टमर',
                  'Add Ramesh as customer',
                  'राहुल करके कस्टमर बनाओ',
                  'रवि का बैलेंस बताओ',
                  'Ravi ka balance batao',
                  'Usmein 500 add kar do',
                  'Ravi ki last transaction delete karo',
                  'Total udhar kitna hai?',
                  'कस्टमर्स खोलो',
                  'Billing page kholo',
                  'दुकान की सेटिंग खोलो',
                  'नया ग्राहक जोड़ने का फॉर्म खोलो',
                  'Open search bar',
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
          </div>
        )}
      </div>
    </div>
  );
};

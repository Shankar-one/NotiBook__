import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Sparkles, 
  Volume2, 
  Check, 
  ArrowRight,
  HelpCircle,
  Square,
  Radio
} from 'lucide-react';
import { Customer, Product } from '../types';
import { parseBusinessCommand, ParsedCommandResult } from '../utils/aiCommandParser';
import { voiceSession } from '../voice';
import { VoiceState, ConversationTurn } from '../voice/types';

interface VoiceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  customers: Customer[];
  onApplyParsedResult: (result: ParsedCommandResult) => void;
}

export const VoiceRecordModal: React.FC<VoiceRecordModalProps> = ({
  isOpen,
  onClose,
  products,
  customers,
  onApplyParsedResult,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [jarvisReply, setJarvisReply] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedCommandResult | null>(null);
  const [volume, setVolume] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setTranscript('');
      setJarvisReply('');
      setParsedResult(null);
      return;
    }

    const unsubscribe = voiceSession.subscribe({
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onTranscript: (turn: ConversationTurn) => {
        if (turn.role === 'user') {
          setTranscript(turn.text);
          const res = parseBusinessCommand(turn.text, products, customers);
          setParsedResult(res);
        } else if (turn.role === 'assistant') {
          setJarvisReply(turn.text);
        }
      },
      onVolumeChange: (vol) => {
        setVolume(vol);
      },
      onJarvisMessage: (msg) => {
        setJarvisReply(msg);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, products, customers]);

  if (!isOpen) return null;

  const handleToggleListening = async () => {
    if (voiceState === 'IDLE' || voiceState === 'ERROR') {
      await voiceSession.start();
    } else {
      await voiceSession.stop();
    }
  };

  const handleSimulatePhrase = async (phrase: string) => {
    setTranscript(phrase);
    await voiceSession.sendManualUtterance(phrase);
  };

  const handleConfirmAction = () => {
    if (parsedResult) {
      onApplyParsedResult(parsedResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-[#EFE9DF] shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#FFEFEA] text-[#E85D43]">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#1E232A]">Jarvis Live Voice</h2>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Radio size={11} className="animate-pulse text-emerald-600" /> Continuous Mode
                </span>
              </div>
              <span className="text-xs text-[#8C827A]">Speak in Hindi, Hinglish, or English without pressing buttons</span>
            </div>
          </div>
          <button
            onClick={() => {
              voiceSession.stop();
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#8C827A] hover:text-[#1E232A] hover:bg-[#FAF7F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Big Animated Mic Circle */}
        <div className="flex flex-col items-center justify-center py-5 text-center space-y-3">
          <div className="relative">
            {voiceState === 'LISTENING' && (
              <>
                <div className="absolute inset-0 rounded-full bg-[#E85D43]/20 animate-ping" />
                <div className="absolute -inset-3 rounded-full bg-[#E85D43]/10 animate-pulse" />
              </>
            )}
            <button
              onClick={handleToggleListening}
              className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full text-white transition-all shadow-lg cursor-pointer ${
                voiceState === 'LISTENING'
                  ? 'bg-[#E85D43] scale-105 shadow-[#E85D43]/40'
                  : voiceState === 'SPEAKING'
                  ? 'bg-emerald-600 scale-105 shadow-emerald-500/30'
                  : voiceState === 'THINKING'
                  ? 'bg-indigo-600 animate-spin'
                  : 'bg-[#1C232B] hover:bg-[#2C3540] hover:scale-105 active:scale-95 shadow-slate-900/30'
              }`}
            >
              {voiceState === 'LISTENING' ? (
                <Mic size={36} />
              ) : voiceState === 'SPEAKING' ? (
                <Volume2 size={36} />
              ) : (
                <Mic size={36} />
              )}
            </button>
          </div>

          <div>
            <p className="text-sm font-bold text-[#1E232A]">
              {voiceState === 'IDLE' && 'Tap mic or say "Hey Jarvis" to start'}
              {voiceState === 'CONNECTING' && 'Connecting to Jarvis...'}
              {voiceState === 'LISTENING' && 'Listening... Speak naturally'}
              {voiceState === 'THINKING' && 'Jarvis is processing...'}
              {voiceState === 'SPEAKING' && 'Jarvis speaking (speak to interrupt)'}
            </p>
            <p className="text-xs text-[#8C827A] mt-0.5">
              Multi-turn: "Ravi ka balance batao" → "Usmein 500 add karo" → "Uski last transaction batao"
            </p>
          </div>
        </div>

        {/* Live Audio Waves Visualizer */}
        {voiceState === 'LISTENING' && (
          <div className="flex items-center justify-center gap-1.5 h-7">
            {[35, 70, 95, 55, 100, 65, 85, 45, 90, 60, 30].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-[#E85D43] rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(6, Math.min(28, volume * h * 0.4))}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Live Dialogue Card */}
        <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EFE9DF] space-y-2.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0988F] block">
              You Spoke:
            </span>
            <p className="text-sm text-[#1E232A] font-semibold min-h-[1.5rem] mt-0.5">
              {transcript || <span className="text-[#A0988F] italic font-normal">Listening for your command...</span>}
            </p>
          </div>

          {jarvisReply && (
            <div className="pt-2 border-t border-[#EFE9DF]/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                Jarvis Response:
              </span>
              <p className="text-sm text-emerald-900 font-medium mt-0.5 flex items-start gap-1.5">
                <Volume2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{jarvisReply}</span>
              </p>
            </div>
          )}

          {parsedResult && !jarvisReply && (
            <div className="pt-2 border-t border-[#EFE9DF]/80">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Check size={14} className="text-emerald-600" />
                <span>{parsedResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Sample Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-[#8C827A] block">
            Test conversational phrases:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'एक रमेश सा कस्टमर',
              'Add Ramesh as customer',
              'राहुल करके कस्टमर बनाओ',
              'रवि का बैलेंस बताओ',
              'Ravi ka balance batao',
              'Usmein 500 add kar do',
              'Ravi ki last transaction delete karo',
              'Total udhar kitna hai?',
              'Customers kholo',
              'Billing page kholo',
              'दुकान की सेटिंग खोलो',
              'नया ग्राहक जोड़ने का फॉर्म खोलो',
              'Open search bar',
              'रवि का लेजर खोलो',
              'Aaj kitna paisa aaya?',
            ].map((ex, i) => (
              <button
                key={i}
                onClick={() => handleSimulatePhrase(ex)}
                className="text-xs px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#FFEFEA] hover:text-[#E85D43] text-[#524B45] border border-[#EFE9DF] transition-colors cursor-pointer"
              >
                "{ex}"
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#EFE9DF]">
          <div className="text-[11px] text-[#8C827A]">
            Wake word: <span className="font-semibold text-[#1E232A]">"Hey Jarvis"</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                voiceSession.stop();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#655E57] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            >
              Close
            </button>
            {parsedResult && (
              <button
                onClick={handleConfirmAction}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-[#E85D43] hover:bg-[#D94E34] active:scale-98 transition-all shadow-xs cursor-pointer"
              >
                <span>Apply to Ledger</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

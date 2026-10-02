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
  ArrowRight,
  Globe
} from 'lucide-react';
import { voiceSession } from '../voice';
import { VoiceState, ConversationTurn } from '../voice/types';
import { UserLanguage, PreferredLanguage } from '../voice/LanguageUtils';

interface JarvisHUDProps {
  onNavigateToTab?: (tab: 'home' | 'customers' | 'book', subtab?: 'billing' | 'transactions' | 'stocks') => void;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = ({ onNavigateToTab }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [volume, setVolume] = useState<number>(0);
  const [lastMessage, setLastMessage] = useState<string>('');
  const [lastUserUtterance, setLastUserUtterance] = useState<string>('');
  const [currentLang, setCurrentLang] = useState<UserLanguage>('hinglish');
  const [langPref, setLangPref] = useState<PreferredLanguage>('auto');
  const [isWakeWordActive, setIsWakeWordActive] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [showDevTestMode, setShowDevTestMode] = useState<boolean>(false);

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
        } else {
          setExpanded(false);
        }
      },
      onTranscript: (turn: ConversationTurn) => {
        if (turn.lang) {
          setCurrentLang(turn.lang);
        }
        if (turn.role === 'user') {
          setLastUserUtterance(turn.text);
        } else if (turn.role === 'assistant') {
          setLastMessage(turn.text);
        }
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
    setExpanded(false);
  };

  const handleSimulateUtterance = async (text: string) => {
    await voiceSession.sendManualUtterance(text);
  };

  const handleSetLanguage = (pref: PreferredLanguage) => {
    voiceSession.setLanguage(pref);
    setLangPref(pref);
  };

  // Status visual colors
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

  // Localized Status Titles based on voice language
  const getStatusTitle = (): string => {
    if (voiceState === 'CONNECTING') {
      return currentLang === 'hindi' ? 'जार्विस से कनेक्ट हो रहा है...' : (currentLang === 'english' ? 'Connecting to Jarvis...' : 'Connecting to Jarvis...');
    }
    if (voiceState === 'LISTENING') {
      return currentLang === 'hindi' ? 'सुन रहा हूँ... बोलिए' : (currentLang === 'english' ? 'Listening to you...' : 'Listening to you...');
    }
    if (voiceState === 'THINKING') {
      return currentLang === 'hindi' ? 'जार्विस सोच रहा है...' : (currentLang === 'english' ? 'Jarvis thinking...' : 'Jarvis thinking...');
    }
    if (voiceState === 'SPEAKING') {
      return currentLang === 'hindi' ? 'जार्विस बोल रहा है' : (currentLang === 'english' ? 'Jarvis speaking' : 'Jarvis speaking');
    }
    if (voiceState === 'WAITING_FOR_CONFIRMATION') {
      return currentLang === 'hindi' ? 'पुष्टि की आवश्यकता है' : (currentLang === 'english' ? 'Confirmation needed' : 'Confirmation needed');
    }
    if (voiceState === 'ENDING') {
      return currentLang === 'hindi' ? 'सेशन समाप्त हो रहा है...' : (currentLang === 'english' ? 'Session ending...' : 'Session ending...');
    }
    if (voiceState === 'ERROR') {
      return currentLang === 'hindi' ? '⚠️ माइक्रोफ़ोन अनुमति अनिवार्य' : (currentLang === 'english' ? '⚠️ Microphone Access Compulsory' : '⚠️ Microphone Access Compulsory');
    }
    // IDLE
    if (currentLang === 'hindi') {
      return isWakeWordActive ? '🎙️ "हे जार्विस" बोलें (वेक वर्ड सक्रिय)' : '🎙️ "हे जार्विस" बोलें';
    }
    if (currentLang === 'english') {
      return isWakeWordActive ? '🎙️ Say "Hey Jarvis" (Wake Word Active)' : '🎙️ Say "Hey Jarvis"';
    }
    return isWakeWordActive ? '🎙️ Say "Hey Jarvis" (Wake Word Active)' : '🎙️ Say "Hey Jarvis"';
  };

  // Localized Subtitles based on voice language
  const getSublineText = (): string => {
    if (voiceState === 'ERROR') {
      return currentLang === 'hindi' ? 'माइक्रोफ़ोन अनुमति आवश्यक है — अनुमति देने के लिए क्लिक करें' : 'Microphone permission is required — Click to allow';
    }
    if (voiceState === 'SPEAKING') {
      return lastMessage;
    }
    if (lastUserUtterance) {
      return lastUserUtterance;
    }
    if (voiceState === 'IDLE') {
      if (currentLang === 'hindi') {
        return 'माइक पर टैप करें या "हे जार्विस" बोलें • निरंतर वॉइस मोड';
      }
      if (currentLang === 'english') {
        return 'Tap mic or say "Hey Jarvis" • Continuous multi-turn';
      }
      return 'Tap mic or say "Hey Jarvis" • Hindi / Hinglish / English';
    }
    if (currentLang === 'hindi') {
      return 'हिंदी में स्वाभाविक रूप से बोलें';
    }
    if (currentLang === 'english') {
      return 'Speak naturally in English';
    }
    return 'Speak naturally in Hindi, Hinglish, or English';
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

              {/* Wake Word listening pulse indicator when IDLE */}
              {voiceState === 'IDLE' && isWakeWordActive && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
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
                {voiceState === 'SPEAKING' && (
                  <span className="text-[10px] text-emerald-400 opacity-90 hidden sm:inline font-medium">
                    (Speak to interrupt)
                  </span>
                )}
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-300 font-bold border border-slate-700 shrink-0">
                  {currentLang === 'english' ? 'EN' : (currentLang === 'hindi' ? 'HI' : 'HG')}
                </span>
              </div>

              {/* Subline Preview */}
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {getSublineText()}
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

        {/* Expanded Panel: Dialogue History + Language Controls + Developer Test Mode */}
        {expanded && (
          <div className="p-3.5 bg-black/40 border-t border-slate-800/90 space-y-3 text-xs">
            {/* Automatic Language Detection Status Indicator (Read-Only Status Badge) */}
            <div className="flex items-center justify-between gap-1 p-2 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 pl-1">
                <Globe size={13} className="text-[#E85D43]" />
                <span>Language Detected:</span>
              </span>
              <div className="flex items-center gap-1">
                <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#E85D43]/20 border border-[#E85D43]/50 text-[#E85D43] flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-300">Auto</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-extrabold text-white">
                    {currentLang === 'hindi' ? 'हिन्दी (Hindi)' : (currentLang === 'english' ? 'English' : 'Hinglish')}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Dialogue Turns */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {lastUserUtterance && (
                <div className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="font-bold text-[#E85D43] shrink-0 text-[11px] uppercase tracking-wider">
                    {currentLang === 'hindi' ? 'आप:' : 'You:'}
                  </span>
                  <span className="text-slate-200">{lastUserUtterance}</span>
                </div>
              )}

              {lastMessage && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-200">
                  <Volume2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-emerald-400 block text-[10px] uppercase tracking-wider mb-0.5">
                      {currentLang === 'hindi' ? 'जार्विस:' : 'Jarvis:'}
                    </span>
                    <span>{lastMessage}</span>
                  </div>
                </div>
              )}

              {!lastUserUtterance && !lastMessage && voiceState !== 'ERROR' && (
                <div className="text-slate-400 italic text-center py-2 text-[11px]">
                  {currentLang === 'hindi'
                    ? '"हे जार्विस" बोलें या किसी भी काम के लिए माइक पर बात करें।'
                    : (currentLang === 'english'
                        ? 'Say "Hey Jarvis" or speak naturally in English.'
                        : 'Say "Hey Jarvis" or speak naturally in Hindi, Hinglish, or English.')}
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
                  {currentLang === 'hindi' ? 'पुष्टि करने के लिए "हाँ" बोलें या टैप करें:' : (currentLang === 'english' ? 'Say "Yes" to confirm or tap:' : 'Say "Haan" / "Yes" to confirm or tap:')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSimulateUtterance(currentLang === 'english' ? 'yes' : 'haan')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    {currentLang === 'hindi' ? 'हाँ (Confirm)' : (currentLang === 'english' ? 'Confirm (Yes)' : 'Haan (Confirm)')}
                  </button>
                  <button
                    onClick={() => handleSimulateUtterance(currentLang === 'english' ? 'no' : 'nahi')}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer text-center"
                  >
                    {currentLang === 'hindi' ? 'नहीं (Cancel)' : (currentLang === 'english' ? 'Cancel (No)' : 'Nahi (Cancel)')}
                  </button>
                </div>
              </div>
            )}

            {/* Discrete Dev Test Prompts (Supports English, Hinglish, Hindi) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={() => setShowDevTestMode(!showDevTestMode)}
                className="flex items-center justify-between w-full text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal size={11} />
                  <span>Sample Voice Prompts ({currentLang.toUpperCase()})</span>
                </span>
                <span>{showDevTestMode ? 'Hide ▲' : 'Show ▼'}</span>
              </button>

              {showDevTestMode && (
                <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                  {/* English Prompts */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">English:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        'Add 1000 debit to Kripa Shankar',
                        'What is Ravi balance?',
                        'Add 500 credit to Suresh',
                        'Open customers ledger',
                        'Show billing page',
                        'What is total market udhar?',
                        'Show today sales report',
                        'Thank you, that is all',
                      ].map((phrase, i) => (
                        <button
                          key={i}
                          onClick={() => handleSimulateUtterance(phrase)}
                          className="text-[10.5px] px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-[#E85D43] text-slate-200 hover:text-white transition-colors cursor-pointer"
                        >
                          "{phrase}"
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hindi & Hinglish Prompts */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">Hindi & Hinglish:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        'कृपा शंकर के अकाउंट में ₹1000 उधर लिख दो',
                        'सुरेश के खाते में ₹500 जमा लिखो',
                        'Ravi ka balance batao',
                        'Usmein 500 add kar do',
                        'Theek hai',
                        'Total udhar kitna hai?',
                        'Customers kholo',
                        'Billing page kholo',
                        'Aaj kitna paisa aaya?',
                      ].map((phrase, i) => (
                        <button
                          key={i}
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

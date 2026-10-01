import React, { useState, useEffect } from 'react';
import { Mic, MicOff, AlertTriangle, CheckCircle2, ShieldCheck, X, RefreshCw } from 'lucide-react';
import { voiceSession } from '../voice';

interface MicrophonePermissionPromptProps {
  onPermissionGranted?: () => void;
}

export const MicrophonePermissionPrompt: React.FC<MicrophonePermissionPromptProps> = ({
  onPermissionGranted,
}) => {
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem('notibook_mic_prompt_dismissed') === 'true';
  });

  const checkStatus = async () => {
    try {
      const status = await voiceSession.checkMicPermission();
      setPermissionStatus(status);
      if (status === 'granted') {
        setShowPrompt(false);
      } else if (!dismissed) {
        setShowPrompt(true);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    checkStatus();

    // Listen for permission change if browser supports it
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          permissionStatus.onchange = () => {
            setPermissionStatus(permissionStatus.state as 'prompt' | 'granted' | 'denied');
            if (permissionStatus.state === 'granted') {
              setShowPrompt(false);
              onPermissionGranted?.();
            }
          };
        })
        .catch(() => {});
    }
  }, []);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    const result = await voiceSession.requestMicPermission();
    setIsRequesting(false);

    if (result.granted) {
      setPermissionStatus('granted');
      setShowPrompt(false);
      onPermissionGranted?.();
      // Start Jarvis immediately once permission is granted
      void voiceSession.start();
    } else {
      setPermissionStatus('denied');
      setShowPrompt(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    sessionStorage.setItem('notibook_mic_prompt_dismissed', 'true');
  };

  if (!showPrompt && permissionStatus === 'granted') {
    return null;
  }

  // If dismissed or granted, render only a small reminder pill in case it's denied
  if (!showPrompt) {
    if (permissionStatus === 'denied') {
      return (
        <div className="fixed top-18 right-4 z-30 animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            onClick={() => setShowPrompt(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold shadow-lg hover:bg-rose-700 transition-all cursor-pointer"
            title="Microphone access is blocked. Click to view instructions."
          >
            <MicOff size={14} />
            <span>Mic Blocked (Allow to speak)</span>
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="fixed bottom-24 right-5 z-40 max-w-sm sm:max-w-md w-full px-4 sm:px-0 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="bg-[#1C232B] text-white rounded-2xl border border-[#E85D43]/60 shadow-2xl p-4 sm:p-5 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#E85D43]/20 text-[#E85D43] shrink-0">
              {permissionStatus === 'denied' ? <AlertTriangle size={18} className="text-amber-400" /> : <Mic size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Microphone Permission Compulsory</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#E85D43]/20 text-[#E85D43]">
                  Required
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                For continuous voice commands, Hindi/Hinglish speech, and hands-free ledger.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Dismiss reminder"
          >
            <X size={15} />
          </button>
        </div>

        {permissionStatus === 'denied' ? (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-xs">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Microphone is currently blocked in your browser:</span>
            </div>
            <ol className="list-decimal list-inside text-slate-300 space-y-1 pl-1 text-[11px]">
              <li>Click the lock or site settings icon 🔒 next to the website URL.</li>
              <li>Toggle <strong>Microphone</strong> to <strong>Allow</strong>.</li>
              <li>Click <strong>Check Again</strong> below.</li>
            </ol>
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} className={isRequesting ? 'animate-spin' : ''} />
              <span>Check Permission Again</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>Your voice stays private and is only used to update your NotiBook khata.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#E85D43] hover:bg-[#D94E34] active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-[#E85D43]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mic size={15} className={isRequesting ? 'animate-bounce' : ''} />
                <span>{isRequesting ? 'Requesting...' : 'Turn On Microphone'}</span>
              </button>

              <button
                onClick={handleDismiss}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

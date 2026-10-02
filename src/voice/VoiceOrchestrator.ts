import { AudioManager } from './AudioManager';
import { GeminiLiveManager } from './GeminiLiveManager';
import { WakeWordManager } from './WakeWordManager';
import { ContextManager } from './ContextManager';
import { ActionRouter, ActionRouterCallbacks } from './ActionRouter';
import { VoiceState } from './types';
import { 
  detectLanguage, 
  UserLanguage, 
  PreferredLanguage, 
  getStoredLanguagePreference, 
  setStoredLanguagePreference,
  getWakeGreetingText
} from './LanguageUtils';

export interface VoiceOrchestratorEvents {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string, lang?: UserLanguage) => void;
  onVolumeChange?: (volume: number) => void;
  onJarvisSpokenText?: (text: string, lang?: UserLanguage) => void;
  onLanguageChange?: (lang: UserLanguage, pref: PreferredLanguage) => void;
}

export class VoiceOrchestrator {
  private audioManager: AudioManager;
  private contextManager: ContextManager;
  private actionRouter: ActionRouter;
  private geminiLive: GeminiLiveManager;
  private wakeWordManager: WakeWordManager;

  private currentState: VoiceState = 'IDLE';
  private events: VoiceOrchestratorEvents = {};

  // Speech recognition for continuous voice capture
  private recognition: any = null;
  private isContinuousListening: boolean = false;
  private currentLanguagePreference: PreferredLanguage = 'auto';
  private currentVoiceLanguage: UserLanguage = 'hinglish';

  constructor(actionCallbacks: ActionRouterCallbacks = {}, events: VoiceOrchestratorEvents = {}) {
    this.events = events;
    this.currentLanguagePreference = getStoredLanguagePreference();
    this.currentVoiceLanguage = this.currentLanguagePreference === 'auto' ? 'hinglish' : this.currentLanguagePreference;

    this.audioManager = new AudioManager();
    this.contextManager = new ContextManager();
    this.actionRouter = new ActionRouter(actionCallbacks);

    this.geminiLive = new GeminiLiveManager(this.contextManager, this.actionRouter, {
      onStateChange: (state) => this.setState(state),
      onTranscript: (role, text, lang) => {
        const detectedLang = lang || this.currentVoiceLanguage;
        this.currentVoiceLanguage = detectedLang;
        this.events.onTranscript?.(role, text, detectedLang);
        if (role === 'assistant') {
          this.speakAssistantResponse(text, detectedLang);
        }
      },
      onEndSession: async (farewellText, lang) => {
        this.setState('ENDING');
        const detectedLang = lang || this.currentVoiceLanguage;
        this.events.onTranscript?.('assistant', farewellText, detectedLang);
        await this.speakAssistantResponse(farewellText, detectedLang);
        await this.stopActiveSession();
      },
    });

    this.wakeWordManager = new WakeWordManager();
    this.wakeWordManager.setOnWakeWordDetected(() => {
      this.handleWakeWordTriggered();
    });

    this.initSpeechRecognition();
    this.initUserGestureUnblocking();
    this.checkAndAutoStartWakeWord();
  }

  /**
   * Automatically start wake word if permission is already granted
   */
  private async checkAndAutoStartWakeWord() {
    try {
      const status = await AudioManager.checkPermission();
      if (status === 'granted') {
        console.log('[VoiceOrchestrator] Microphone permission already granted, arming wake word');
        await this.wakeWordManager.start();
      }
    } catch {}
  }

  /**
   * Unblocks audio context and speech recognition on user interaction,
   * ensuring browser audio and microphone permissions are unlocked.
   */
  private initUserGestureUnblocking() {
    if (typeof window === 'undefined') return;

    const unblock = async () => {
      console.log('[VoiceOrchestrator] User gesture detected: unblocking audio & wake word recognition');
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
        }
      } catch {}

      // If in IDLE state, ensure wake word is running
      if (this.currentState === 'IDLE') {
        try {
          await this.wakeWordManager.start();
        } catch {}
      }
    };

    window.addEventListener('click', unblock, { passive: true });
    window.addEventListener('keydown', unblock, { passive: true });
    window.addEventListener('touchstart', unblock, { passive: true });
  }

  private setState(state: VoiceState) {
    if (this.currentState === state) return;
    this.currentState = state;
    console.log(`[VoiceOrchestrator] State changed to: ${state}`);
    this.events.onStateChange?.(state);
  }

  public getState(): VoiceState {
    return this.currentState;
  }

  public getContextManager(): ContextManager {
    return this.contextManager;
  }

  public getLanguagePreference(): PreferredLanguage {
    return this.currentLanguagePreference;
  }

  public getCurrentVoiceLanguage(): UserLanguage {
    return this.currentVoiceLanguage;
  }

  public setLanguagePreference(pref: PreferredLanguage) {
    this.currentLanguagePreference = pref;
    setStoredLanguagePreference(pref);
    if (pref !== 'auto') {
      this.currentVoiceLanguage = pref;
    }
    // Update recognition language
    if (this.recognition) {
      if (pref === 'english') {
        this.recognition.lang = 'en-IN';
      } else if (pref === 'hindi') {
        this.recognition.lang = 'hi-IN';
      } else {
        this.recognition.lang = 'hi-IN'; // handles Hinglish and bilingual natural speech
      }
    }
    this.events.onLanguageChange?.(this.currentVoiceLanguage, pref);
  }

  public setCallbacks(actionCallbacks: ActionRouterCallbacks, events: VoiceOrchestratorEvents) {
    this.actionRouter.setCallbacks(actionCallbacks);
    this.events = { ...this.events, ...events };
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguagePreference === 'english' ? 'en-IN' : 'hi-IN';

      this.recognition.onstart = () => {
        this.isContinuousListening = true;
        this.setState('LISTENING');
      };

      this.recognition.onresult = (event: any) => {
        // Barge-in: if assistant is speaking and user starts talking, interrupt playback
        if (this.audioManager.getIsPlaying()) {
          console.log('[VoiceOrchestrator] Barge-in detected: interrupting playback');
          this.audioManager.interruptPlayback();
          this.setState('LISTENING');
        }

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript.trim()) {
          this.handleFinalUserUtterance(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          console.warn('[VoiceOrchestrator] Microphone permission not allowed');
          this.setState('ERROR');
          const errorMsg = this.currentVoiceLanguage === 'hindi'
            ? 'माइक्रोफ़ोन अनुमति अनिवार्य है। कृपया ब्राउज़र में माइक्रोफ़ोन की अनुमति दें।'
            : (this.currentVoiceLanguage === 'english'
                ? 'Microphone access is compulsory. Please allow microphone access in your browser.'
                : 'Microphone permission compulsory hai. Kripya browser mein microphone allow karein.');
          this.events.onJarvisSpokenText?.(errorMsg, this.currentVoiceLanguage);
          this.events.onTranscript?.('assistant', errorMsg, this.currentVoiceLanguage);
        } else if (e.error !== 'no-speech') {
          console.warn('[VoiceOrchestrator] Recognition error:', e.error);
        }
      };

      this.recognition.onend = () => {
        // If we are supposed to be continuously listening in active session, restart
        if (this.isContinuousListening && this.currentState !== 'IDLE' && this.currentState !== 'ERROR' && this.currentState !== 'ENDING') {
          setTimeout(() => {
            if (this.isContinuousListening && this.recognition) {
              try {
                this.recognition.start();
              } catch {}
            }
          }, 150);
        }
      };
    } catch (err) {
      console.warn('[VoiceOrchestrator] Speech init error:', err);
    }
  }

  /**
   * Called when "Hey Jarvis" wake word is spoken
   * Requirement: "Main sun raha hu should be hindi accent"
   */
  private async handleWakeWordTriggered() {
    console.log('[VoiceOrchestrator] Wake word "Hey Jarvis" activated!');
    await this.wakeWordManager.stop();

    // Select wake text according to current voice language preference
    let greetingText = 'Main sun raha hu.';
    if (this.currentVoiceLanguage === 'hindi') {
      greetingText = 'हाँ, मैं सुन रहा हूँ।';
    } else if (this.currentVoiceLanguage === 'english') {
      greetingText = 'Yes, I am listening.';
    } else {
      greetingText = 'Main sun raha hu.';
    }

    // Small delay to allow audio subsystem to transition cleanly
    await new Promise((r) => setTimeout(r, 120));
    await this.startActiveSession(greetingText, 'hindi'); // Force Hindi accent for "Main sun raha hu"
  }

  /**
   * Start a continuous voice session
   */
  public async startActiveSession(initialGreeting?: string, forceAccentLang?: string): Promise<void> {
    if (this.currentState !== 'IDLE' && this.currentState !== 'ERROR') {
      console.log('[VoiceOrchestrator] Session already active, ignoring redundant start');
      return;
    }

    this.audioManager.interruptPlayback();
    this.setState('CONNECTING');

    await this.wakeWordManager.stop();

    // Wait a brief tick for microphone device release before reconnecting
    await new Promise((r) => setTimeout(r, 150));

    await this.geminiLive.connect();

    // Start audio volume analysis
    try {
      await this.audioManager.startCapture(
        () => {},
        (vol) => this.events.onVolumeChange?.(vol)
      );
    } catch (err: any) {
      console.warn('[VoiceOrchestrator] Microphone capture failed:', err);
      this.setState('ERROR');
      const errorMsg = this.currentVoiceLanguage === 'hindi'
        ? 'माइक्रोफ़ोन अनुमति अनिवार्य है। कृपया अनुमति दें।'
        : (this.currentVoiceLanguage === 'english'
            ? 'Microphone access is compulsory. Please allow microphone access to talk to Jarvis.'
            : 'Microphone permission compulsory hai. Jarvis se baat karne ke liye mic allow karein.');
      this.events.onJarvisSpokenText?.(errorMsg, this.currentVoiceLanguage);
      this.events.onTranscript?.('assistant', errorMsg, this.currentVoiceLanguage);
      return;
    }

    // Start continuous speech recognition
    this.isContinuousListening = true;
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {}
    }

    if (initialGreeting) {
      const langForGreeting = forceAccentLang || this.currentVoiceLanguage;
      this.events.onTranscript?.('assistant', initialGreeting, this.currentVoiceLanguage);
      await this.speakAssistantResponse(initialGreeting, langForGreeting);
    } else {
      this.setState('LISTENING');
    }
  }

  /**
   * Stop active voice session and return to IDLE wake-word mode
   */
  public async stopActiveSession(): Promise<void> {
    console.log('[VoiceOrchestrator] Stopping active session...');
    this.isContinuousListening = false;
    this.audioManager.interruptPlayback();
    this.audioManager.stopCapture();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }

    this.geminiLive.disconnect();
    this.setState('IDLE');

    // Wait 250ms for microphone hardware release, then reactivate wake word listener for "Hey Jarvis"
    setTimeout(async () => {
      if (this.currentState === 'IDLE') {
        try {
          await this.wakeWordManager.start();
        } catch (err) {
          console.warn('[VoiceOrchestrator] WakeWord re-arm error:', err);
        }
      }
    }, 250);
  }

  /**
   * Toggle between starting session and stopping
   */
  public async toggleSession(): Promise<void> {
    if (this.currentState === 'IDLE' || this.currentState === 'ERROR') {
      const greeting = this.currentVoiceLanguage === 'hindi'
        ? 'हाँ, मैं सुन रहा हूँ।'
        : (this.currentVoiceLanguage === 'english' ? 'Yes, I am listening.' : 'Main sun raha hu.');
      await this.startActiveSession(greeting, 'hindi');
    } else {
      await this.stopActiveSession();
    }
  }

  public async enableWakeWord(): Promise<void> {
    if (this.currentState === 'IDLE') {
      await this.wakeWordManager.start();
    }
  }

  public isWakeWordListening(): boolean {
    return this.wakeWordManager.isListening();
  }

  /**
   * Handle user speaking in continuous session
   */
  public async handleFinalUserUtterance(rawText: string): Promise<void> {
    let text = rawText.trim();

    // Strip leading "Hey Jarvis" / "Jarvis" if spoken inside the utterance
    text = text.replace(/^(hey\s+jarvis|hi\s+jarvis|hello\s+jarvis|ok\s+jarvis|jarvis|हे\s*जार्विस|जार्विस)\s*[,:]?\s*/i, '').trim();
    if (!text) {
      // Just said "Hey Jarvis" during listening
      const ack = this.currentVoiceLanguage === 'hindi'
        ? 'हाँ, मैं सुन रहा हूँ।'
        : (this.currentVoiceLanguage === 'english' ? 'Yes, I am listening.' : 'Main sun raha hu.');
      this.events.onTranscript?.('assistant', ack, this.currentVoiceLanguage);
      await this.speakAssistantResponse(ack, 'hindi');
      return;
    }

    // Detect user language dynamically from speech
    const detectedLang = detectLanguage(text, this.currentLanguagePreference);
    this.currentVoiceLanguage = detectedLang;
    this.events.onLanguageChange?.(detectedLang, this.currentLanguagePreference);

    const lower = text.toLowerCase();

    // Check for exit keywords
    if (
      lower === 'stop' ||
      lower === 'bye jarvis' ||
      lower === 'exit' ||
      lower === 'close' ||
      lower === 'bye' ||
      lower.includes('alvida') ||
      lower.includes('band karo') ||
      text.includes('बंद करो') ||
      text.includes('अलविदा')
    ) {
      let byeMsg = 'Goodbye! Have a great day.';
      if (detectedLang === 'hindi') {
        byeMsg = 'अलविदा! आपका दिन शुभ हो।';
      } else if (detectedLang === 'hinglish') {
        byeMsg = 'Alvida! Have a great day.';
      }

      this.events.onTranscript?.('assistant', byeMsg, detectedLang);
      await this.speakAssistantResponse(byeMsg, detectedLang);
      await this.stopActiveSession();
      return;
    }

    // Process user input with Gemini Live & Action Router
    await this.geminiLive.sendUserInput(text);
  }

  /**
   * Speaks the response with barge-in support and resumes listening
   * Matches spoken audio language to generated response text language
   */
  private async speakAssistantResponse(text: string, lang?: string): Promise<void> {
    this.setState('SPEAKING');
    const spokenLang = (lang as UserLanguage) || this.currentVoiceLanguage;
    this.events.onJarvisSpokenText?.(text, spokenLang);

    let finished = false;
    const safetyTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        if (this.isContinuousListening && this.currentState !== 'IDLE' && this.currentState !== 'ENDING') {
          this.setState('LISTENING');
        }
      }
    }, 12000);

    await this.audioManager.speakText(text, spokenLang, () => {
      if (!finished) {
        finished = true;
        clearTimeout(safetyTimer);
        // Seamlessly resume listening after Jarvis finishes speaking
        if (this.isContinuousListening && this.currentState !== 'IDLE' && this.currentState !== 'ENDING') {
          this.setState('LISTENING');
        }
      }
    });
  }

  public cleanup(): void {
    this.stopActiveSession();
    this.wakeWordManager.destroy();
    this.audioManager.cleanup();
  }
}

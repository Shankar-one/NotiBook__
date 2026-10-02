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
  onInterimTranscript?: (text: string) => void;
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
  private isRecognizing: boolean = false;
  private speechCommitTimer: any = null;
  private latestHeardText: string = '';
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
    this.wakeWordManager.setOnWakeWordDetected((rawTranscript?: string) => {
      this.handleWakeWordTriggered(rawTranscript);
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
   * Unblocks audio context on user interaction,
   * ensuring browser audio output and microphone permissions are unlocked.
   */
  private initUserGestureUnblocking() {
    if (typeof window === 'undefined') return;

    const unblock = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
        }
      } catch {}

      // If in IDLE state and wake word is not active, try arming wake word
      if (this.currentState === 'IDLE' && !this.wakeWordManager.isListening()) {
        try {
          const perm = await AudioManager.checkPermission();
          if (perm === 'granted') {
            await this.wakeWordManager.start();
          }
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

    if (!SpeechRecognition) {
      console.log('[VoiceOrchestrator] Web SpeechRecognition unavailable, will use MediaRecorder + Gemini STT');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguagePreference === 'english' ? 'en-IN' : 'hi-IN';

      this.recognition.onstart = () => {
        this.isContinuousListening = true;
        this.isRecognizing = true;
        this.setState('LISTENING');
        console.log('[VoiceOrchestrator] Speech recognition active');
      };

      this.recognition.onresult = (event: any) => {
        // Barge-in: if assistant is speaking and user starts talking, interrupt playback
        if (this.audioManager.getIsPlaying()) {
          console.log('[VoiceOrchestrator] Barge-in detected: interrupting playback');
          this.audioManager.interruptPlayback();
          this.setState('LISTENING');
        }

        let fullFinalText = '';
        let currentInterimText = '';

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            const part = item[0].transcript || '';
            if (item.isFinal) {
              fullFinalText += (fullFinalText ? ' ' : '') + part.trim();
            } else {
              currentInterimText += (currentInterimText ? ' ' : '') + part.trim();
            }
          }
        }

        const combined = (fullFinalText + (currentInterimText ? ' ' + currentInterimText : '')).trim();

        if (combined) {
          this.latestHeardText = combined;
          this.events.onInterimTranscript?.(combined);

          // Reset silence timer: wait for 2.2 seconds of complete silence after speech ends
          // This allows users to speak compound sentences with natural pauses without being cut off
          if (this.speechCommitTimer) clearTimeout(this.speechCommitTimer);
          this.speechCommitTimer = setTimeout(() => {
            void this.commitCurrentSpeech();
          }, 2200);
        }
      };

      this.recognition.onerror = async (e: any) => {
        console.warn('[VoiceOrchestrator] Speech recognition error event:', e.error);
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
          return;
        }

        // Fallback to server-side Gemini audio transcription on network or service errors
        if (e.error === 'network' || e.error === 'service-not-allowed') {
          console.log('[VoiceOrchestrator] Using server-side Gemini audio transcription fallback...');
          await this.attemptGeminiAudioTranscription();
        }
      };

      this.recognition.onend = () => {
        this.isRecognizing = false;
        // If we are supposed to be continuously listening in active session, restart
        if (this.isContinuousListening && this.currentState !== 'IDLE' && this.currentState !== 'ERROR' && this.currentState !== 'ENDING') {
          setTimeout(() => {
            if (this.isContinuousListening && this.recognition && !this.isRecognizing) {
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
   * Commits the entire voice utterance (from Web Speech API or recorded audio via Gemini)
   */
  public async commitCurrentSpeech(): Promise<void> {
    if (this.speechCommitTimer) {
      clearTimeout(this.speechCommitTimer);
      this.speechCommitTimer = null;
    }

    const textToCommit = this.latestHeardText.trim();
    this.latestHeardText = '';
    this.events.onInterimTranscript?.('');

    if (textToCommit) {
      console.log('[VoiceOrchestrator] Committing full voice utterance:', textToCommit);
      this.audioManager.resetRecordedAudio();
      
      // Momentarily abort and restart recognition so Chrome clears its buffer for the next utterance
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {}
      }

      await this.handleFinalUserUtterance(textToCommit);
      return;
    }

    // Fallback: If Web Speech produced no text, check the audio recorded in MediaRecorder!
    const transcribed = await this.attemptGeminiAudioTranscription();
    if (!transcribed && this.isContinuousListening && this.currentState === 'LISTENING') {
      // Keep listening
    }
  }

  /**
   * Transcribe recorded audio with server-side Gemini STT fallback
   */
  private async attemptGeminiAudioTranscription(): Promise<boolean> {
    const recorded = await this.audioManager.getRecordedAudioBase64();
    if (recorded && recorded.base64) {
      this.setState('THINKING');
      this.events.onInterimTranscript?.(
        this.currentVoiceLanguage === 'hindi' ? 'पूरा ऑडियो बदला जा रहा है...' : 'Converting whole audio to text...'
      );
      const transcript = await this.audioManager.transcribeAudio(
        recorded.base64,
        recorded.mimeType,
        this.currentVoiceLanguage
      );
      this.events.onInterimTranscript?.('');
      this.audioManager.resetRecordedAudio();
      if (transcript && transcript.trim()) {
        console.log('[VoiceOrchestrator] Successfully transcribed full audio via Gemini STT:', transcript);
        await this.handleFinalUserUtterance(transcript.trim());
        return true;
      }
    }
    return false;
  }

  /**
   * Called when "Hey Jarvis" wake word is spoken
   * Requirement: "Main sun raha hu should be hindi accent"
   */
  private async handleWakeWordTriggered(rawTranscript?: string) {
    console.log('[VoiceOrchestrator] Wake word "Hey Jarvis" activated! Opening recording feature immediately. Transcript:', rawTranscript);
    await this.wakeWordManager.stop();

    // Play immediate affirmative acoustic chime so user knows recording has started
    this.audioManager.playWakeChime();

    // Check if user spoke a command alongside "Hey Jarvis" (e.g. "Hey Jarvis, customer tab kholo" or "Hey Jarvis add 1000 into account")
    let trailingCommand = '';
    if (rawTranscript) {
      trailingCommand = rawTranscript.replace(
        /\b(hey|hay|hi|hello|ok|okay|oye|ae|a|sun|suno|he|ha|haay)?\s*(jarvis|jervis|jarves|javis|jarvish|service|travis|charvis|jahvis|jarvisis|jarvises|jar\s*vis|job\s*is|tarvis|jawis)\b|जार्विस|हे\s*जार्विस|हाय\s*जार्विस|सुनो\s*जार्विस|जारविस|ए\s*जार्विस|सर्विस/gi,
        ''
      ).replace(/^[,:.\s]+|[,:.\s]+$/g, '').trim();
    }

    // Open the recording feature immediately!
    await this.startActiveSession();

    if (trailingCommand.length >= 2) {
      console.log('[VoiceOrchestrator] Direct command detected with wake word:', trailingCommand);
      await this.handleFinalUserUtterance(trailingCommand);
      return;
    }

    // User only said "Hey Jarvis":
    // Announce "Main sun raha hu." in background while the recording feature is ALREADY ACTIVE AND RECORDING!
    const greetingText = this.currentVoiceLanguage === 'hindi'
      ? 'हाँ, मैं सुन रहा हूँ।'
      : (this.currentVoiceLanguage === 'english' ? 'Yes, I am listening.' : 'Main sun raha hu.');
    this.events.onJarvisSpokenText?.(greetingText, this.currentVoiceLanguage);
    this.events.onTranscript?.('assistant', greetingText, this.currentVoiceLanguage);
    void this.audioManager.speakText(greetingText, 'hindi');
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
    await new Promise((r) => setTimeout(r, 100));

    await this.geminiLive.connect();

    // Start audio volume analysis with speech presence extender
    try {
      await this.audioManager.startCapture(
        () => {},
        (vol) => {
          this.events.onVolumeChange?.(vol);
          // If user is actively speaking (vol > 0.08), push the commit timer back by 2.2s
          if (vol > 0.08 && this.latestHeardText) {
            if (this.speechCommitTimer) {
              clearTimeout(this.speechCommitTimer);
              this.speechCommitTimer = setTimeout(() => {
                void this.commitCurrentSpeech();
              }, 2200);
            }
          }
        }
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

    // Start continuous speech recognition if available in browser
    this.isContinuousListening = true;
    if (this.recognition && !this.isRecognizing) {
      try {
        this.recognition.lang = this.currentLanguagePreference === 'english' ? 'en-IN' : 'hi-IN';
        this.recognition.start();
      } catch (e) {
        console.warn('[VoiceOrchestrator] recognition start warning:', e);
      }
    }

    // Immediately open recording state
    this.setState('LISTENING');

    if (initialGreeting) {
      const langForGreeting = forceAccentLang || this.currentVoiceLanguage;
      this.events.onTranscript?.('assistant', initialGreeting, this.currentVoiceLanguage);
      void this.speakAssistantResponse(initialGreeting, langForGreeting);
    }
  }

  /**
   * Stop active voice session and return to IDLE wake-word mode
   */
  public async stopActiveSession(): Promise<void> {
    console.log('[VoiceOrchestrator] Stopping active session...');
    this.isContinuousListening = false;
    if (this.speechCommitTimer) {
      clearTimeout(this.speechCommitTimer);
      this.speechCommitTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      try {
        this.recognition.stop();
      } catch {}
    }

    this.audioManager.interruptPlayback();

    // If user was actively speaking and had captured text, process the full utterance
    if (this.latestHeardText.trim()) {
      const textToProcess = this.latestHeardText.trim();
      this.latestHeardText = '';
      this.events.onInterimTranscript?.('');
      this.audioManager.stopCapture();
      this.audioManager.resetRecordedAudio();
      this.geminiLive.disconnect();
      this.setState('IDLE');
      await this.handleFinalUserUtterance(textToProcess);
      this.reArmWakeWord();
      return;
    }

    // If Web Speech API didn't produce any text, fallback to Gemini transcription of the whole recorded audio
    const transcribed = await this.attemptGeminiAudioTranscription();
    this.audioManager.stopCapture();
    this.audioManager.resetRecordedAudio();
    this.geminiLive.disconnect();
    this.setState('IDLE');

    if (!transcribed) {
      this.reArmWakeWord();
    }
  }

  private reArmWakeWord(): void {
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

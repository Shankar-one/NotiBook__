import { AudioManager } from './AudioManager';
import { GeminiLiveManager } from './GeminiLiveManager';
import { WakeWordManager } from './WakeWordManager';
import { ContextManager } from './ContextManager';
import { ActionRouter, ActionRouterCallbacks } from './ActionRouter';
import { VoiceState } from './types';

export interface VoiceOrchestratorEvents {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
  onVolumeChange?: (volume: number) => void;
  onJarvisSpokenText?: (text: string) => void;
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

  constructor(actionCallbacks: ActionRouterCallbacks = {}, events: VoiceOrchestratorEvents = {}) {
    this.events = events;
    this.audioManager = new AudioManager();
    this.contextManager = new ContextManager();
    this.actionRouter = new ActionRouter(actionCallbacks);

    this.geminiLive = new GeminiLiveManager(this.contextManager, this.actionRouter, {
      onStateChange: (state) => this.setState(state),
      onTranscript: (role, text, lang) => {
        this.events.onTranscript?.(role, text);
        if (role === 'assistant') {
          this.speakAssistantResponse(text, lang);
        }
      },
      onEndSession: async (farewellText, lang) => {
        this.setState('ENDING');
        this.events.onTranscript?.('assistant', farewellText);
        await this.speakAssistantResponse(farewellText, lang);
        await this.stopActiveSession();
      },
    });

    this.wakeWordManager = new WakeWordManager();
    this.wakeWordManager.setOnWakeWordDetected(() => {
      this.handleWakeWordTriggered();
    });

    this.initSpeechRecognition();
    this.initUserGestureUnblocking();
  }

  /**
   * Unblocks audio context and speech recognition on first user interaction,
   * ensuring browser audio and microphone permissions are unlocked.
   */
  private initUserGestureUnblocking() {
    if (typeof window === 'undefined') return;

    const unblock = () => {
      console.log('[VoiceOrchestrator] User gesture detected: unblocking audio & mic recognition');
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch {}

      try {
        this.wakeWordManager.start();
      } catch {}

      window.removeEventListener('click', unblock);
      window.removeEventListener('keydown', unblock);
      window.removeEventListener('touchstart', unblock);
    };

    window.addEventListener('click', unblock, { once: true });
    window.addEventListener('keydown', unblock, { once: true });
    window.addEventListener('touchstart', unblock, { once: true });
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
      this.recognition.lang = 'hi-IN'; // accepts Hindi, Hinglish, and English naturally

      this.recognition.onstart = () => {
        this.isContinuousListening = true;
        this.setState('LISTENING');
      };

      this.recognition.onresult = (event: any) => {
        // If assistant is currently speaking and user speaks -> BARGE-IN!
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
          const errorMsg = 'Microphone access is compulsory. Please allow microphone permission in your browser.';
          this.events.onJarvisSpokenText?.(errorMsg);
          this.events.onTranscript?.('assistant', errorMsg);
        } else if (e.error !== 'no-speech') {
          console.warn('[VoiceOrchestrator] Recognition error:', e.error);
        }
      };

      this.recognition.onend = () => {
        // If we are supposed to be continuously listening in active session, restart
        if (this.isContinuousListening && this.currentState !== 'IDLE' && this.currentState !== 'ERROR') {
          try {
            this.recognition.start();
          } catch {}
        }
      };
    } catch (err) {
      console.warn('[VoiceOrchestrator] Speech init error:', err);
    }
  }

  /**
   * Called when "Hey Jarvis" is spoken
   */
  private async handleWakeWordTriggered() {
    console.log('[VoiceOrchestrator] "Hey Jarvis" activated!');
    await this.wakeWordManager.stop();
    await this.startActiveSession('Yes? Main sun raha hoon.');
  }

  /**
   * Start a continuous voice session
   */
  public async startActiveSession(initialGreeting?: string): Promise<void> {
    if (this.currentState !== 'IDLE' && this.currentState !== 'ERROR') {
      console.log('[VoiceOrchestrator] Session already active, ignoring redundant start');
      return;
    }

    this.audioManager.interruptPlayback();
    this.setState('CONNECTING');

    await this.wakeWordManager.stop();
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
      const errorMsg = 'Microphone access is compulsory. Please allow microphone access to talk to Jarvis.';
      this.events.onJarvisSpokenText?.(errorMsg);
      this.events.onTranscript?.('assistant', errorMsg);
      return;
    }

    // Start speech recognition
    this.isContinuousListening = true;
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {}
    }

    if (initialGreeting) {
      this.events.onTranscript?.('assistant', initialGreeting);
      await this.speakAssistantResponse(initialGreeting);
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

    // Reactivate wake word listener for "Hey Jarvis"
    await this.wakeWordManager.start();
  }

  /**
   * Toggle between starting session and stopping
   */
  public async toggleSession(): Promise<void> {
    if (this.currentState === 'IDLE' || this.currentState === 'ERROR') {
      await this.startActiveSession('Yes?');
    } else {
      await this.stopActiveSession();
    }
  }

  /**
   * Handle user speaking in continuous session
   */
  public async handleFinalUserUtterance(text: string): Promise<void> {
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
      const isHindi = /[\u0900-\u097F]/.test(text);
      const isEnglish = lower === 'stop' || lower === 'exit' || lower === 'close' || lower === 'bye';
      const byeMsg = isHindi ? 'अलविदा! आपका दिन शुभ हो।' : (isEnglish ? 'Goodbye! Have a great day.' : 'Alvida! Have a great day.');
      const byeLang = isHindi ? 'hindi' : (isEnglish ? 'english' : 'hinglish');
      this.events.onTranscript?.('assistant', byeMsg);
      await this.speakAssistantResponse(byeMsg, byeLang);
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
    this.events.onJarvisSpokenText?.(text);

    let finished = false;
    const safetyTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        if (this.isContinuousListening && this.currentState !== 'IDLE' && this.currentState !== 'ENDING') {
          this.setState('LISTENING');
        }
      }
    }, 12000);

    await this.audioManager.speakText(text, lang, () => {
      if (!finished) {
        finished = true;
        clearTimeout(safetyTimer);
        // Once Jarvis finishes speaking, seamlessly resume listening
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

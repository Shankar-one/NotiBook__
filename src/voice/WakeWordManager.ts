import { WakeWordProvider } from './types';

/**
 * Standard Web Speech & Keyword Recognition WakeWord Provider
 * Implements the abstract WakeWordProvider interface with robust auto-recovery,
 * watchdog monitoring, Indian/English phonetics, and multi-turn coordination.
 */
export class SpeechWakeWordProvider implements WakeWordProvider {
  public name = 'speech-wakeword-provider';
  private recognition: any = null;
  private isRunning: boolean = false;
  private isStarting: boolean = false;
  private isListening: boolean = false;
  private detectedCallbacks: Array<(rawTranscript?: string) => void> = [];
  private restartTimeout: any = null;
  private watchdogInterval: any = null;
  private lastDetectedTimestamp: number = 0;

  constructor() {
    this.initRecognition();
    this.startWatchdog();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[WakeWord] Web SpeechRecognition is not supported in this browser');
      return;
    }

    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {}
        this.recognition = null;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      // en-IN recognizes both Indian English and Hindi/Hinglish pronunciations of "Jarvis" / "हे जार्विस"
      this.recognition.lang = 'en-IN';

      this.recognition.onstart = () => {
        this.isStarting = false;
        this.isListening = true;
        console.log('[WakeWord] Wake word listener ACTIVE (Waiting for "Hey Jarvis")');
      };

      this.recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res && res[0] && res[0].transcript) {
            fullTranscript += ' ' + res[0].transcript;
          }
        }

        const raw = fullTranscript.trim();
        const lower = raw.toLowerCase();
        const clean = lower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').replace(/\s+/g, ' ').trim();

        // Comprehensive wake word detection for "Hey Jarvis", "Jarvis", "हे जार्विस", Indian accents, and common phonetic interpretations
        const wakeWordRegex = /\b(hey|hay|hi|hello|ok|okay|oye|ae|a|sun|suno|he|ha|haay)?\s*(jarvis|jervis|jarves|javis|jarvish|service|travis|charvis|jahvis|jarvisis|jarvises|jar\s*vis|job\s*is|tarvis|jawis)\b|जार्विस|हे\s*जार्विस|हाय\s*जार्विस|सुनो\s*जार्विस|जारविस|ए\s*जार्विस|सर्विस/i;

        if (wakeWordRegex.test(clean) || wakeWordRegex.test(lower) || wakeWordRegex.test(raw)) {
          const now = Date.now();
          if (now - this.lastDetectedTimestamp > 1800) {
            this.lastDetectedTimestamp = now;
            console.log('[WakeWord] Wake word DETECTED: "Hey Jarvis" from transcript:', raw);
            this.notifyDetected(raw);
          }
        }
      };

      this.recognition.onerror = (e: any) => {
        this.isStarting = false;
        if (e.error === 'not-allowed') {
          console.warn('[WakeWord] Microphone permission not allowed for wake word');
          this.isListening = false;
          return;
        }

        if (e.error !== 'no-speech') {
          console.log('[WakeWord] Recognition transient event:', e.error);
        }

        // Auto-restart on transient events if running
        if (this.isRunning) {
          this.scheduleRestart(200);
        }
      };

      this.recognition.onend = () => {
        this.isStarting = false;
        this.isListening = false;
        if (this.isRunning) {
          this.scheduleRestart(100);
        }
      };
    } catch (err) {
      console.warn('[WakeWord] Init error:', err);
    }
  }

  private scheduleRestart(delayMs: number = 200) {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      if (this.isRunning && !this.isListening && !this.isStarting) {
        this.safeStart();
      }
    }, delayMs);
  }

  private safeStart() {
    if (!this.isRunning || this.isListening || this.isStarting) return;

    if (!this.recognition) {
      this.initRecognition();
    }

    if (!this.recognition) return;

    try {
      this.isStarting = true;
      this.recognition.start();
    } catch (err: any) {
      this.isStarting = false;
      // If recognition is already started, mark listening
      if (err.name === 'InvalidStateError' || (err.message && err.message.includes('already started'))) {
        this.isListening = true;
      } else {
        // Retry with backoff
        this.scheduleRestart(400);
      }
    }
  }

  private startWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    // Periodically verify wake-word health
    this.watchdogInterval = setInterval(() => {
      if (this.isRunning && !this.isListening && !this.isStarting) {
        console.log('[WakeWord Watchdog] Re-arming wake word listener');
        this.safeStart();
      }
    }, 1500);
  }

  public onDetected(callback: (rawTranscript?: string) => void): void {
    this.detectedCallbacks.push(callback);
  }

  private notifyDetected(rawTranscript?: string) {
    this.detectedCallbacks.forEach((cb) => {
      try {
        cb(rawTranscript);
      } catch (err) {
        console.error('[WakeWord] Callback error:', err);
      }
    });
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.safeStart();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.isStarting = false;
    this.isListening = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public async destroy(): Promise<void> {
    await this.stop();
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
    this.detectedCallbacks = [];
    this.recognition = null;
  }
}

/**
 * WakeWordManager orchestrates the wake-word provider
 */
export class WakeWordManager {
  private provider: SpeechWakeWordProvider;
  private isEnabled: boolean = true;
  private onWakeWordDetectedCallback?: (rawTranscript?: string) => void;

  constructor(customProvider?: WakeWordProvider) {
    this.provider = (customProvider as SpeechWakeWordProvider) || new SpeechWakeWordProvider();
    this.provider.onDetected((raw) => {
      if (this.isEnabled && this.onWakeWordDetectedCallback) {
        this.onWakeWordDetectedCallback(raw);
      }
    });
  }

  public setOnWakeWordDetected(callback: (rawTranscript?: string) => void): void {
    this.onWakeWordDetectedCallback = callback;
  }

  public async start(): Promise<void> {
    this.isEnabled = true;
    await this.provider.start();
  }

  public async stop(): Promise<void> {
    this.isEnabled = false;
    await this.provider.stop();
  }

  public isListening(): boolean {
    return this.isEnabled && this.provider.getIsListening();
  }

  public async destroy(): Promise<void> {
    this.isEnabled = false;
    await this.provider.destroy();
  }
}

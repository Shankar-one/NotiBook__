import { WakeWordProvider } from './types';

/**
 * Standard Web Speech & Keyword Recognition WakeWord Provider
 * Implements the abstract WakeWordProvider interface so it can be swapped
 * with openWakeWord or custom WASM/ONNX models without touching business logic.
 */
export class SpeechWakeWordProvider implements WakeWordProvider {
  public name = 'speech-wakeword-provider';
  private recognition: any = null;
  private isRunning: boolean = false;
  private detectedCallbacks: Array<() => void> = [];
  private restartTimeout: any = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          // Detect "hey jarvis", "jarvis", "okay jarvis", "hi jarvis"
          if (
            transcript.includes('hey jarvis') ||
            transcript.includes('hay jarvis') ||
            transcript.includes('a jarvis') ||
            transcript.includes('ok jarvis') ||
            transcript.includes('okay jarvis') ||
            transcript.includes('jarvis')
          ) {
            console.log('[WakeWord] Wake word detected: "Hey Jarvis"');
            this.notifyDetected();
            break;
          }
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          console.warn('[WakeWord] Mic permission not granted for wake word');
          this.isRunning = false;
          return;
        }
        // Auto-restart on transient errors if running
        if (this.isRunning) {
          this.scheduleRestart();
        }
      };

      this.recognition.onend = () => {
        if (this.isRunning) {
          this.scheduleRestart();
        }
      };
    } catch (err) {
      console.warn('[WakeWord] Init error:', err);
    }
  }

  private scheduleRestart() {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      if (this.isRunning && this.recognition) {
        try {
          this.recognition.start();
        } catch {}
      }
    }, 400);
  }

  public onDetected(callback: () => void): void {
    this.detectedCallbacks.push(callback);
  }

  private notifyDetected() {
    this.detectedCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[WakeWord] Callback error:', err);
      }
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {}
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public async destroy(): Promise<void> {
    await this.stop();
    this.detectedCallbacks = [];
    this.recognition = null;
  }
}

/**
 * WakeWordManager orchestrates the wake-word provider
 */
export class WakeWordManager {
  private provider: WakeWordProvider;
  private isEnabled: boolean = true;
  private onWakeWordDetectedCallback?: () => void;

  constructor(customProvider?: WakeWordProvider) {
    this.provider = customProvider || new SpeechWakeWordProvider();
    this.provider.onDetected(() => {
      if (this.isEnabled && this.onWakeWordDetectedCallback) {
        this.onWakeWordDetectedCallback();
      }
    });
  }

  public setOnWakeWordDetected(callback: () => void): void {
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

  public async destroy(): Promise<void> {
    this.isEnabled = false;
    await this.provider.destroy();
  }
}

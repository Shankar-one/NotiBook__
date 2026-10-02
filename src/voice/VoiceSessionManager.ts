import { AudioManager } from './AudioManager';
import { VoiceOrchestrator } from './VoiceOrchestrator';
import { VoiceState, ConversationTurn } from './types';
import { ActionRouterCallbacks } from './ActionRouter';
import { UserLanguage, PreferredLanguage } from './LanguageUtils';

export interface VoiceSessionSubscriber {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (turn: ConversationTurn) => void;
  onInterimTranscript?: (text: string) => void;
  onVolumeChange?: (volume: number) => void;
  onJarvisMessage?: (message: string, lang?: UserLanguage) => void;
  onLanguageChange?: (lang: UserLanguage, pref: PreferredLanguage) => void;
}

export class VoiceSessionManager {
  private static instance: VoiceSessionManager;
  private orchestrator: VoiceOrchestrator;
  private subscribers: Set<VoiceSessionSubscriber> = new Set();
  private transcripts: ConversationTurn[] = [];
  private lastJarvisMessage: string = '';
  private lastJarvisLang: UserLanguage = 'hinglish';
  private currentVolume: number = 0;

  private constructor() {
    this.orchestrator = new VoiceOrchestrator(
      {},
      {
        onStateChange: (state) => {
          this.subscribers.forEach((s) => s.onStateChange?.(state));
        },
        onTranscript: (role, text, lang) => {
          const turn: ConversationTurn = { role, text, timestamp: Date.now(), lang };
          this.transcripts.push(turn);
          this.subscribers.forEach((s) => s.onTranscript?.(turn));
        },
        onInterimTranscript: (text) => {
          this.subscribers.forEach((s) => s.onInterimTranscript?.(text));
        },
        onVolumeChange: (vol) => {
          this.currentVolume = vol;
          this.subscribers.forEach((s) => s.onVolumeChange?.(vol));
        },
        onJarvisSpokenText: (text, lang) => {
          this.lastJarvisMessage = text;
          if (lang) this.lastJarvisLang = lang;
          this.subscribers.forEach((s) => s.onJarvisMessage?.(text, lang));
        },
        onLanguageChange: (lang, pref) => {
          this.lastJarvisLang = lang;
          this.subscribers.forEach((s) => s.onLanguageChange?.(lang, pref));
        },
      }
    );
  }

  public static getInstance(): VoiceSessionManager {
    if (!VoiceSessionManager.instance) {
      VoiceSessionManager.instance = new VoiceSessionManager();
    }
    return VoiceSessionManager.instance;
  }

  public setActionCallbacks(callbacks: ActionRouterCallbacks) {
    this.orchestrator.setCallbacks(callbacks, {
      onStateChange: (state) => {
        this.subscribers.forEach((s) => s.onStateChange?.(state));
      },
      onTranscript: (role, text, lang) => {
        const turn: ConversationTurn = { role, text, timestamp: Date.now(), lang };
        this.transcripts.push(turn);
        this.subscribers.forEach((s) => s.onTranscript?.(turn));
      },
      onInterimTranscript: (text) => {
        this.subscribers.forEach((s) => s.onInterimTranscript?.(text));
      },
      onVolumeChange: (vol) => {
        this.currentVolume = vol;
        this.subscribers.forEach((s) => s.onVolumeChange?.(vol));
      },
      onJarvisSpokenText: (text, lang) => {
        this.lastJarvisMessage = text;
        if (lang) this.lastJarvisLang = lang;
        this.subscribers.forEach((s) => s.onJarvisMessage?.(text, lang));
      },
      onLanguageChange: (lang, pref) => {
        this.lastJarvisLang = lang;
        this.subscribers.forEach((s) => s.onLanguageChange?.(lang, pref));
      },
    });
  }

  public subscribe(subscriber: VoiceSessionSubscriber): () => void {
    this.subscribers.add(subscriber);
    // Initial emit
    subscriber.onStateChange?.(this.orchestrator.getState());
    subscriber.onLanguageChange?.(this.orchestrator.getCurrentVoiceLanguage(), this.orchestrator.getLanguagePreference());
    if (this.lastJarvisMessage) {
      subscriber.onJarvisMessage?.(this.lastJarvisMessage, this.lastJarvisLang);
    }
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getState(): VoiceState {
    return this.orchestrator.getState();
  }

  public getLanguagePreference(): PreferredLanguage {
    return this.orchestrator.getLanguagePreference();
  }

  public getCurrentVoiceLanguage(): UserLanguage {
    return this.orchestrator.getCurrentVoiceLanguage();
  }

  public getContextManager() {
    return this.orchestrator.getContextManager();
  }

  public setLanguage(pref: PreferredLanguage): void {
    this.orchestrator.setLanguagePreference(pref);
  }

  public async start(): Promise<void> {
    if (this.getState() !== 'IDLE' && this.getState() !== 'ERROR') {
      return;
    }
    const curLang = this.getCurrentVoiceLanguage();
    const greeting = curLang === 'hindi'
      ? 'हाँ, मैं सुन रहा हूँ।'
      : (curLang === 'english' ? 'Yes, I am listening.' : 'Main sun raha hu.');
    // Force Hindi accent for greeting
    await this.orchestrator.startActiveSession(greeting, 'hindi');
  }

  public async stop(): Promise<void> {
    await this.orchestrator.stopActiveSession();
  }

  public async commitCurrentSpeech(): Promise<void> {
    await this.orchestrator.commitCurrentSpeech();
  }

  public async toggle(): Promise<void> {
    await this.orchestrator.toggleSession();
  }

  public isWakeWordListening(): boolean {
    return this.orchestrator.isWakeWordListening();
  }

  public async enableWakeWord(): Promise<void> {
    await this.orchestrator.enableWakeWord();
  }

  public async checkMicPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    return AudioManager.checkPermission();
  }

  public async requestMicPermission(): Promise<{ granted: boolean; error?: string }> {
    const res = await AudioManager.requestPermission();
    if (res.granted) {
      await this.enableWakeWord();
      if (this.getState() === 'ERROR') {
        await this.stop();
      }
    }
    return res;
  }

  public async sendManualUtterance(text: string): Promise<void> {
    if (this.getState() === 'IDLE') {
      await this.orchestrator.startActiveSession();
    }
    await this.orchestrator.handleFinalUserUtterance(text);
  }

  public getTranscripts(): ConversationTurn[] {
    return [...this.transcripts];
  }

  public getContext() {
    return this.orchestrator.getContextManager().getContext();
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public getLastJarvisMessage(): string {
    return this.lastJarvisMessage;
  }

  public cleanup(): void {
    this.orchestrator.cleanup();
    this.subscribers.clear();
  }
}

export const voiceSession = VoiceSessionManager.getInstance();

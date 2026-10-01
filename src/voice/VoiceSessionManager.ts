import { VoiceOrchestrator } from './VoiceOrchestrator';
import { VoiceState, ConversationTurn } from './types';
import { ActionRouterCallbacks } from './ActionRouter';

export interface VoiceSessionSubscriber {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (turn: ConversationTurn) => void;
  onVolumeChange?: (volume: number) => void;
  onJarvisMessage?: (message: string) => void;
}

export class VoiceSessionManager {
  private static instance: VoiceSessionManager;
  private orchestrator: VoiceOrchestrator;
  private subscribers: Set<VoiceSessionSubscriber> = new Set();
  private transcripts: ConversationTurn[] = [];
  private lastJarvisMessage: string = '';
  private currentVolume: number = 0;
  private wakeWordActive: boolean = true;

  private constructor() {
    this.orchestrator = new VoiceOrchestrator(
      {},
      {
        onStateChange: (state) => {
          this.subscribers.forEach((s) => s.onStateChange?.(state));
        },
        onTranscript: (role, text) => {
          const turn: ConversationTurn = { role, text, timestamp: Date.now() };
          this.transcripts.push(turn);
          this.subscribers.forEach((s) => s.onTranscript?.(turn));
        },
        onVolumeChange: (vol) => {
          this.currentVolume = vol;
          this.subscribers.forEach((s) => s.onVolumeChange?.(vol));
        },
        onJarvisSpokenText: (text) => {
          this.lastJarvisMessage = text;
          this.subscribers.forEach((s) => s.onJarvisMessage?.(text));
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
      onTranscript: (role, text) => {
        const turn: ConversationTurn = { role, text, timestamp: Date.now() };
        this.transcripts.push(turn);
        this.subscribers.forEach((s) => s.onTranscript?.(turn));
      },
      onVolumeChange: (vol) => {
        this.currentVolume = vol;
        this.subscribers.forEach((s) => s.onVolumeChange?.(vol));
      },
      onJarvisSpokenText: (text) => {
        this.lastJarvisMessage = text;
        this.subscribers.forEach((s) => s.onJarvisMessage?.(text));
      },
    });
  }

  public subscribe(subscriber: VoiceSessionSubscriber): () => void {
    this.subscribers.add(subscriber);
    // Initial emit
    subscriber.onStateChange?.(this.orchestrator.getState());
    if (this.lastJarvisMessage) {
      subscriber.onJarvisMessage?.(this.lastJarvisMessage);
    }
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getState(): VoiceState {
    return this.orchestrator.getState();
  }

  public async start(): Promise<void> {
    await this.orchestrator.startActiveSession('Yes? Main sun raha hoon.');
  }

  public async stop(): Promise<void> {
    await this.orchestrator.stopActiveSession();
  }

  public async toggle(): Promise<void> {
    await this.orchestrator.toggleSession();
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

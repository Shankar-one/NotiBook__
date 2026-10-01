export class AudioManager {
  private mediaStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isCapturing: boolean = false;
  private isPlaying: boolean = false;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onAudioChunkCallback?: (base64Chunk: string) => void;
  private onVolumeChangeCallback?: (volume: number) => void;
  private volumeInterval?: any;

  constructor() {
    // Lazy init audio contexts on user interaction
  }

  public static async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return 'prompt';
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'prompt';
    }
  }

  public static async requestPermission(): Promise<{ granted: boolean; error?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { granted: false, error: 'Microphone is not supported in this browser environment.' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      // Release stream after confirmation
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    } catch (err: any) {
      console.warn('[AudioManager] Permission request failed:', err);
      return { granted: false, error: err.name || err.message };
    }
  }

  public async startCapture(
    onChunk: (base64Chunk: string) => void,
    onVolume?: (volume: number) => void
  ): Promise<void> {
    if (this.isCapturing) return;

    this.onAudioChunkCallback = onChunk;
    this.onVolumeChangeCallback = onVolume;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
      this.analyser = this.inputAudioCtx.createAnalyser();
      this.analyser.fftSize = 64;

      this.source.connect(this.analyser);
      this.analyser.connect(this.processor);
      this.processor.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isCapturing) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
        if (this.onAudioChunkCallback) {
          this.onAudioChunkCallback(base64);
        }
      };

      if (onVolume) {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.volumeInterval = setInterval(() => {
          if (!this.analyser || !this.isCapturing) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, avg / 128);
          onVolume(normalized);
        }, 60);
      }

      this.isCapturing = true;
    } catch (err: any) {
      console.warn('[AudioManager] startCapture error:', err);
      throw err;
    }
  }

  public stopCapture(): void {
    this.isCapturing = false;
    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = undefined;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
  }

  // Playback handling with 24kHz for Gemini Live output
  public async playAudioChunk(base64PcmOrWav: string, isWav: boolean = false): Promise<void> {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.outputAudioCtx || this.outputAudioCtx.state === 'closed') {
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.isPlaying = true;
      const arrayBuffer = this.base64ToArrayBuffer(base64PcmOrWav);

      if (isWav) {
        const audioBuffer = await this.outputAudioCtx.decodeAudioData(arrayBuffer);
        const sourceNode = this.outputAudioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(this.outputAudioCtx.destination);
        sourceNode.onended = () => {
          this.activeSources = this.activeSources.filter((s) => s !== sourceNode);
          if (this.activeSources.length === 0) this.isPlaying = false;
        };
        this.activeSources.push(sourceNode);
        sourceNode.start();
        return;
      }

      // Raw 24kHz 16-bit PCM little-endian
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const buffer = this.outputAudioCtx.createBuffer(1, float32Array.length, 24000);
      buffer.copyToChannel(float32Array, 0);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioCtx.destination);

      const now = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.05; // tiny buffer to avoid clicks
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      this.activeSources.push(source);

      source.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== source);
        if (this.activeSources.length === 0) {
          this.isPlaying = false;
        }
      };
    } catch (err) {
      console.warn('[AudioManager] playAudioChunk error:', err);
    }
  }

  // Speak text using Web Speech API synthesis as reliable instant voice layer
  // The language of spoken audio response strictly matches the language of generated response text
  public speakText(
    text: string,
    lang?: 'hindi' | 'hinglish' | 'english' | string,
    onEnd?: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      this.interruptPlayback();

      if (!('speechSynthesis' in window)) {
        onEnd?.();
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      const isDevanagari = /[\u0900-\u097F]/.test(text);
      const isHindi = lang === 'hindi' || isDevanagari;
      const isEnglish = lang === 'english' && !isDevanagari;
      const isHinglish = !isHindi && !isEnglish;

      const voices = window.speechSynthesis.getVoices();

      if (isHindi) {
        // Pure Hindi voice
        utterance.lang = 'hi-IN';
        const hindiVoice = voices.find(
          (v) => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
        );
        if (hindiVoice) utterance.voice = hindiVoice;
      } else if (isHinglish) {
        // Hinglish voice: prefers Indian English/Hindi voice for natural colloquial phonetics
        utterance.lang = 'hi-IN';
        const indianVoice = voices.find(
          (v) =>
            v.lang === 'hi-IN' ||
            v.lang === 'en-IN' ||
            v.name.includes('India') ||
            v.name.includes('Hindi') ||
            v.lang.startsWith('hi')
        );
        if (indianVoice) {
          utterance.voice = indianVoice;
        } else {
          utterance.lang = 'en-IN';
        }
      } else {
        // English voice
        utterance.lang = 'en-US';
        const engVoice = voices.find(
          (v) =>
            (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.lang.includes('IN') || v.lang.includes('US'))) ||
            v.lang.startsWith('en')
        );
        if (engVoice) utterance.voice = engVoice;
      }

      this.isPlaying = true;

      utterance.onend = () => {
        this.isPlaying = false;
        onEnd?.();
        resolve();
      };

      utterance.onerror = () => {
        this.isPlaying = false;
        onEnd?.();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Interruption / Barge-in: stops any currently playing audio immediately
  public interruptPlayback(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  public cleanup(): void {
    this.stopCapture();
    this.interruptPlayback();
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export class AudioManager {
  private mediaStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingMimeType: string = 'audio/webm';
  private isCapturing: boolean = false;
  private isPlaying: boolean = false;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onAudioChunkCallback?: (base64Chunk: string) => void;
  private onVolumeChangeCallback?: (volume: number) => void;
  private volumeInterval?: any;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    this.initVoices();
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  private getVoices(): SpeechSynthesisVoice[] {
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
      return this.cachedVoices;
    }
    return [];
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
      // Mute loopback gain so user does NOT hear delayed audio feedback in their speakers
      const muteGain = this.inputAudioCtx.createGain();
      muteGain.gain.value = 0;
      this.processor.connect(muteGain);
      muteGain.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e) => {
        if (!this.isCapturing) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64 = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
        if (this.onAudioChunkCallback) {
          this.onAudioChunkCallback(base64);
        }
      };

      // Initialize MediaRecorder for high-fidelity audio capture & server transcription
      this.recordedChunks = [];
      try {
        let mime = 'audio/webm;codecs=opus';
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          if (!MediaRecorder.isTypeSupported(mime)) {
            if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
            else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) mime = 'audio/ogg;codecs=opus';
            else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
            else mime = '';
          }
        }
        this.recordingMimeType = mime || 'audio/webm';
        this.mediaRecorder = mime ? new MediaRecorder(this.mediaStream, { mimeType: mime }) : new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            this.recordedChunks.push(ev.data);
          }
        };
        this.mediaRecorder.start(250);
        console.log(`[AudioManager] MediaRecorder capturing (${this.recordingMimeType})`);
      } catch (recErr) {
        console.warn('[AudioManager] MediaRecorder fallback unavailable:', recErr);
      }

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
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.mediaRecorder = null;
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

  /**
   * Retrieves the recorded audio as base64 string
   */
  public async getRecordedAudioBase64(): Promise<{ base64: string; mimeType: string } | null> {
    if (this.recordedChunks.length === 0) return null;
    try {
      const blob = new Blob(this.recordedChunks, { type: this.recordingMimeType });
      if (blob.size < 500) return null;
      const buffer = await blob.arrayBuffer();
      const base64 = this.arrayBufferToBase64(buffer);
      return { base64, mimeType: this.recordingMimeType };
    } catch {
      return null;
    }
  }

  public resetRecordedAudio(): void {
    this.recordedChunks = [];
  }

  /**
   * Transcribe recorded audio with server-side Gemini 3.8 Flash
   */
  public async transcribeAudio(base64Audio: string, mimeType: string = 'audio/webm', language?: string): Promise<string> {
    try {
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType,
          language,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.transcript || '').trim();
      }
    } catch (err) {
      console.warn('[AudioManager] Transcription API error:', err);
    }
    return '';
  }

  /**
   * Play an immediate pleasant acoustic wake chime (D5 -> A5 ascending tone)
   * notifying the user that Jarvis has woken up and is actively listening.
   */
  public playWakeChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch (e) {
      console.warn('[AudioManager] Wake chime error:', e);
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

  /**
   * Speak text using Web Speech API synthesis as reliable instant voice layer.
   * Special instruction requirement: "Main sun raha hu should be hindi accent".
   * For Hindi/Hinglish speech, selects authentic Hindi/Indian accent voices.
   */
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

      const voices = this.getVoices();
      const lowerText = text.toLowerCase().trim();

      // Check if text is "Main sun raha hu" or variants
      const isMainSunRahaHu = 
        lowerText.includes('main sun raha') || 
        lowerText.includes('sun raha hu') || 
        lowerText.includes('sun raha hoon') ||
        text.includes('सुन रहा हूँ') ||
        text.includes('सुन रहा हूं');

      const isDevanagari = /[\u0900-\u097F]/.test(text);
      const isHindi = lang === 'hindi' || isDevanagari || isMainSunRahaHu;
      const isEnglish = lang === 'english' && !isDevanagari && !isMainSunRahaHu;
      const isHinglish = !isHindi && !isEnglish;

      // Find the best voice with Hindi accent
      let chosenVoice: SpeechSynthesisVoice | undefined;
      let targetLang = 'hi-IN';
      let spokenUtteranceText = text;

      // Find Hindi native voices
      const hindiVoice = voices.find(
        (v) =>
          v.lang.startsWith('hi') ||
          v.name.toLowerCase().includes('hindi') ||
          v.name.toLowerCase().includes('lekha') ||
          v.name.toLowerCase().includes('kalpana') ||
          v.name.toLowerCase().includes('swara') ||
          v.name.toLowerCase().includes('madhur')
      );

      // Find Indian English voices (natural Indian accent)
      const indianVoice = voices.find(
        (v) =>
          v.lang === 'en-IN' ||
          v.name.toLowerCase().includes('india') ||
          v.name.toLowerCase().includes('neerja') ||
          v.name.toLowerCase().includes('prabhat') ||
          v.name.toLowerCase().includes('ravi') ||
          v.name.toLowerCase().includes('heera')
      );

      if (isMainSunRahaHu) {
        // "Main sun raha hu should be hindi accent"
        targetLang = 'hi-IN';
        if (hindiVoice) {
          chosenVoice = hindiVoice;
          // Native Hindi speech engines pronounce Devanagari flawlessly in Hindi accent
          spokenUtteranceText = 'मैं सुन रहा हूँ।';
        } else if (indianVoice) {
          chosenVoice = indianVoice;
          targetLang = 'en-IN';
          spokenUtteranceText = 'Main sun raha hu.';
        } else {
          // If no specific Hindi/Indian voice, still set lang to hi-IN
          targetLang = 'hi-IN';
          spokenUtteranceText = 'मैं सुन रहा हूँ';
        }
      } else if (isHindi) {
        targetLang = 'hi-IN';
        chosenVoice = hindiVoice || indianVoice;
      } else if (isHinglish) {
        // Hinglish uses Indian accent voice
        targetLang = 'hi-IN';
        chosenVoice = indianVoice || hindiVoice;
        if (!chosenVoice) {
          targetLang = 'en-IN';
        }
      } else {
        // English voice
        targetLang = 'en-US';
        const engVoice = voices.find(
          (v) =>
            v.lang === 'en-IN' || // Prefer clear Indian English if available, or natural US English
            (v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Jenny'))) ||
            v.lang.startsWith('en')
        );
        chosenVoice = engVoice;
      }

      const utterance = new SpeechSynthesisUtterance(spokenUtteranceText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = targetLang;
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      this.isPlaying = true;

      const finish = () => {
        this.isPlaying = false;
        onEnd?.();
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('[AudioManager] TTS utterance ended/error:', e);
        finish();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[AudioManager] SpeechSynthesis speak failed:', err);
        finish();
      }
    });
  }

  // Interruption / Barge-in: stops any currently playing audio immediately
  public interruptPlayback(): void {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
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

/**
 * InputHandler - Manages timing input from multiple sources
 * 
 * Supports:
 * - Keyboard/Mouse: Simple tap input
 * - Audio: Microphone onset detection
 * - MIDI: MIDI controller note input
 * 
 * All inputs are converted to AudioContext time for consistent comparison
 */

import type { InputMethod } from '../types';
import { metronomeEngine } from './MetronomeEngine';

export interface InputHandlerCallbacks {
  onInput: (audioContextTime: number, method: InputMethod) => void;
}

export class InputHandler {
  private callbacks: InputHandlerCallbacks | null = null;
  private activeMethod: InputMethod | null = null;
  private isListening: boolean = false;

  // Keyboard/Mouse
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private boundClickHandler: ((e: MouseEvent) => void) | null = null;

  // Audio (microphone)
  private audioStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioDetectionInterval: number | null = null;
  private lastAudioTriggerTime: number = 0;
  private readonly AUDIO_COOLDOWN_MS = 50; // Minimum ms between audio triggers
  private audioSensitivity: number = 0.5; // 0-1 range, default middle
  private onAudioLevel: ((level: number) => void) | null = null;

  // MIDI
  private midiAccess: MIDIAccess | null = null;
  private midiInputs: MIDIInput[] = [];

  // Tap sound settings
  private tapSoundEnabled: boolean = true;
  private sessionActive: boolean = false;
  private tapSoundType: 'click' | 'beep' | 'drum' | 'wood' = 'wood';

  setCallbacks(callbacks: InputHandlerCallbacks): void {
    this.callbacks = callbacks;
  }

  setAudioSensitivity(sensitivity: number): void {
    // Clamp to 0-1 range
    this.audioSensitivity = Math.max(0, Math.min(1, sensitivity));
  }

  setAudioLevelCallback(callback: ((level: number) => void) | null): void {
    this.onAudioLevel = callback;
  }

  setTapSoundEnabled(enabled: boolean): void {
    this.tapSoundEnabled = enabled;
  }

  setSessionActive(active: boolean): void {
    this.sessionActive = active;
  }

  setTapSoundType(type: 'click' | 'beep' | 'drum' | 'wood'): void {
    this.tapSoundType = type;
  }

  /**
   * Play a short tap/click sound for feedback
   */
  private playTapSound(): void {
    // Only play during active session
    if (!this.tapSoundEnabled || !this.sessionActive) return;
    
    const audioContext = metronomeEngine.getAudioContext();
    if (!audioContext) return;

    const now = audioContext.currentTime;

    switch (this.tapSoundType) {
      case 'click':
        this.playSoundClick(audioContext, now);
        break;
      case 'beep':
        this.playSoundBeep(audioContext, now);
        break;
      case 'drum':
        this.playSoundDrum(audioContext, now);
        break;
      case 'wood':
      default:
        this.playSoundWood(audioContext, now);
        break;
    }
  }

  private playSoundClick(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 1500;
    osc.type = 'square';
    
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    
    osc.start(time);
    osc.stop(time + 0.03);
  }

  private playSoundBeep(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 880;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.25, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    
    osc.start(time);
    osc.stop(time + 0.08);
  }

  private playSoundDrum(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Pitch drop for drum-like sound
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playSoundWood(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 800;
    osc.type = 'triangle';
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    
    osc.start(time);
    osc.stop(time + 0.06);
  }

  async startListening(method: InputMethod): Promise<void> {
    if (this.isListening) {
      this.stopListening();
    }

    this.activeMethod = method;
    this.isListening = true;

    switch (method) {
      case 'keyboard':
        this.setupKeyboardListeners();
        break;
      case 'audio':
        await this.setupAudioInput();
        break;
      case 'midi':
        await this.setupMIDIInput();
        break;
    }
  }

  stopListening(): void {
    this.isListening = false;

    // Cleanup keyboard listeners
    if (this.boundKeyHandler) {
      window.removeEventListener('keydown', this.boundKeyHandler);
      this.boundKeyHandler = null;
    }
    if (this.boundClickHandler) {
      window.removeEventListener('mousedown', this.boundClickHandler);
      this.boundClickHandler = null;
    }

    // Cleanup audio
    if (this.audioDetectionInterval !== null) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // Cleanup MIDI
    this.midiInputs.forEach(input => {
      input.onmidimessage = null;
    });
    this.midiInputs = [];

    this.activeMethod = null;
  }

  private setupKeyboardListeners(): void {
    this.boundKeyHandler = (e: KeyboardEvent) => {
      // Ignore repeats and modifier keys
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      
      // Use space bar or any letter key
      if (e.code === 'Space' || e.code.startsWith('Key')) {
        e.preventDefault();
        this.handleInput(e.timeStamp, false, true); // Play tap sound
      }
    };

    this.boundClickHandler = (e: MouseEvent) => {
      // Only trigger on left click
      if (e.button !== 0) return;
      this.handleInput(e.timeStamp, false, true); // Play tap sound
    };

    window.addEventListener('keydown', this.boundKeyHandler);
    window.addEventListener('mousedown', this.boundClickHandler);
  }

  private async setupAudioInput(): Promise<void> {
    const audioContext = metronomeEngine.getAudioContext();
    if (!audioContext) {
      throw new Error('AudioContext not available');
    }

    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      // Create audio nodes
      const source = audioContext.createMediaStreamSource(this.audioStream);
      this.analyserNode = audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0;

      source.connect(this.analyserNode);

      // Start onset detection loop
      const bufferLength = this.analyserNode.fftSize;
      const dataArray = new Float32Array(bufferLength);
      let previousRMS = 0;
      
      // Sensitivity maps to threshold: high sensitivity = low threshold
      // Sensitivity 0 = threshold 0.15 (very insensitive)
      // Sensitivity 1 = threshold 0.005 (very sensitive)
      const getThreshold = () => 0.005 + (1 - this.audioSensitivity) * 0.145;
      const ONSET_RATIO = 1.3; // Current RMS must be this many times previous

      this.audioDetectionInterval = window.setInterval(() => {
        if (!this.analyserNode || !this.isListening) return;

        this.analyserNode.getFloatTimeDomainData(dataArray);

        // Calculate RMS (root mean square) for amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Report audio level for UI feedback (normalize to 0-1 range, cap at 1)
        // Multiply by 30 to make quiet sounds visible on the meter
        const normalizedLevel = Math.min(1, rms * 30);
        if (this.onAudioLevel) {
          this.onAudioLevel(normalizedLevel);
        }

        // Onset detection: significant increase in amplitude
        const now = performance.now();
        const threshold = getThreshold();
        if (rms > threshold && 
            rms > previousRMS * ONSET_RATIO &&
            now - this.lastAudioTriggerTime > this.AUDIO_COOLDOWN_MS) {
          this.lastAudioTriggerTime = now;
          // Pass true to compensate for microphone input latency
          this.handleInput(now, true);
        }

        previousRMS = rms;
      }, 5); // Check every 5ms for low latency

    } catch (error) {
      console.error('Failed to setup audio input:', error);
      throw new Error('Microphone access denied or not available');
    }
  }

  private async setupMIDIInput(): Promise<void> {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser');
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      
      // Listen to all MIDI inputs
      this.midiAccess.inputs.forEach(input => {
        this.midiInputs.push(input);
        input.onmidimessage = (event) => {
          // Note On message (status byte 144-159, or 0x90-0x9F)
          if (event.data && event.data[0] >= 144 && event.data[0] <= 159) {
            const velocity = event.data[2];
            // Only trigger on actual note-on (velocity > 0)
            if (velocity > 0) {
              // MIDI events have their own timestamp
              this.handleInput(event.timeStamp, false, true); // Play tap sound
            }
          }
        };
      });

      if (this.midiInputs.length === 0) {
        console.warn('No MIDI inputs detected');
      }
    } catch (error) {
      console.error('Failed to setup MIDI input:', error);
      throw new Error('MIDI access denied or not available');
    }
  }

  private handleInput(performanceTimestamp: number, compensateForInputLatency: boolean = false, playSound: boolean = false): void {
    if (!this.callbacks || !this.isListening || !this.activeMethod) return;

    // Play tap sound for keyboard/MIDI feedback
    if (playSound) {
      this.playTapSound();
    }

    let adjustedTimestamp = performanceTimestamp;
    
    // For audio input, compensate for microphone/processing latency
    if (compensateForInputLatency) {
      const audioContext = metronomeEngine.getAudioContext();
      if (audioContext) {
        // baseLatency is the input processing delay in seconds
        const inputLatencyMs = (audioContext.baseLatency ?? 0) * 1000;
        // The actual sound happened earlier than when we detected it
        adjustedTimestamp = performanceTimestamp - inputLatencyMs;
      }
    }

    // Convert performance.now() timestamp to AudioContext time
    const audioContextTime = metronomeEngine.performanceTimeToAudioTime(adjustedTimestamp);
    
    this.callbacks.onInput(audioContextTime, this.activeMethod);
  }

  getActiveMethod(): InputMethod | null {
    return this.activeMethod;
  }

  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Start mic preview (for testing sensitivity without starting a session)
   */
  async startMicPreview(): Promise<void> {
    if (this.isListening) return;
    
    const audioContext = new AudioContext();
    
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      const source = audioContext.createMediaStreamSource(this.audioStream);
      this.analyserNode = audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0;

      source.connect(this.analyserNode);

      const bufferLength = this.analyserNode.fftSize;
      const dataArray = new Float32Array(bufferLength);

      this.audioDetectionInterval = window.setInterval(() => {
        if (!this.analyserNode) return;

        this.analyserNode.getFloatTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalizedLevel = Math.min(1, rms * 30);
        
        if (this.onAudioLevel) {
          this.onAudioLevel(normalizedLevel);
        }
      }, 16); // ~60fps for smooth meter

    } catch (error) {
      console.error('Failed to start mic preview:', error);
      throw new Error('Microphone access denied');
    }
  }

  /**
   * Stop mic preview
   */
  stopMicPreview(): void {
    if (this.audioDetectionInterval !== null) {
      clearInterval(this.audioDetectionInterval);
      this.audioDetectionInterval = null;
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    if (this.onAudioLevel) {
      this.onAudioLevel(0);
    }
  }

  // Check if MIDI is available in this browser
  static isMIDISupported(): boolean {
    return 'requestMIDIAccess' in navigator;
  }

  // Check if audio input is available
  static isAudioInputSupported(): boolean {
    return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  }
}

// Singleton instance
export const inputHandler = new InputHandler();


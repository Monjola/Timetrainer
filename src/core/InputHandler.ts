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

  // MIDI
  private midiAccess: MIDIAccess | null = null;
  private midiInputs: MIDIInput[] = [];

  setCallbacks(callbacks: InputHandlerCallbacks): void {
    this.callbacks = callbacks;
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
        this.handleInput(e.timeStamp);
      }
    };

    this.boundClickHandler = (e: MouseEvent) => {
      // Only trigger on left click
      if (e.button !== 0) return;
      this.handleInput(e.timeStamp);
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
      const ONSET_THRESHOLD = 0.1; // Adjust based on testing
      const ONSET_RATIO = 2.0; // Current RMS must be this many times previous

      this.audioDetectionInterval = window.setInterval(() => {
        if (!this.analyserNode || !this.isListening) return;

        this.analyserNode.getFloatTimeDomainData(dataArray);

        // Calculate RMS (root mean square) for amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Onset detection: significant increase in amplitude
        const now = performance.now();
        if (rms > ONSET_THRESHOLD && 
            rms > previousRMS * ONSET_RATIO &&
            now - this.lastAudioTriggerTime > this.AUDIO_COOLDOWN_MS) {
          this.lastAudioTriggerTime = now;
          this.handleInput(now);
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
              this.handleInput(event.timeStamp);
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

  private handleInput(performanceTimestamp: number): void {
    if (!this.callbacks || !this.isListening || !this.activeMethod) return;

    // Convert performance.now() timestamp to AudioContext time
    const audioContextTime = metronomeEngine.performanceTimeToAudioTime(performanceTimestamp);
    
    this.callbacks.onInput(audioContextTime, this.activeMethod);
  }

  getActiveMethod(): InputMethod | null {
    return this.activeMethod;
  }

  isActive(): boolean {
    return this.isListening;
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


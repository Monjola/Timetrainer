/**
 * MetronomeEngine - Precise audio scheduling for metronome clicks
 * 
 * Uses a lookahead scheduler pattern for sample-accurate timing:
 * - Schedules clicks 100ms ahead of time
 * - Checks every 25ms for new clicks to schedule
 * - This ensures clicks are never late, even if JS main thread is busy
 */

import type { BeatPattern, DrumSoundType } from '../types';
import { getBeatsPerMeasure } from './PatternUtils';

export interface MetronomeConfig {
  bpm: number;
  totalBeats: number;
  countInBeats: number; // Number of count-in beats before recording starts
  beatPattern: BeatPattern; // The pattern to play
  onCountIn: (countInBeat: number, totalCountIn: number) => void; // Called during count-in
  onBeat: (beatIndex: number, scheduledTime: number, expectedInputTime: number) => void;
  onComplete: () => void;
}

export type MetronomeSoundType = 'click' | 'beep' | 'wood' | 'hihat';

export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private schedulerInterval: number | null = null;
  private nextSubdivisionTime: number = 0;
  private currentBeat: number = 0; // Actual beat count (for session progress)
  private currentSubdivision: number = 0; // Current subdivision within pattern
  private countInBeat: number = 0;
  private isInCountIn: boolean = false;
  private isRunning: boolean = false;
  private config: MetronomeConfig | null = null;

  // Preview mode
  private isPreviewMode: boolean = false;
  private previewPattern: BeatPattern | null = null;
  private previewBpm: number = 100;

  // Lookahead scheduling parameters
  private readonly SCHEDULE_AHEAD_TIME = 0.1; // Schedule 100ms ahead
  private readonly SCHEDULER_INTERVAL = 25; // Check every 25ms

  private soundType: MetronomeSoundType = 'click';

  async initialize(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ latencyHint: 'interactive' });
    }
    
    // Resume if suspended (browsers require user interaction)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getOutputLatency(): number {
    if (!this.audioContext) return 0;
    // outputLatency may not be available in all browsers, fallback to baseLatency
    return this.audioContext.outputLatency ?? this.audioContext.baseLatency ?? 0;
  }

  setSoundType(type: MetronomeSoundType): void {
    this.soundType = type;
  }

  getSoundType(): MetronomeSoundType {
    return this.soundType;
  }

  /**
   * Play a tap sound immediately (for input feedback)
   */
  playTapSound(sound: DrumSoundType): void {
    if (!this.audioContext) return;
    this.scheduleDrumSound(this.audioContext.currentTime, sound);
  }

  start(config: MetronomeConfig): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    this.config = config;
    this.currentBeat = 0;
    this.currentSubdivision = 0;
    this.countInBeat = 0;
    this.isInCountIn = config.countInBeats > 0;
    this.isRunning = true;
    
    // Start first subdivision slightly in the future to allow scheduling
    this.nextSubdivisionTime = this.audioContext.currentTime + 0.1;
    
    // Start the scheduler
    this.schedulerInterval = window.setInterval(() => {
      this.scheduler();
    }, this.SCHEDULER_INTERVAL);
  }

  stop(): void {
    this.isRunning = false;
    this.isPreviewMode = false;
    this.previewPattern = null;
    
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Start preview mode - loops the pattern without callbacks
   */
  startPreview(pattern: BeatPattern, bpm: number): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    // Stop any existing playback
    this.stop();

    this.previewPattern = pattern;
    this.previewBpm = bpm;
    this.currentSubdivision = 0;
    this.isPreviewMode = true;
    this.isRunning = true;
    
    // Start first subdivision slightly in the future
    this.nextSubdivisionTime = this.audioContext.currentTime + 0.1;
    
    // Start the scheduler
    this.schedulerInterval = window.setInterval(() => {
      this.previewScheduler();
    }, this.SCHEDULER_INTERVAL);
  }

  /**
   * Stop preview mode
   */
  stopPreview(): void {
    if (this.isPreviewMode) {
      this.stop();
    }
  }

  /**
   * Check if currently in preview mode
   */
  isPreviewing(): boolean {
    return this.isPreviewMode && this.isRunning;
  }

  /**
   * Preview scheduler - loops the pattern indefinitely
   */
  private previewScheduler(): void {
    if (!this.audioContext || !this.previewPattern || !this.isRunning || !this.isPreviewMode) return;

    const currentTime = this.audioContext.currentTime;
    const pattern = this.previewPattern;
    const beatsPerMeasure = getBeatsPerMeasure(pattern.timeSignature);
    const totalSubdivisionsPerMeasure = beatsPerMeasure * pattern.subdivisionsPerBeat;
    
    // Calculate subdivision duration
    const beatDuration = 60 / this.previewBpm;
    const subdivisionDuration = beatDuration / pattern.subdivisionsPerBeat;

    // Schedule subdivisions
    while (this.nextSubdivisionTime < currentTime + this.SCHEDULE_AHEAD_TIME) {
      // Wrap subdivision index for looping
      const patternSubdivision = this.currentSubdivision % totalSubdivisionsPerMeasure;
      
      // Get sounds to play at this subdivision
      const sounds = pattern.grid[patternSubdivision] || [];
      
      // Schedule all sounds for this subdivision
      for (const sound of sounds) {
        this.scheduleDrumSound(this.nextSubdivisionTime, sound);
      }

      // Move to next subdivision (loops forever)
      this.currentSubdivision++;
      this.nextSubdivisionTime += subdivisionDuration;
    }
  }

  private scheduler(): void {
    if (!this.audioContext || !this.config || !this.isRunning) return;

    const currentTime = this.audioContext.currentTime;
    const pattern = this.config.beatPattern;
    const beatsPerMeasure = getBeatsPerMeasure(pattern.timeSignature);
    const totalSubdivisionsPerMeasure = beatsPerMeasure * pattern.subdivisionsPerBeat;
    
    // Calculate subdivision duration
    const beatDuration = 60 / this.config.bpm;
    const subdivisionDuration = beatDuration / pattern.subdivisionsPerBeat;

    // Schedule all subdivisions that fall within our lookahead window
    while (this.nextSubdivisionTime < currentTime + this.SCHEDULE_AHEAD_TIME) {
      // Handle count-in phase (count-in uses simple clicks, one per beat)
      if (this.isInCountIn) {
        // Schedule count-in click (accent sound)
        this.scheduleClick(this.nextSubdivisionTime, true);
        
        // Notify count-in callback
        this.config.onCountIn(this.countInBeat + 1, this.config.countInBeats);
        
        this.countInBeat++;
        this.nextSubdivisionTime += beatDuration; // Count-in is per beat, not subdivision
        
        // Check if count-in is complete
        if (this.countInBeat >= this.config.countInBeats) {
          this.isInCountIn = false;
        }
        continue;
      }

      // Check if session is complete
      if (this.currentBeat >= this.config.totalBeats) {
        this.stop();
        this.config.onComplete();
        return;
      }

      // Get subdivision index within the pattern (wraps around)
      const patternSubdivision = this.currentSubdivision % totalSubdivisionsPerMeasure;
      
      // Get sounds to play at this subdivision
      const sounds = pattern.grid[patternSubdivision] || [];
      
      // Schedule all sounds for this subdivision
      for (const sound of sounds) {
        this.scheduleDrumSound(this.nextSubdivisionTime, sound);
      }

      // Check if this subdivision is on a beat (for beat callbacks)
      const isOnBeat = this.currentSubdivision % pattern.subdivisionsPerBeat === 0;
      
      if (isOnBeat) {
        // Calculate when the user will actually hear this beat (with latency compensation)
        const expectedInputTime = this.nextSubdivisionTime + this.getOutputLatency();

        // Notify beat callback
        this.config.onBeat(this.currentBeat, this.nextSubdivisionTime, expectedInputTime);
        
        // Increment beat counter
        this.currentBeat++;
      }

      // Move to next subdivision
      this.currentSubdivision++;
      this.nextSubdivisionTime += subdivisionDuration;
    }
  }

  private scheduleClick(time: number, isAccent: boolean): void {
    if (!this.audioContext) return;

    switch (this.soundType) {
      case 'beep':
        this.scheduleBeep(time, isAccent);
        break;
      case 'wood':
        this.scheduleWood(time, isAccent);
        break;
      case 'hihat':
        this.scheduleHihat(time, isAccent);
        break;
      case 'click':
      default:
        this.scheduleClassicClick(time, isAccent);
        break;
    }
  }

  private scheduleClassicClick(time: number, isAccent: boolean): void {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = isAccent ? 1500 : 1000;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(isAccent ? 0.6 : 0.5, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private scheduleBeep(time: number, isAccent: boolean): void {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = isAccent ? 880 : 660;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(isAccent ? 0.4 : 0.3, time + 0.005);
    gain.gain.setValueAtTime(isAccent ? 0.4 : 0.3, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  private scheduleWood(time: number, isAccent: boolean): void {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = isAccent ? 1200 : 800;
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(isAccent ? 0.5 : 0.4, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  private scheduleHihat(time: number, isAccent: boolean): void {
    if (!this.audioContext) return;
    // Use noise-like sound for hihat
    const bufferSize = this.audioContext.sampleRate * 0.05;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // High-pass filter to make it sound more like a hihat
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = isAccent ? 8000 : 10000;

    const gain = this.audioContext.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    gain.gain.setValueAtTime(isAccent ? 0.3 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isAccent ? 0.08 : 0.05));

    noise.start(time);
    noise.stop(time + 0.1);
  }

  /**
   * Schedule a drum sound at the specified time
   */
  private scheduleDrumSound(time: number, sound: DrumSoundType): void {
    if (!this.audioContext || sound === 'none') return;

    switch (sound) {
      // Drums
      case 'kick':
        this.scheduleKick(time);
        break;
      case 'snare':
        this.scheduleSnare(time);
        break;
      case 'hihat_closed':
        this.scheduleHihatClosed(time);
        break;
      case 'hihat_open':
        this.scheduleHihatOpen(time);
        break;
      case 'tom_high':
        this.scheduleTom(time, 200);
        break;
      case 'tom_low':
        this.scheduleTom(time, 100);
        break;
      case 'crash':
        this.scheduleCrash(time);
        break;
      case 'ride':
        this.scheduleRide(time);
        break;
      // Metronome
      case 'click_high':
        this.scheduleMetronomeClick(time, 1500);
        break;
      case 'click_low':
        this.scheduleMetronomeClick(time, 1000);
        break;
      case 'wood_high':
        this.scheduleMetronomeWood(time, 1200);
        break;
      case 'wood_low':
        this.scheduleMetronomeWood(time, 800);
        break;
      case 'beep_high':
        this.scheduleMetronomeBeep(time, 880);
        break;
      case 'beep_low':
        this.scheduleMetronomeBeep(time, 660);
        break;
      // Bass
      case 'bass_low':
        this.scheduleBass(time, 55); // A1
        break;
      case 'bass_mid':
        this.scheduleBass(time, 82); // E2
        break;
      case 'bass_high':
        this.scheduleBass(time, 110); // A2
        break;
      // Other
      case 'cowbell':
        this.scheduleCowbell(time);
        break;
      case 'clap':
        this.scheduleClap(time);
        break;
    }
  }

  /**
   * Kick drum - low frequency punch with quick decay
   */
  private scheduleKick(time: number): void {
    if (!this.audioContext) return;

    // Main body oscillator
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    // Pitch sweep from high to low for punch
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    osc.type = 'sine';

    // Volume envelope
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.start(time);
    osc.stop(time + 0.3);

    // Click transient
    const click = this.audioContext.createOscillator();
    const clickGain = this.audioContext.createGain();
    click.connect(clickGain);
    clickGain.connect(this.audioContext.destination);
    
    click.frequency.value = 800;
    click.type = 'triangle';
    
    clickGain.gain.setValueAtTime(0.3, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    
    click.start(time);
    click.stop(time + 0.02);
  }

  /**
   * Snare drum - noise burst with body
   */
  private scheduleSnare(time: number): void {
    if (!this.audioContext) return;

    // Noise component (snares)
    const bufferSize = this.audioContext.sampleRate * 0.15;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 1;

    const noiseGain = this.audioContext.createGain();
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);

    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.start(time);
    noise.stop(time + 0.15);

    // Body (tonal component)
    const body = this.audioContext.createOscillator();
    const bodyGain = this.audioContext.createGain();
    
    body.connect(bodyGain);
    bodyGain.connect(this.audioContext.destination);

    body.frequency.setValueAtTime(200, time);
    body.frequency.exponentialRampToValueAtTime(120, time + 0.05);
    body.type = 'triangle';

    bodyGain.gain.setValueAtTime(0.4, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    body.start(time);
    body.stop(time + 0.1);
  }

  /**
   * Closed hi-hat - short, tight noise burst
   */
  private scheduleHihatClosed(time: number): void {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * 0.05;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.audioContext.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.start(time);
    noise.stop(time + 0.05);
  }

  /**
   * Open hi-hat - longer, more sustained noise
   */
  private scheduleHihatOpen(time: number): void {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * 0.2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;

    const gain = this.audioContext.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.start(time);
    noise.stop(time + 0.2);
  }

  /**
   * Tom drum - tuned drum hit
   */
  private scheduleTom(time: number, pitch: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.setValueAtTime(pitch * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(pitch, time + 0.1);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.start(time);
    osc.stop(time + 0.25);
  }

  /**
   * Crash cymbal - long noise burst
   */
  private scheduleCrash(time: number): void {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * 0.8;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;

    const gain = this.audioContext.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

    noise.start(time);
    noise.stop(time + 0.8);
  }

  /**
   * Ride cymbal - bright, sustained
   */
  private scheduleRide(time: number): void {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * 0.3;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5000;
    filter.Q.value = 2;

    const gain = this.audioContext.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    noise.start(time);
    noise.stop(time + 0.3);
  }

  /**
   * Metronome click sound
   */
  private scheduleMetronomeClick(time: number, freq: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = freq;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.5, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  /**
   * Wood block sound
   */
  private scheduleMetronomeWood(time: number, freq: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = freq;
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.45, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  /**
   * Beep sound
   */
  private scheduleMetronomeBeep(time: number, freq: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = freq;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.35, time + 0.005);
    gain.gain.setValueAtTime(0.35, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  /**
   * Bass note
   */
  private scheduleBass(time: number, freq: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.frequency.value = freq;
    osc.type = 'sawtooth';

    // Filter for warmer bass
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    
    osc.disconnect();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  /**
   * Cowbell
   */
  private scheduleCowbell(time: number): void {
    if (!this.audioContext) return;

    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioContext.destination);

    osc1.frequency.value = 560;
    osc2.frequency.value = 845;
    osc1.type = 'square';
    osc2.type = 'square';

    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.15);
    osc2.stop(time + 0.15);
  }

  /**
   * Hand clap
   */
  private scheduleClap(time: number): void {
    if (!this.audioContext) return;

    // Multiple noise bursts for clap texture
    for (let i = 0; i < 3; i++) {
      const bufferSize = this.audioContext.sampleRate * 0.02;
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }

      const noise = this.audioContext.createBufferSource();
      noise.buffer = buffer;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2500;
      filter.Q.value = 1;

      const gain = this.audioContext.createGain();
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioContext.destination);

      const offset = i * 0.015;
      gain.gain.setValueAtTime(0.4, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.08);

      noise.start(time + offset);
      noise.stop(time + offset + 0.1);
    }
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  isPlaying(): boolean {
    return this.isRunning;
  }

  isCountingIn(): boolean {
    return this.isInCountIn;
  }

  /**
   * Convert a performance.now() timestamp to AudioContext time
   * This is needed because DOM events use performance.now() time base
   */
  performanceTimeToAudioTime(performanceTime: number): number {
    if (!this.audioContext) return 0;
    
    const now = performance.now();
    const audioNow = this.audioContext.currentTime;
    
    // Calculate the offset and convert to AudioContext time
    const offsetMs = now - performanceTime;
    return audioNow - (offsetMs / 1000);
  }
}

// Singleton instance for app-wide use
export const metronomeEngine = new MetronomeEngine();


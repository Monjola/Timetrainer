/**
 * MetronomeEngine - Precise audio scheduling for metronome clicks
 * 
 * Uses a lookahead scheduler pattern for sample-accurate timing:
 * - Schedules clicks 100ms ahead of time
 * - Checks every 25ms for new clicks to schedule
 * - This ensures clicks are never late, even if JS main thread is busy
 */

export interface MetronomeConfig {
  bpm: number;
  totalBeats: number;
  countInBeats: number; // Number of count-in beats before recording starts
  onCountIn: (countInBeat: number, totalCountIn: number) => void; // Called during count-in
  onBeat: (beatIndex: number, scheduledTime: number, expectedInputTime: number) => void;
  onComplete: () => void;
}

export type MetronomeSoundType = 'click' | 'beep' | 'wood' | 'hihat';

export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private schedulerInterval: number | null = null;
  private nextBeatTime: number = 0;
  private currentBeat: number = 0;
  private countInBeat: number = 0;
  private isInCountIn: boolean = false;
  private isRunning: boolean = false;
  private config: MetronomeConfig | null = null;

  // Lookahead scheduling parameters
  private readonly SCHEDULE_AHEAD_TIME = 0.1; // Schedule 100ms ahead
  private readonly SCHEDULER_INTERVAL = 25; // Check every 25ms

  // Click sound parameters
  private readonly CLICK_DURATION = 0.05; // 50ms
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

  start(config: MetronomeConfig): void {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call initialize() first.');
    }

    this.config = config;
    this.currentBeat = 0;
    this.countInBeat = 0;
    this.isInCountIn = config.countInBeats > 0;
    this.isRunning = true;
    
    // Start first beat slightly in the future to allow scheduling
    this.nextBeatTime = this.audioContext.currentTime + 0.1;
    
    // Start the scheduler
    this.schedulerInterval = window.setInterval(() => {
      this.scheduler();
    }, this.SCHEDULER_INTERVAL);
  }

  stop(): void {
    this.isRunning = false;
    
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  private scheduler(): void {
    if (!this.audioContext || !this.config || !this.isRunning) return;

    const currentTime = this.audioContext.currentTime;
    const beatDuration = 60 / this.config.bpm;

    // Schedule all beats that fall within our lookahead window
    while (this.nextBeatTime < currentTime + this.SCHEDULE_AHEAD_TIME) {
      // Handle count-in phase
      if (this.isInCountIn) {
        // Schedule count-in click (use accent sound for all count-in beats)
        this.scheduleClick(this.nextBeatTime, true);
        
        // Notify count-in callback
        this.config.onCountIn(this.countInBeat + 1, this.config.countInBeats);
        
        this.countInBeat++;
        this.nextBeatTime += beatDuration;
        
        // Check if count-in is complete
        if (this.countInBeat >= this.config.countInBeats) {
          this.isInCountIn = false;
        }
        continue;
      }

      // Regular beat handling
      if (this.currentBeat >= this.config.totalBeats) {
        // Session complete
        this.stop();
        this.config.onComplete();
        return;
      }

      // Schedule the click sound (accent on first beat after count-in)
      this.scheduleClick(this.nextBeatTime, this.currentBeat === 0);

      // Calculate when the user will actually hear this beat (with latency compensation)
      const expectedInputTime = this.nextBeatTime + this.getOutputLatency();

      // Notify callback
      this.config.onBeat(this.currentBeat, this.nextBeatTime, expectedInputTime);

      // Move to next beat
      this.currentBeat++;
      this.nextBeatTime += beatDuration;
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


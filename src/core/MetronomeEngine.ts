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
  private readonly CLICK_FREQUENCY = 1000; // Hz
  private readonly CLICK_DURATION = 0.05; // 50ms
  private readonly ACCENT_FREQUENCY = 1500; // Hz for first beat accent

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

    // Create oscillator for click sound
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Use higher frequency for accent (first beat)
    oscillator.frequency.value = isAccent ? this.ACCENT_FREQUENCY : this.CLICK_FREQUENCY;
    oscillator.type = 'sine';

    // Sharp attack, quick decay envelope
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.5, time + 0.001); // 1ms attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + this.CLICK_DURATION);

    oscillator.start(time);
    oscillator.stop(time + this.CLICK_DURATION);
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


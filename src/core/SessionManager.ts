/**
 * SessionManager - Orchestrates training sessions
 * 
 * Coordinates between MetronomeEngine and InputHandler,
 * collects timing offsets, and manages session state.
 */

import type {
  SessionConfig,
  SessionResult,
  SessionState,
  TimingOffset,
  InputMethod
} from '../types';
import { metronomeEngine } from './MetronomeEngine';
import { inputHandler } from './InputHandler';

export interface SessionManagerCallbacks {
  onStateChange: (state: SessionState) => void;
  onCountIn: (current: number, total: number) => void;
  onBeat: (beatIndex: number) => void;
  onInput: (offset: TimingOffset) => void;
  onComplete: (result: SessionResult) => void;
}

export class SessionManager {
  private config: SessionConfig | null = null;
  private callbacks: SessionManagerCallbacks | null = null;
  private state: SessionState = 'idle';
  private offsets: TimingOffset[] = [];
  private targetTimes: Map<string, number> = new Map(); // "measure_subdiv" -> expectedInputTime
  private startTime: number = 0;
  private currentBeat: number = -1;
  private isInCountIn: boolean = false;

  // Configuration
  private readonly COUNT_IN_BEATS = 4; // Number of count-in beats (1, 2, 3, 4, then GO!)
  private readonly BEAT_MATCH_WINDOW_MS = 500; // ±500ms window to match input to beat

  setCallbacks(callbacks: SessionManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  async start(config: SessionConfig): Promise<void> {
    this.config = config;
    this.offsets = [];
    this.targetTimes.clear();
    this.currentBeat = -1;
    this.isInCountIn = true;

    // Initialize audio context (requires user interaction)
    await metronomeEngine.initialize();

    // Set up input handler
    inputHandler.setCallbacks({
      onInput: (audioTime, method) => this.handleInput(audioTime, method)
    });

    // Start listening for input
    await inputHandler.startListening(config.inputMethod);

    // Update state to countdown
    this.setState('countdown');

    // Start metronome with count-in
    metronomeEngine.start({
      bpm: config.bpm,
      totalBeats: config.durationBeats,
      countInBeats: this.COUNT_IN_BEATS,
      beatPattern: config.beatPattern,
      onCountIn: (current, total) => {
        this.callbacks?.onCountIn(current, total);
      },
      onBeat: (beatIndex) => {
        // First beat after count-in - transition to running state
        if (this.isInCountIn) {
          this.isInCountIn = false;
          this.setState('running');
          this.startTime = metronomeEngine.getAudioContext()!.currentTime;
        }
        this.handleBeat(beatIndex);
      },
      onSubdivision: (subdivisionIndex, _scheduledTime, expectedInputTime) => {
        if (this.isInCountIn) return;
        this.handleSubdivision(subdivisionIndex, expectedInputTime);
      },
      onComplete: () => {
        this.complete();
      }
    });
  }

  stop(): void {
    // Set state first to prevent the stop button click from being registered as input
    // (handleInput checks this.state !== 'running')
    this.state = 'finished';

    metronomeEngine.stop();
    inputHandler.stopListening();
    this.complete();
  }

  private handleBeat(beatIndex: number): void {
    this.currentBeat = beatIndex;
    this.callbacks?.onBeat(beatIndex);
  }

  private handleSubdivision(subdivisionIndex: number, expectedInputTime: number): void {
    if (!this.config) return;

    // Check if this subdivision is a target note
    if (this.config.targetSubdivisions.includes(subdivisionIndex)) {
      // Use currentBeat and subdivisionIndex as a unique key for this target
      const targetId = `${this.currentBeat}_${subdivisionIndex}`;
      this.targetTimes.set(targetId, expectedInputTime);

      // Clean up old target times (keep last few beats worth)
      // We want to keep enough history to match late hits
      const cleanupThreshold = (this.currentBeat - 2).toString();
      for (const [key] of this.targetTimes) {
        if (key.split('_')[0] < cleanupThreshold) {
          this.targetTimes.delete(key);
        }
      }
    }
  }

  private handleInput(audioContextTime: number, _method: InputMethod): void {
    // Ignore inputs during count-in or when not running
    if (this.state !== 'running' || this.currentBeat < 0 || this.isInCountIn) return;

    // Find the closest beat to this input
    let closestBeat = -1;
    let closestOffset = Infinity;
    let closestExpectedTime = 0;

    const windowSeconds = this.BEAT_MATCH_WINDOW_MS / 1000;

    for (const [targetId, expectedTime] of this.targetTimes) {
      const offset = audioContextTime - expectedTime;
      const absOffset = Math.abs(offset);

      // Only consider targets within the matching window
      if (absOffset < windowSeconds && absOffset < Math.abs(closestOffset)) {
        closestBeat = parseInt(targetId.split('_')[0]);
        closestOffset = offset;
        closestExpectedTime = expectedTime;
      }
    }

    // If we found a matching target, record the offset
    if (closestBeat >= 0) {
      const timingOffset: TimingOffset = {
        beatIndex: closestBeat,
        offsetMs: closestOffset * 1000, // Convert to milliseconds
        timestamp: audioContextTime,
        expectedTime: closestExpectedTime
      };

      this.offsets.push(timingOffset);
      this.callbacks?.onInput(timingOffset);

      // Find and remove the specific target that was matched
      // Identify the targetId again
      for (const [targetId, expectedTime] of this.targetTimes) {
        if (expectedTime === closestExpectedTime) {
          this.targetTimes.delete(targetId);
          break;
        }
      }
    }
  }

  private complete(): void {
    const audioContext = metronomeEngine.getAudioContext();
    const endTime = audioContext?.currentTime ?? 0;

    const result: SessionResult = {
      config: this.config!,
      offsets: [...this.offsets],
      startTime: this.startTime,
      endTime
    };

    this.setState('finished');
    this.callbacks?.onComplete(result);
  }

  private setState(newState: SessionState): void {
    this.state = newState;
    this.callbacks?.onStateChange(newState);
  }

  getState(): SessionState {
    return this.state;
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  getOffsets(): TimingOffset[] {
    return [...this.offsets];
  }

  reset(): void {
    this.state = 'idle';
    this.offsets = [];
    this.targetTimes.clear();
    this.currentBeat = -1;
    this.callbacks?.onStateChange('idle');
  }
}

// Singleton instance
export const sessionManager = new SessionManager();


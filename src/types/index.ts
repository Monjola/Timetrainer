// Types for the Timing Trainer app

export type InputMethod = 'keyboard' | 'audio' | 'midi';
export type MetronomeSoundType = 'click' | 'beep' | 'wood' | 'hihat';
export type TapSoundType = 'click' | 'beep' | 'drum' | 'wood';

export interface SessionConfig {
  bpm: number;
  durationBeats: number; // Number of beats in the session
  inputMethod: InputMethod;
  metronomeSound: MetronomeSoundType;
  tapSound: TapSoundType;
}

export interface TimingOffset {
  beatIndex: number;
  offsetMs: number; // Negative = early (pushing), Positive = late (dragging)
  timestamp: number; // AudioContext time when input was detected
  expectedTime: number; // AudioContext time when beat was expected (with latency compensation)
}

export interface SessionResult {
  config: SessionConfig;
  offsets: TimingOffset[];
  startTime: number;
  endTime: number;
}

export interface SessionStats {
  mean: number;
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
  histogram: HistogramBin[];
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
  midpoint: number;
}

export type SessionState = 'idle' | 'countdown' | 'running' | 'finished';

export interface MetronomeCallbacks {
  onBeat: (beatIndex: number, scheduledTime: number) => void;
  onSessionEnd: () => void;
}

export interface InputCallbacks {
  onInput: (audioContextTime: number) => void;
}

// Skill level assessment types
export type ConsistencyLevel = 
  | 'metronome' 
  | 'session_pro' 
  | 'musician' 
  | 'intermediate' 
  | 'beginner' 
  | 'inconsistent';

export type OffsetFeel = 
  | 'in_the_pocket'
  | 'groove'
  | 'snap'
  | 'drive'
  | 'dragging'
  | 'nervous'
  | 'day_job';

export interface SkillAssessment {
  // Consistency (standard deviation as % of beat)
  consistencyLevel: ConsistencyLevel;
  consistencyTitle: string;
  consistencyEmoji: string;
  consistencyPercent: number; // σ as percentage of beat duration
  consistencyDescription: string;
  
  // Offset (timing feel)
  offsetFeel: OffsetFeel;
  offsetTitle: string;
  offsetDescription: string;
  offsetMs: number;
}


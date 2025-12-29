// Types for the Timing Trainer app

export type InputMethod = 'keyboard' | 'audio' | 'midi';

export interface SessionConfig {
  bpm: number;
  durationBeats: number; // Number of beats in the session
  inputMethod: InputMethod;
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
export type SkillLevel = 
  | 'metronome' 
  | 'session_pro' 
  | 'gigging_musician' 
  | 'intermediate' 
  | 'beginner' 
  | 'just_starting';

export interface SkillAssessment {
  level: SkillLevel;
  title: string;
  emoji: string;
  description: string;
  consistencyRating: string;
  timingTendency: string;
  range95: number; // ±2σ range in ms (contains 95% of hits)
}


// Types for the Timing Trainer app

export type InputMethod = 'keyboard' | 'audio' | 'midi';
export type MetronomeSoundType = 'click' | 'beep' | 'wood' | 'hihat';

// Time signatures
export type TimeSignature = '4/4' | '3/4' | '6/8';

// Sounds for pattern programming
export type DrumSoundType = 
  // Drums
  | 'kick' 
  | 'snare' 
  | 'hihat_closed' 
  | 'hihat_open'
  | 'tom_high'
  | 'tom_low'
  | 'crash'
  | 'ride'
  // Metronome
  | 'click_high'
  | 'click_low'
  | 'wood_high'
  | 'wood_low'
  | 'beep_high'
  | 'beep_low'
  // Bass
  | 'bass_low'
  | 'bass_mid'
  | 'bass_high'
  // Other
  | 'cowbell'
  | 'clap'
  | 'none';

// Tap sound type - all available sounds for input feedback
export type TapSoundType = DrumSoundType;

// A beat pattern defines what sounds play at each subdivision
// pattern[track][subdivision] where tracks are: kick, snare, hihat
export interface BeatPattern {
  timeSignature: TimeSignature;
  // Number of subdivisions per beat (2 = 8ths, 4 = 16ths)
  subdivisionsPerBeat: number;
  // Pattern grid: [subdivisionIndex] = array of sounds to play
  // Total subdivisions = beatsPerMeasure * subdivisionsPerBeat
  grid: DrumSoundType[][];
}

// Preset patterns
export interface PatternPreset {
  name: string;
  pattern: BeatPattern;
}

export interface SessionConfig {
  bpm: number;
  durationBeats: number; // Number of beats in the session
  inputMethod: InputMethod;
  metronomeSound: MetronomeSoundType;
  tapSound: TapSoundType;
  // New: beat pattern for metronome
  beatPattern: BeatPattern;
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

// Skill level assessment types - Six Sigma based
export type SigmaLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type ConsistencyLevel = 
  | 'scattered'      // < 1 sigma
  | 'loose'          // 1-2 sigma
  | 'steady'         // 2-3 sigma
  | 'locked_in'      // 3-4 sigma
  | 'diamond'        // 4-5 sigma
  | 'atomic_clock';  // 5-6+ sigma

export type OffsetFeel = 
  | 'in_the_pocket'
  | 'groove'
  | 'snap'
  | 'drive'
  | 'dragging'
  | 'nervous'
  | 'day_job';

export interface SkillAssessment {
  // Consistency (Six Sigma Cpk based)
  consistencyLevel: ConsistencyLevel;
  consistencyTitle: string;
  consistencyEmoji: string;
  sigmaLevel: number;        // Actual sigma level (can be fractional)
  cp: number;                // Process capability index
  consistencyDescription: string;
  
  // Offset (timing feel)
  offsetFeel: OffsetFeel;
  offsetTitle: string;
  offsetDescription: string;
  offsetMs: number;
}


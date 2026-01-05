/**
 * PatternEditor - Drum pattern programming grid
 * 
 * Allows users to program custom metronome patterns with:
 * - Time signature selection (4/4, 3/4, 6/8)
 * - Subdivision grid (8ths or 16ths)
 * - Drum sounds (kick, snare, hi-hat)
 */

import React from 'react';
import type { BeatPattern, TimeSignature, DrumSoundType, PatternPreset } from '../types';
import { metronomeEngine } from '../core/MetronomeEngine';
import {
  getBeatsPerMeasure,
  toggleSound,
  hasSound,
  createDefaultPattern,
  PATTERN_PRESETS
} from '../core/PatternUtils';

interface PatternEditorProps {
  pattern: BeatPattern;
  onChange: (pattern: BeatPattern) => void;
  disabled?: boolean;
  bpm: number;
  isPreviewing: boolean;
  onPreviewToggle: () => void;
}

// Sound options...
// ... (omitting sound options for brevity in logic but they stay)

// Sound categories for track selection
interface SoundOption {
  sound: DrumSoundType;
  label: string;
  category: 'drums' | 'metronome' | 'bass' | 'other';
}

const ALL_SOUNDS: SoundOption[] = [
  // Metronome (Top for visibility)
  { sound: 'click_high', label: 'Click Hi', category: 'metronome' },
  { sound: 'click_low', label: 'Click Lo', category: 'metronome' },
  { sound: 'wood_high', label: 'Wood Hi', category: 'metronome' },
  { sound: 'wood_low', label: 'Wood Lo', category: 'metronome' },
  { sound: 'beep_high', label: 'Beep Hi', category: 'metronome' },
  { sound: 'beep_low', label: 'Beep Lo', category: 'metronome' },
  // Drums
  { sound: 'kick', label: 'Kick', category: 'drums' },
  { sound: 'snare', label: 'Snare', category: 'drums' },
  { sound: 'hihat_closed', label: 'Hi-Hat', category: 'drums' },
  { sound: 'hihat_open', label: 'Open HH', category: 'drums' },
  { sound: 'tom_high', label: 'Hi Tom', category: 'drums' },
  { sound: 'tom_low', label: 'Lo Tom', category: 'drums' },
  { sound: 'crash', label: 'Crash', category: 'drums' },
  { sound: 'ride', label: 'Ride', category: 'drums' },
  { sound: 'clap', label: 'Clap', category: 'drums' },
  { sound: 'cowbell', label: 'Cowbell', category: 'drums' },
  // Bass
  { sound: 'bass_low', label: 'Bass Lo', category: 'bass' },
  { sound: 'bass_mid', label: 'Bass Mid', category: 'bass' },
  { sound: 'bass_high', label: 'Bass Hi', category: 'bass' },
];

export { ALL_SOUNDS };

export function PatternEditor({ pattern, onChange, disabled, bpm, isPreviewing, onPreviewToggle }: PatternEditorProps) {
  // Update running preview when pattern or bpm changes
  React.useEffect(() => {
    if (isPreviewing) {
      metronomeEngine.updatePreviewPattern(pattern);
      metronomeEngine.updatePreviewBpm(bpm);
    }
  }, [pattern, bpm, isPreviewing]);

  const beatsPerMeasure = getBeatsPerMeasure(pattern.timeSignature);
  const totalSubdivisions = beatsPerMeasure * pattern.subdivisionsPerBeat;

  const handleTimeSignatureChange = (ts: TimeSignature) => {
    onChange(createDefaultPattern(ts));
  };

  const handleSubdivisionChange = (subdivs: number) => {
    const newBeats = getBeatsPerMeasure(pattern.timeSignature);
    const newTotal = newBeats * subdivs;
    const newGrid: DrumSoundType[][] = Array.from({ length: newTotal }, () => []);

    // Attempt to map existing pattern to new grid
    pattern.grid.forEach((sounds, i) => {
      const beatIndex = Math.floor(i / pattern.subdivisionsPerBeat);
      const subdivInBeat = i % pattern.subdivisionsPerBeat;

      if (subdivs >= pattern.subdivisionsPerBeat) {
        // Expanding
        const ratio = subdivs / pattern.subdivisionsPerBeat;
        const newIndex = beatIndex * subdivs + Math.floor(subdivInBeat * ratio);
        if (newIndex < newTotal) newGrid[newIndex] = [...sounds];
      } else {
        // Contracting
        if (subdivInBeat === 0) {
          const newIndex = beatIndex * subdivs;
          if (newIndex < newTotal) newGrid[newIndex] = [...sounds];
        }
      }
    });

    onChange({
      ...pattern,
      subdivisionsPerBeat: subdivs,
      grid: newGrid
    });
  };

  const handleCellClick = (subdivisionIndex: number, sound: DrumSoundType) => {
    if (disabled) return;
    onChange(toggleSound(pattern, subdivisionIndex, sound));
  };

  const handlePresetSelect = (preset: PatternPreset) => {
    onChange({ ...preset.pattern });
  };

  const clearPattern = () => {
    const newGrid: DrumSoundType[][] = Array.from({ length: totalSubdivisions }, () => []);
    onChange({ ...pattern, grid: newGrid });
  };

  const isOnBeat = (subdivIndex: number) => subdivIndex % pattern.subdivisionsPerBeat === 0;
  const getBeatNumber = (subdivIndex: number) => Math.floor(subdivIndex / pattern.subdivisionsPerBeat) + 1;

  return (
    <div className="pattern-editor">
      {/* Top Controls: Play, Time Sig, Preset */}
      <div className="pattern-controls">
        <button
          className={`preview-button ${isPreviewing ? 'playing' : ''}`}
          onClick={onPreviewToggle}
          disabled={disabled}
          title={isPreviewing ? 'Stop preview' : 'Preview pattern'}
        >
          {isPreviewing ? '⏹' : '▶'}
        </button>

        <div className="control-group">
          <label>Time Sig</label>
          <div className="time-sig-buttons">
            {(['4/4', '3/4', '6/8'] as TimeSignature[]).map(ts => (
              <button
                key={ts}
                className={`time-sig-button ${pattern.timeSignature === ts ? 'active' : ''}`}
                onClick={() => handleTimeSignatureChange(ts)}
                disabled={disabled || isPreviewing}
              >
                {ts}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Subdivs</label>
          <div className="subdiv-buttons">
            {[1, 2, 4].map(subdiv => (
              <button
                key={subdiv}
                className={`subdiv-button ${pattern.subdivisionsPerBeat === subdiv ? 'active' : ''}`}
                onClick={() => handleSubdivisionChange(subdiv)}
                disabled={disabled || (pattern.timeSignature === '6/8' && subdiv > 2)}
              >
                {subdiv === 1 ? '♩' : subdiv === 2 ? '♪' : '♬'}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label>Preset</label>
          <select
            className="preset-select"
            onChange={(e) => {
              const preset = PATTERN_PRESETS.find(p => p.name === e.target.value);
              if (preset) handlePresetSelect(preset);
            }}
            disabled={disabled || isPreviewing}
            value=""
          >
            <option value="" disabled>Load...</option>
            {PATTERN_PRESETS.map(preset => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="clear-button"
          onClick={clearPattern}
          disabled={disabled}
        >
          Clear
        </button>
      </div>

      {/* Grid Matrix */}
      <div className="pattern-grid-container">

        {/* Header Row (Beat Numbers) */}
        <div className="grid-header-row">
          <div className="track-label-spacer" />
          <div className="grid-beats">
            {Array.from({ length: totalSubdivisions }).map((_, i) => (
              <div
                key={i}
                className={`beat-number ${isOnBeat(i) ? 'on-beat' : 'off-beat'}`}
              >
                {isOnBeat(i) ? getBeatNumber(i) : (pattern.subdivisionsPerBeat === 2 ? '+' : '')}
              </div>
            ))}
          </div>
        </div>

        {/* Sound Rows */}
        <div className="grid-scroll-area">
          {ALL_SOUNDS.map(track => (
            <div key={track.sound} className="pattern-row">
              <div className="track-label">
                <span className="track-name">{track.label}</span>
              </div>

              <div className="track-cells">
                {Array.from({ length: totalSubdivisions }).map((_, subdivIndex) => {
                  const isActive = hasSound(pattern, subdivIndex, track.sound);
                  const onBeat = isOnBeat(subdivIndex);

                  return (
                    <button
                      key={subdivIndex}
                      className={`pattern-cell ${isActive ? 'active' : ''} ${onBeat ? 'on-beat' : 'off-beat'} ${track.sound}`}
                      onClick={() => handleCellClick(subdivIndex, track.sound)}
                      disabled={disabled}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pattern-info">
        <span className="info-item">
          {pattern.timeSignature} • {beatsPerMeasure} beats • {totalSubdivisions} steps
        </span>
      </div>
    </div>
  );
}

